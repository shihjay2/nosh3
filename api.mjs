import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import moment from 'moment-timezone'
import objectPath from 'object-path'
import PouchDB from 'pouchdb'
import settings from './settings.mjs'
import { v4 as uuidv4 } from 'uuid'
import { eventAdd, eventUser, getTZ, isMarkdown, pollSet, sync, timelineUpdate, urlFix, verifyJWT } from './core.mjs'
import { Worker } from 'node:worker_threads'

const router = express.Router()
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)
export default router

router.get('/:pid/Timeline', verifyJWT, getTimeline)
router.put('/:pid/md', verifyJWT, putMarkdown)

async function getTimeline(req, res) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  const process_db_remote = new PouchDB(urlFix(settings.couchdb_uri) + 'timeline_process', settings.couchdb_auth)
  if (Object.keys(req.query).length === 0) {
    await sync('timeline', req.params.pid)
    const db = new PouchDB(prefix + 'timeline')
    const timeline_result = await db.allDocs({
      include_docs: true,
      attachments: true,
      startkey: 'nosh_'
    })
    if (timeline_result.rows.length > 0) {
      const timeline = objectPath.get(timeline_result, 'rows.0.doc.timeline')
      await process_db_remote.info()
      const id = 'nosh_' + uuidv4()
      await process_db_remote.put({
        _id: id,
        status: 'pending',
        pid: req.params.pid,
        timestamp: moment().unix(),
        data: '',
      })
      const opts = {
        pid: req.params.pid,
        process_id: id,
        prefix: prefix,
        timeline: timeline
      }
      res.status(200).json({process: id})
      const worker = new Worker('./worker.mjs', { workerData: opts })
      worker.on('message', (result) => {
        console.log(result)
      })
      worker.on('error', (error) => {
        console.log('worker error')
        console.log(error)
      })
    } else {
      res.sendStatus(404)
    }
  } else {
    if (objectPath.has(req, 'query.process')) {
      try {
        const process_doc = await process_db_remote.get(req.query.process)
        if (process_doc.status === 'pending') {
          res.sendStatus(404)
        } else {
          res.status(200)
          res.setHeader('Content-type', "text/markdown")
          res.setHeader('Content-disposition', 'attachment; filename=nosh_timeline_'  + Date.now() + '.md')
          res.send(atob(objectPath.get(process_doc, 'data')))
        }
      } catch (e) {
        console.log(e)
        res.status(401).send('Unauthorized')
      }
    } else {
      console.log('no query item')
      res.status(401).send('Unauthorized')
    }
  }
}

async function putMarkdown(req, res) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  await sync('document_references', req.params.pid)
  const db = new PouchDB(prefix + 'document_references')
  const db_binary = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'binaries', settings.couchdb_auth)
  const id = 'nosh_' + uuidv4()
  const binary_id = 'nosh_' + uuidv4()
  const md = req.body.content
  if (isMarkdown(md)) {
    const timezone = await getTZ(req.params.pid)
    const doc = {
      "_id": id,
      "resourceType": "DocumentReference",
      "id": id,
      "status": "current",
      "subject": {
        "reference": 'Patient/' + req.params.pid
      },
      "date": moment().tz(timezone).format('YYYY-MM-DD HH:mm'),
      "type": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "103140-0",
            "display": "Personal Health Attachment Document"
          }
        ]
      },
      "category": [{
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "103140-0",
            "display": "Personal Health Monitoring Report Document"
          }
        ]
      }],
      "description": "AI Chat",
      "content": [
        {
          "attachment": {
            "contentType": "text/plain; charset=utf-8",
            "url": "Binary/" + binary_id
          }
        }
      ]
    }
    const binary_doc = {
      "resourceType": "Binary",
      "id": binary_id,
      "_id": binary_id,
      "contentType": "text/plain; charset=utf-8",
      "data": btoa(md)
    }
    try {
      const body = await db.put(doc)
      await db_binary.put(binary_doc)
      await sync('document_references', req.params.pid)
      await timelineUpdate({id: id, resource: 'document_references', action: 'update'}, req.params.pid)
      let opts = {
        doc_db: 'document_references',
        doc_id: id,
        diff: null
      }
      opts = await eventUser(res, opts, prefix)
      await eventAdd('Updated document reference', opts, req.params.pid)
      let binary_opts = {
        doc_db: 'binaries',
        doc_id: binary_id,
        diff: null
      }
      binary_opts = await eventUser(res, binary_opts, prefix)
      await eventAdd('Updated binary', binary_opts, req.params.pid)
      await pollSet(req.params.pid, 'document_references')
      await pollSet(req.params.pid, 'binaries')
      res.set('ETag', 'W/"' + body.rev + '"')
      res.status(200).json(body)
    } catch(err) {
      console.log(err)
      res.status(200).json(err)
    }
  } else {
    res.status(200).json({
      "error": true,
      "message": "not markdown document"
    })
  }
}