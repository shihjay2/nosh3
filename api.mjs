import dotenv from 'dotenv'
dotenv.config()
import Case from 'case'
import express from 'express'
import json2md from 'json2md'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb'
import { v4 as uuidv4 } from 'uuid'
import { eventAdd, eventUser, isMarkdown, pollSet, sync, verifyJWT } from './core.mjs'

const router = express.Router()
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)
export default router

router.get('/:pid/Timeline', verifyJWT, getTimeline) //get
router.put('/:pid/md', verifyJWT, putMarkdown) //post

async function getTimeline(req, res) {
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  await sync('timeline', req.params.pid)
  const db = new PouchDB(prefix + 'timeline')
  const timeline_result = await db.allDocs({
    include_docs: true,
    attachments: true,
    startkey: 'nosh_'
  })
  if (timeline_result.rows.length > 0) {
    const timeline = objectPath.get(timeline_result, 'rows.0.doc.timeline')
    const mdjs = []
      for (var row of timeline) {
        const ul_arr = []
        if (row.id !== 'intro') {
          mdjs.push({h3: Case.title(pluralize.singular(row.resource)) + ' Details'})
          ul_arr.push('**Date**: ' + moment(row.date).format('MMMM DD, YYYY'))
          ul_arr.push('**' + Case.title(pluralize.singular(row.resource)) + '**: ' + row.title)
        } else {
          mdjs.push({h3: 'Patient Information'})
        }
        for (var data of row.content) {
          if (row.style === 'p') {
            ul_arr.push('**' + data.key + '**: ' + data.value)
          }
          if (row.style === 'list') {
            ul_arr.push('**Display**: ' + data)
          }
        }
        mdjs.push({ul: ul_arr})
      }
      res.status(200)
      res.setHeader('Content-type', "text/markdown")
      res.setHeader('Content-disposition', 'attachment; filename=nosh_timeline_'  + Date.now() + '.md')
      res.send(json2md(mdjs))
  } else {
    res.status(404)
  }
}

async function putMarkdown(req, res) {
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.pid + '_'
  }
  await sync('document_references', req.params.pid)
  const db = new PouchDB(prefix + 'document_references')
  const id = 'nosh_' + uuidv4()
  const md = req.body.content
  if (isMarkdown(md)) {
    const doc = {
      "_id": id,
      "resourceType": "DocumentReference",
      "id": id,
      "status": {
        "coding": [
          {
            "system": "http://hl7.org/fhir/document-reference-status",
            "code": "current"
          }
        ]
      },
      "subject": {
        "reference": 'Patient/' + req.params.pid
      },
      "date": moment().format('YYYY-MM-DD HH:mm'),
      "type": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "103140-0",
            "display": "Personal Health Attachment Document"
          }
        ]
      },
      "category": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "103140-0",
            "display": "Personal Health Monitoring Report Document"
          }
        ]
      },
      "description": "AI Chat",
      "content": [
        {
          "attachment": {
            "contentType": "text/plain; charset=utf-8",
            "data": btoa(md)
          }
        }
      ]
    }
    try {
      const body = await db.put(doc)
      await sync('document_references', req.params.pid)
      var opts = {
        doc_db: 'document_references',
        doc_id: id,
        diff: null
      }
      opts = await eventUser(res, opts, prefix)
      await eventAdd('Updated document reference', opts, req.params.pid)
      await pollSet(req.params.pid, 'document_references')
      res.set('ETag', 'W/"' + body.rev + '"')
      res.status(200).json(body)
    } catch(err) {
      res.status(200).json(err)
    }
  } else {
    res.status(200).json({
      "error": true,
      "message": "not markdown document"
    })
  }
}