import Case from 'case'
import json2md from 'json2md'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)
import settings from './settings.mjs'
import TurndownService from 'turndown'
import { isMarkdown, markdownParse, sync, urlFix } from './core.mjs'
import { parentPort, workerData } from 'worker_threads'

console.log(workerData)

async function process (opts) {
  console.log(opts)
  await sync('timeline', opts.pid)
  const db = new PouchDB(opts.prefix + 'timeline')
  const process_db = new PouchDB('timeline_process')
  const process_doc = await process_db.get(opts.process_id)
  const timeline_result = await db.allDocs({
    include_docs: true,
    attachments: true,
    startkey: 'nosh_'
  })
  const db_binary = new PouchDB(urlFix(settings.couchdb_uri) + opts.prefix + 'binaries', settings.couchdb_auth)
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
      for (const data1 of row.content) {
        if (row.style === 'p') {
          ul_arr.push('**' + data1.key + '**: ' + data1.value)
        }
        if (row.style === 'list') {
          ul_arr.push('**Display**: ' + data1)
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
    objectPath.set(process_doc, 'data', btoa(json2md(mdjs)))
    objectPath.set(process_doc, 'status', 'complete')
    await process_db.put(process_doc)
    return 'worker complete'
  } else {
    objectPath.set(process_doc, 'status', 'complete')
    await process_db.put(process_doc)
    return 'worker complete'
  }
}

parentPort.postMessage(process(workerData))
