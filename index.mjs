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
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const client = __dirname + '/nosh3-client/dist/'
import { couchdbDatabase, couchdbInstall, urlFix, userAdd, verifyJWT } from './core.mjs'
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
app.use('/app', express.static(client))

app.use('/app/chart', (req, res) => {
  res.sendFile(client + "index.html")
})
app.get('/app/dashboard', (req, res) => {
  res.sendFile(client + "index.html")
})
// app.use('/app/chart', verifyJWT, (req,res) => {
//   res.sendFile(client + "index.html")
// })
// app.get('/app/dashboard', verifyJWT, (req, res) => {
//   res.sendFile(client + "index.html")
// })
app.get('/app/login', (req, res) => {
  res.sendFile(client + "index.html")
})

app.get('/app/verify', (req, res) => {
  res.sendFile(client + "index.html")
})

app.get('/fetch/:file/:type?', (req, res) => {
  var type = 'json'
  if (req.params.type == 'txt') {
    var type = 'txt'
  }
  if (type === 'json') {
    var raw = fs.readFileSync('./assets/' + req.params.file + '.' + type)
    res.status(200).json(JSON.parse(raw))
  } else {
    var raw = fs.readFileSync('./assets/' + req.params.file + '.' + type, 'utf-8')
    res.status(200).send(raw)
  }
})

app.post('/oidc', async(req, res) => {
  if (objectPath.has(req, 'body.body')) {
    var result = await axios.post(req.body.url, req.body.body, {headers: {'Content-Type': 'application/json'}})
  } else {
    var result = await axios.get(req.body.url, {headers: {'Content-Type': 'application/json'}})
  }
  res.status(200).json(result.data)
})

app.get('/start', async(req, res) => {
  var opts = JSON.parse(JSON.stringify(settings.couchdb_auth))
  objectPath.set(opts, 'skip_setup', true)
  const check = new PouchDB(settings.couchdb_uri + '/_users', opts)
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = process.env.NOSH_PATIENT + '_'
  }
  const db_users = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'users', settings.couchdb_auth)
  var info = await check.info()
  if (objectPath.has(info, 'error')) {
    if (info.error == 'not_found') {
      await couchdbInstall()
      var b = false
      var c = 0
      while (!b && c < 40) {
        b = await isReachable(settings.couchdb_uri)
        if (b || c === 39) {
          break
        } else {
          c++
        }
      }
      if (b) {
        const users = new PouchDB((settings.couchdb_uri + '/_users'), settings.couchdb_auth)
        await users.info()
        await couchdbDatabase()
        var result = await db_users.find({selector: {_id: {$regex: "^nosh_*"}}})
        if (result.docs.length === 0) {
          await userAdd()
        }
        res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'app/login')
      } else {
        res.status(200).send('CouchDB is not restarting for some reason; try again')
      }
    } else {
      console.log('something is wrong with your CouchDB install.')
    }
  } else {
    if (process.env.INSTANCE == 'digitalocean') {
      var result1 = await db_users.find({selector: {_id: {$regex: "^nosh_*"}}})
      if (result1.docs.length === 0) {
        console.log('DigitalOcean instance, new Patient NOSH install')
        await couchdbDatabase()
        await userAdd()
      }
    }
    res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'app/login')
  }
})

app.get('/ready', async(req, res) => {
  var b = false
  for (let a = 0; a < 20; a++) {
    if (!b) {
      b = await isReachable(settings.couchdb_uri)
    }
  }
  res.status(200).send('OK')
})

const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`listening on ${port}`)
})

export default app