import dotenv from 'dotenv'
dotenv.config()
import Case from 'case'
import express from 'express'
import fastDiff from 'fast-diff'
import moment from 'moment-timezone'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb'
import settings from './settings.mjs'
import { v4 as uuidv4 } from 'uuid'
import { eventAdd, getTZ, sync, urlFix, verifyJWT, timelineResources, timelineUpdate } from './core.mjs'

const router = express.Router()
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)

export default router

router.get('/api/:pid/:type', verifyJWT, querySecuredResource) //search
router.post('/api/:pid/:type', verifyJWT, postSecuredResource) //create
router.get('/api/:pid/:type/:id', verifyJWT, getSecuredResource) //read
router.put('/api/:pid/:type/:id', verifyJWT, putSecuredResource) //update
router.delete('/api/:pid/:type/:id', verifyJWT, deleteSecuredResource) //delete
router.get('/api/:pid/:type/:id/_history/:vid', verifyJWT, getSecuredResourceVersion) //vread

async function deleteSecuredResource(req, res) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  const startTime = performance.now()
  await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)))
  try {
    const doc = await db.get(req.params.id)
    const result = await db.remove(doc)
    const opts = {
      doc_db: Case.snake(pluralize(req.params.type)),
      doc_id: result.id,
      diff: null
    }
    opts = await eventUser(res, opts, prefix)
    await eventAdd('Deleted ' + pluralize.singular(req.params.type.replace('_statements', '')), opts, req.params.pid)
    if (timelineResources.includes(Case.snake(pluralize(req.params.type)))) {
      await timelineUpdate({id: req.params.id, resource: Case.snake(pluralize(req.params.type)), action: 'delete'}, req.params.pid)
    }
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
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)))
  try {
    const doc = await db.get(req.params.id, {revs_info: true})
    if (Case.snake(pluralize(req.params.type)) === 'document_references') {
      const db_binary = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'binaries', settings.couchdb_auth)
      const binary_id = objectPath.get(doc, 'content.0.attachment.url').substring(objectPath.get(doc, 'content.0.attachment.url').indexOf('/') + 1)
      const binary_doc = await db_binary.get(binary_id)
      objectPath.del(doc, 'content.0.attachment')
      objectPath.set(doc, 'content.0.attachment.contentType', binary_doc.contentType)
      objectPath.set(doc, 'content.0.attachment.data', binary_doc.data)
    }
    res.status(200).json(doc)
  } catch(err) {
    res.status(200).json(err)
  }
}

async function getSecuredResourceVersion(req, res) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)))
  try {
    const doc = db.get(req.params.id, {rev: req.params.vid})
    if (Case.snake(pluralize(req.params.type)) === 'document_references') {
      const db_binary = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'binaries', settings.couchdb_auth)
      const binary_id = objectPath.get(doc, 'content.0.attachment.url').substring(objectPath.get(doc, 'content.0.attachment.url').indexOf('/') + 1)
      const binary_doc = await db_binary.get(binary_id)
      objectPath.del(doc, 'content.0.attachment')
      objectPath.set(doc, 'content.0.attachment.contentType', binary_doc.contentType)
      objectPath.set(doc, 'content.0.attachment.data', binary_doc.data)
    }
    res.status(200).json(doc)
  } catch(err) {
    res.status(200).json(err)
  }
}

async function postSecuredResource(req, res) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)))
  try {
    const id = 'nosh_' + uuidv4()
    objectPath.set(req, 'body.id', id)
    objectPath.set(req, 'body._id', id)
    objectPath.set(req, 'body.subject.reference', 'Patient/' + req.params.pid)
    if (Case.snake(pluralize(req.params.type)) === 'document_references') {
      const db_binary = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'binaries', settings.couchdb_auth)
      const binary_id = 'nosh_' + uuidv4()
      const binary_doc = {
        "resourceType": "Binary",
        "id": binary_id,
        "_id": binary_id,
        "contentType": objectPath.get(req, 'body.content.0.attachment.contentType'),
        "data": objectPath.get(req, 'body.content.0.attachment.data')
      }
      await db_binary.put(binary_doc)
      objectPath.del(req, 'body.content.0.attachment')
      objectPath.set(req, 'body.content.0.attachment.contentType', binary_doc.contentType)
      objectPath.set(req, 'body.content.0.attachment.url', 'Binary/' + binary_id)
      let binary_opts = {
        doc_db: 'binaries',
        doc_id: binary_id,
        diff: null
      }
      binary_opts = await eventUser(res, binary_opts, prefix)
      await eventAdd('Updated binary', binary_opts, req.params.pid)
      await pollSet(req.params.pid, 'binaries')
    }
    const body = await db.put(req.body)
    await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
    if (timelineResources.includes(Case.snake(pluralize(req.params.type)))) {
      await timelineUpdate({id: body.id, resource: Case.snake(pluralize(req.params.type)), action: 'update'}, req.params.pid)
    }
    let opts = {
      doc_db: Case.snake(pluralize(req.params.type)),
      doc_id: body.id,
      diff: null
    }
    opts = await eventUser(res, opts, prefix)
    await eventAdd('Updated ' + pluralize.singular(req.params.type.replace('_statements', '')), opts, req.params.pid)
    res.set('ETag', 'W/"' + body.rev + '"')
    res.status(200).json(body)
  } catch(err) {
    res.status(200).json(err)
  }
}

async function putSecuredResource(req, res) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)))
  try {
    let prev_data = ''
    let diff = null
    try {
      const prev = await db.get(req.body._id)
      prev_data = JSON.stringify(prev)
    } catch (e) {
      console.log('New Document')
    }
    if (Case.snake(pluralize(req.params.type)) === 'document_references') {
      const db_binary = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'binaries', settings.couchdb_auth)
      const binary_id = 'nosh_' + uuidv4()
      const binary_doc = {
        "resourceType": "Binary",
        "id": binary_id,
        "_id": binary_id,
        "contentType": objectPath.get(req, 'body.content.0.attachment.contentType'),
        "data": objectPath.get(req, 'body.content.0.attachment.data')
      }
      await db_binary.put(binary_doc)
      objectPath.del(req, 'body.content.0.attachment')
      objectPath.set(req, 'body.content.0.attachment.contentType', binary_doc.contentType)
      objectPath.set(req, 'body.content.0.attachment.url', 'Binary/' + binary_id)
      let binary_opts = {
        doc_db: 'binaries',
        doc_id: binary_id,
        diff: null
      }
      binary_opts = await eventUser(res, binary_opts, prefix)
      await eventAdd('Updated binary', binary_opts, req.params.pid)
      await pollSet(req.params.pid, 'binaries')
    }
    const body = await db.put(req.body)
    await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
    if (timelineResources.includes(Case.snake(pluralize(req.params.type)))) {
      await timelineUpdate({id: body.id, resource: Case.snake(pluralize(req.params.type)), action: 'update'}, req.params.pid)
    }
    if (prev_data !== '') {
      const diff_result = fastDiff(JSON.stringify(req.body), prev_data)
      console.log(diff_result)
      diff = diff_result.join(',')
    }
    let opts = {
      doc_db: Case.snake(pluralize(req.params.type)),
      doc_id: body.id,
      diff: diff
    }
    opts = await eventUser(res, opts, prefix)
    await eventAdd('Updated ' + pluralize.singular(req.params.type.replace('_statements', '')), opts, req.params.pid)
    res.set('ETag', 'W/"' + body.rev + '"')
    res.status(200).json(body)
  } catch(err) {
    res.status(200).json(err)
  }
}

async function querySecuredResource(req, res) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  const timezone = await getTZ(req.params.pid)
  await sync(Case.snake(pluralize(req.params.type)), req.params.pid)
  const db = new PouchDB(prefix + Case.snake(pluralize(req.params.type)))
  const entries = []
  const selector = []
  const reference_arr = ['subject','patient','encounter','asserter','requester','author']
  for (const [key, value] of Object.entries(req.query)) {
    let key1 = ''
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
  const result = await db.find({selector: {$and: selector}, limit: -1})
  let i = 0
  for (const a in result.docs) {
    entries.push({
      resource: result.docs[a],
      search: {mode: 'match'}
    })
    i++
  }
  const id = 'nosh_' + uuidv4()
  const time = moment().tz(timezone).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
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
