import dotenv from 'dotenv'
dotenv.config()
import axios from 'axios'
import Case from 'case'
import express from 'express'
import fastDiff from 'fast-diff'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb'
import { v4 as uuidv4 } from 'uuid'
import { eventAdd,  sync,  verifyJWT } from './core.mjs'

const router = express.Router()
import PouchDBFind from 'pouchdb-find'
import PouchDBAdapterMemory from 'pouchdb-adapter-memory'
PouchDB.plugin(PouchDBFind)
PouchDB.plugin(PouchDBAdapterMemory)

export default router

router.get('/api/:pid/:type', verifyJWT, querySecuredResource) //search
router.post('/api/:pid/:type', verifyJWT, postSecuredResource) //create
router.get('/api/:pid/:type/:id', verifyJWT, getSecuredResource) //read
router.put('/api/:pid/:type/:id', verifyJWT, putSecuredResource) //update
router.delete('/api/:pid/:type/:id', verifyJWT, deleteSecuredResource) //delete
router.get('/api/:pid/:type/:id/_history/:vid', verifyJWT, getSecuredResourceVersion) //vread

async function deleteSecuredResource(req, res) {
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  const startTime = performance.now()
  // await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)), { adapter: 'memory' })
  try {
    const doc = await db.get(req.params.id)
    const result = await db.remove(doc)
    var opts = {
      doc_db: Case.snake(pluralize(req.params.type)),
      doc_id: result.id,
      diff: null
    }
    opts = await eventUser(res, opts, prefix)
    await eventAdd('Deleted ' + pluralize.singular(req.params.type.replace('_statements', '')), opts, req.params.pid)
    await pollSet(req.params.pid, Case.snake(pluralize(req.params.type)))
    const endTime = performance.now()
    const diff = endTime - startTime
    const diagnostics = "Successfully deleted 1 resource(s) in " + diff + "ms"
    res.set('ETag', 'W/"' + doc._rev + '"')
    res.status(200).json({
      "resourceType": "OperationOutcome",
      "issue": [
        {
          "severity": "information",
          "code": "informational",
          "diagnostics": diagnostics
        }
      ]
    })
  } catch (err) {
    res.status(200).json(err)
  }
}

async function getSecuredResource(req, res) {
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  // await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)), { adapter: 'memory' })
  try {
    const doc = await db.get(req.params.id, {revs_info: true})
    res.status(200).json(doc)
  } catch(err) {
    res.status(200).json(err)
  }
  // res.status(200).json({ data: "Some data from secured endpoint.", user: req.claims.sub });
}

async function getSecuredResourceVersion(req, res) {
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  // await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)), { adapter: 'memory' })
  try {
    const doc = db.get(req.params.id, {rev: req.params.vid})
    res.status(200).json(doc)
  } catch(err) {
    res.status(200).json(err)
  }
}

async function postSecuredResource(req, res) {
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  // await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)), { adapter: 'memory' })
  try {
    var id = 'nosh_' + uuidv4()
    objectPath.set(req, 'body.id', id)
    objectPath.set(req, 'body._id', id)
    objectPath.set(req, 'body.subject.reference', 'Patient/' + req.params.pid)
    const body = await db.put(req.body)
    await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
    var opts = {
      doc_db: Case.snake(pluralize(req.params.type)),
      doc_id: body.id,
      diff: null
    }
    opts = await eventUser(res, opts, prefix)
    await eventAdd('Updated ' + pluralize.singular(req.params.type.replace('_statements', '')), opts, req.params.pid)
    await pollSet(req.params.pid, Case.snake(pluralize(req.params.type)))
    res.set('ETag', 'W/"' + body.rev + '"')
    res.status(200).json(body)
  } catch(err) {
    res.status(200).json(err)
  }
}

async function putSecuredResource(req, res) {
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  // await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)), { adapter: 'memory' })
  try {
    var prev_data = ''
    var diff = null
    try {
      const prev = await db.get(req.body._id)
      prev_data = JSON.stringify(prev)
    } catch (e) {
      console.log('New Document')
    }
    const body = await db.put(req.body)
    await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
    if (prev_data !== '') {
      var diff_result = fastDiff(JSON.stringify(req.body), prev_data)
      console.log(diff_result)
      diff = diff_result.join(',')
    }
    var opts = {
      doc_db: Case.snake(pluralize(req.params.type)),
      doc_id: body.id,
      diff: diff
    }
    opts = await eventUser(res, opts, prefix)
    await eventAdd('Updated ' + pluralize.singular(req.params.type.replace('_statements', '')), opts, req.params.pid)
    await pollSet(req.params.pid, Case.snake(pluralize(req.params.type)))
    res.set('ETag', 'W/"' + body.rev + '"')
    res.status(200).json(body)
  } catch(err) {
    res.status(200).json(err)
  }
}

async function querySecuredResource(req, res) {
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  // await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)), { adapter: 'memory' })
  var entries = []
  var selector = []
  var reference_arr = ['subject','patient','encounter','asserter','requester','author']
  for (var [key, value] of Object.entries(req.query)) {
    var key1 = ''
    if (key == 'patient') {
      key = 'subject'
    }
    if (reference_arr.includes(key)) {
      key1 = Case.camel(key) + '.reference'
    } else {
      key1 = Case.camel(key)
    }
    selector.push({[key1]: value})
  }
  selector.push({_id: {"$gte": null}})
  const result = await db.find({selector: {$and: selector}})
  var i = 0
  for (var a in result.docs) {
    entries.push({
      resource: result.docs[a],
      search: {mode: 'match'}
    })
    i++
  }
  var id = 'nosh_' + uuidv4()
  var time = moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ')
  res.status(200).json({
    resourceType: 'Bundle',
    id: id,
    _id: id,
    type: 'searchset',
    timestamp: time,
    total: i,
    entry: entries 
  })
}
