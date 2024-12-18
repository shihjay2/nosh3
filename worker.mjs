import Case from 'case'
import json2md from 'json2md'
import moment from 'moment-timezone'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb'
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)
import settings from './settings.mjs'
import TurndownService from 'turndown'
import { isMarkdown, markdownParse, urlFix } from './core.mjs'
import { parentPort, workerData } from 'worker_threads'

const mdbuild = async(opts) => {
  try {
    const process_db = new PouchDB(urlFix(settings.couchdb_uri) + 'timeline_process', settings.couchdb_auth)
    const process_doc = await process_db.get(opts.process_id)
    const process_doc_exp = await process_db.find({selector: {'timestamp': {"$lt": moment().subtract({hours: 2}).unix()}}})
    if (process_doc_exp.docs.length > 0) {
      for (const exp_doc of process_doc_exp.docs) {
        await process_db.remove(exp_doc)
      }
    }
    const db_binary = new PouchDB(urlFix(settings.couchdb_uri) + opts.prefix + 'binaries', settings.couchdb_auth)
    const mdjs = []
    for (const row of opts.timeline) {
      const ul_arr = []
      if (row.id !== 'intro') {
        mdjs.push({h3: Case.title(pluralize.singular(row.resource)) + ' Details'})
        ul_arr.push('**Date**: ' + moment(row.date).format('MMMM DD, YYYY'))
        ul_arr.push('**' + Case.title(pluralize.singular(row.resource)) + '**: ' + row.title)
      } else {
        mdjs.push({h3: 'Patient Information'})
      }
      if (row.resource === 'document_references') {
        for (const binary_id of objectPath.get(row, 'binaries')) {
          const binary_doc = await db_binary.get(binary_id)
          const data = atob(objectPath.get(binary_doc, 'data'))
          if (objectPath.get(binary_doc, 'contentType').includes('text/plain')) {
            if (isMarkdown(data)) {
              const md_arr = markdownParse(data)
              for (const md_arr_row of md_arr) {
                mdjs.push(md_arr_row)
              }
            }
          }
          if (objectPath.get(binary_doc, 'contentType').includes('text/html')) {
            const turndownService = new TurndownService()
            const md = turndownService.turndown(data)
            const md_arr1 = markdownParse(md)
            for (const md_arr_row1 of md_arr1) {
              mdjs.push(md_arr_row1)
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
  } catch (e) {
    console.log(e)
    return e
  }
}

const result = await mdbuild(workerData)
parentPort.postMessage(result)
