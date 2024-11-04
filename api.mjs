import dotenv from 'dotenv'
dotenv.config()
import Case from 'case'
import express from 'express'
import json2md from 'json2md'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb'
import settings from './settings.mjs'
import TurndownService from 'turndown'
import { v4 as uuidv4 } from 'uuid'
import { eventAdd, eventUser, isMarkdown, markdownParse, pollSet, sync, urlFix, verifyJWT } from './core.mjs'

const router = express.Router()
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)
export default router

router.get('/:pid/Timeline', verifyJWT, getTimeline)
router.put('/:pid/md', verifyJWT, putMarkdown)

async function getTimeline(req, res) {
  req.setTimeout(0)
  let prefix = ''
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
  const db_binary = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'binaries', settings.couchdb_auth)
  if (timeline_result.rows.length > 0) {
    const timeline = objectPath.get(timeline_result, 'rows.0.doc.timeline')
    const mdjs = []
    for (const row of timeline) {
      const ul_arr = []
      if (row.id !== 'intro') {
        mdjs.push({h3: Case.title(pluralize.singular(row.resource)) + ' Details'})
        ul_arr.push('**Date**: ' + moment(row.date).format('MMMM DD, YYYY'))
        ul_arr.push('**' + Case.title(pluralize.singular(row.resource)) + '**: ' + row.title)
      } else {
        mdjs.push({h3: 'Patient Information'})
      }
      if (row.resource === 'document_references') {
        const doc = row.doc
        if (doc.description !== 'AI Chat') {
          if (objectPath.has(doc, 'content')) {
            for (const c in objectPath.get(doc, 'content')) {
              const binary_id = objectPath.get(doc, 'content.' + c + '.attachment.url').substring(objectPath.get(doc, 'content.' + c + '.attachment.url').indexOf('/') + 1)
              const binary_doc = await db_binary.get(binary_id)
              const data = atob(objectPath.get(binary_doc, 'data'))
              if (objectPath.get(doc, 'content.' + c + '.attachment.contentType').includes('text/plain')) {
                if (isMarkdown(data)) {
                  const md_arr = markdownParse(data)
                  for (const md_arr_row of md_arr) {
                    mdjs.push(md_arr_row)
                  }
                }
              }
              if (objectPath.get(doc, 'content.' + c + '.attachment.contentType').includes('text/html')) {
                const turndownService = new TurndownService()
                const md = turndownService.turndown(data)
                const md_arr1 = markdownParse(md)
                for (const md_arr_row1 of md_arr1) {
                  mdjs.push(md_arr_row1)
                }
              }
            }
          }
        }
      }
      for (const data of row.content) {
        if (row.style === 'p') {
          ul_arr.push('**' + data.key + '**: ' + data.value)
        }
        if (row.style === 'list') {
          ul_arr.push('**Display**: ' + data)
        }
      }
      mdjs.push({ul: ul_arr})
    }
    // get observations
    // const observations = objectPath.get(timeline_result, 'rows.0.doc.observations')
    // if (observations.length > 0) {
    //   mdjs.push({h2: 'Observations'})
    // }
    // for (const row1 of observations) {
    //   if (row1.doc.category[0].coding[0].code !== 'vital-signs') {
    //     const ul_arr1 = []
    //     mdjs.push({h3: Case.title(pluralize.singular(row1.resource)) + ' Details'})
    //     ul_arr1.push('**Date**: ' + moment(row1.date).format('MMMM DD, YYYY'))
    //     ul_arr1.push('**' + Case.title(pluralize.singular(row1.resource)) + '**: ' + row1.title)
    //     for (const data1 of row1.content) {
    //       if (row1.style === 'p') {
    //         ul_arr1.push('**' + data1.key + '**: ' + data1.value)
    //       }
    //       if (row1.style === 'list') {
    //         ul_arr1.push('**Display**: ' + data1)
    //       }
    //     }
    //     mdjs.push({ul: ul_arr1})
    //   }
    // }
    res.status(200)
    res.setHeader('Content-type', "text/markdown")
    res.setHeader('Content-disposition', 'attachment; filename=nosh_timeline_'  + Date.now() + '.md')
    res.send(json2md(mdjs))
  } else {
    res.status(404)
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
    const doc = {
      "_id": id,
      "resourceType": "DocumentReference",
      "id": id,
      "status": "current",
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