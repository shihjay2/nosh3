import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import axios from 'axios'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import fs from 'fs'
import isReachable from 'is-reachable'
import morgan from 'morgan'
import objectPath from 'object-path'
import path from 'path'
import {fileURLToPath} from 'url'
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)

import fhir from './fhir.mjs'
import auth from './auth.mjs'
import api from './api.mjs'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const client = __dirname + '/nosh3-client/dist/'
import { couchdbDatabase, couchdbInstall, couchdbUpdate, urlFix, userAdd } from './core.mjs'
import settings from './settings.mjs'
const app = express()

app.enable('trust proxy')
app.use(morgan('tiny'))
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use('/fhir', fhir)
app.use('/auth', auth)
app.use('/api', api)
app.use('/app', express.static(client))

app.use('/app/chart', (req, res) => {
  res.sendFile(client + "index.html")
})
app.get('/app/dashboard', (req, res) => {
  res.sendFile(client + "index.html")
})
app.get('/app/login', (req, res) => {
  res.sendFile(client + "index.html")
})

app.get('/app/verify', (req, res) => {
  res.sendFile(client + "index.html")
})

app.get('/fetch/:file/:type?', (req, res) => {
  let type = 'json'
  if (req.params.type == 'txt') {
    type = 'txt'
  }
  let raw = {}
  if (type === 'json') {
    raw = fs.readFileSync('./assets/' + req.params.file + '.' + type)
    res.status(200).json(JSON.parse(raw))
  } else {
    raw = fs.readFileSync('./assets/' + req.params.file + '.' + type, 'utf-8')
    res.status(200).send(raw)
  }
})

app.post('/oidc', async(req, res) => {
  if (objectPath.has(req, 'body.body')) {
    try {
      const result = await axios.post(req.body.url, req.body.body, {headers: {'Content-Type': 'application/json'}})
      res.status(200).json(result.data)
    } catch (err) {
      res.status(200).json(err)
    }
  } else {
    try {
      const result = await axios.get(req.body.url, {headers: {'Content-Type': 'application/json'}})
      res.status(200).json(result.data)
    } catch (err) {
      res.status(200).json(err)
    }
  }
  
})

app.get('/presentation/:pid/:id', async(req, res) => {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  await sync('presentations', req.params.pid)
  const db = new PouchDB(prefix + 'presentations')
  try {
    const doc = await db.get(req.params.id, {revs_info: true})
    res.status(200).json(doc)
  } catch(err) {
    res.status(200).json(err)
  }
})

app.get('/ready', async(req, res) => {
  let b = false
  for (let a = 0; a < 20; a++) {
    if (!b) {
      b = await isReachable(settings.couchdb_uri)
    }
  }
  res.status(200).send('OK')
})

app.get('/start', async(req, res) => {
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    res.status(200).send('Invalid URL for this instance')
  }
  const opts = JSON.parse(JSON.stringify(settings.couchdb_auth))
  objectPath.set(opts, 'skip_setup', true)
  const check = new PouchDB(urlFix(settings.couchdb_uri) + 'users', opts)
  try {
    const info = await check.info()
    if (objectPath.has(info, 'error')) {
      let b = false
      if (info.error == 'not_found') {
        await couchdbInstall()
        let c = 0
        while (!b && c < 40) {
          b = await isReachable(settings.couchdb_uri)
          if (b || c === 39) {
            break
          } else {
            c++
          }
        }
      } else {
        b = true
      }
      if (b) {
        await couchdbDatabase()
        const db_users = new PouchDB(urlFix(settings.couchdb_uri) + 'users', settings.couchdb_auth)
        const result = await db_users.find({selector: {_id: {$regex: "^nosh_*"}}})
        if (result.docs.length === 0) {
          await userAdd()
        }
        res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'app/login')
      } else {
        res.status(200).send('CouchDB is not restarting for some reason; try again')
      }
    } else {
      await couchdbUpdate('', req.protocol, req.hostname)
      res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'app/login')
    }
  } catch (e) {
    const err = {
      message: 'error with info call',
      error: e
    }
    res.status(200).json(err)
  }
})

app.post('/syncCheck', async(req, res) => {
  const db = new PouchDB('sync')
  await db.info()
  try {
    const doc = await db.get(req.body.patient)
    res.status(200).json(doc)
  } catch (e) {
    res.status(200).json({ response: 'Error', message: 'No Sync Needed' })
  }
})

const port = process.env.PORT || 4000
app.listen(port, () => {
    console.log(`listening on ${port}`)
})

export default app