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
import { isMarkdown, markdownParse, size, urlFix } from './core.mjs'
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
    const md_enc = []
    const md_doc = []
    for (const row of opts.timeline) {
      const ul_arr = []
      if (row.id !== 'intro') {
        mdjs.push({h3: Case.title(pluralize.singular(row.resource)) + ' Details'})
        const [ date_text ] = row.subtitle.split(',')
        ul_arr.push('**Date**: ' + moment(date_text).format('MMMM DD, YYYY'))
        ul_arr.push('**' + Case.title(pluralize.singular(row.resource)) + '**: ' + row.title)
      } else {
        mdjs.push({h3: 'Patient Information'})
      }
      if (row.resource === 'document_references' || row.resource === 'encounters') {
        if (row.resource === 'encounters') {
          if (objectPath.has(row, 'document_reference')) {
            for (const c in objectPath.get(row, 'document_reference.content')) {
              const mdjs_binary1 = []
              const binary_id = objectPath.get(row, 'document_reference.content.' + c + '.attachment.url').substring(objectPath.get(row, 'document_reference.content.' + c + '.attachment.url').indexOf('/') + 1)
              const binary_doc1 = await db_binary.get(binary_id)
              const data1 = atob(objectPath.get(binary_doc1, 'data'))
              if (objectPath.get(binary_doc1, 'contentType').includes('text/plain')) {
                if (isMarkdown(data1)) {
                  const md_arr1 = markdownParse(data1)
                  for (const md_arr_row of md_arr1) {
                    mdjs_binary1.push(md_arr_row)
                  }
                }
              }
              if (objectPath.get(binary_doc1, 'contentType').includes('text/html')) {
                const turndownService = new TurndownService()
                const md = turndownService.turndown(data1)
                const md_arr1 = markdownParse(md)
                for (const md_arr_row1 of md_arr1) {
                  mdjs_binary1.push(md_arr_row1)
                }
              }
              const md_enc_data = json2md(mdjs_binary1)
              const md_enc_size = size(md_enc_data)
              md_enc.push({md: md_enc_data, size: md_enc_size})
            }
          }
        }
        if (row.resource === 'document_references') {
          for (const binary_id of objectPath.get(row, 'binaries')) {
            const mdjs_binary = []
            const binary_doc = await db_binary.get(binary_id)
            const data = atob(objectPath.get(binary_doc, 'data'))
            if (objectPath.get(binary_doc, 'contentType').includes('text/plain')) {
              if (isMarkdown(data)) {
                const md_arr = markdownParse(data)
                for (const md_arr_row of md_arr) {
                  mdjs_binary.push(md_arr_row)
                }
              }
            }
            if (objectPath.get(binary_doc, 'contentType').includes('text/html')) {
              const turndownService = new TurndownService()
              const md = turndownService.turndown(data)
              const md_arr1 = markdownParse(md)
              for (const md_arr_row1 of md_arr1) {
                mdjs_binary.push(md_arr_row1)
              }
            }
            const md_doc_data = json2md(mdjs_binary)
            const md_doc_size = size(md_doc_data)
            md_doc.push({md: md_doc_data, size: md_doc_size})
          }
        }
      } else {
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
    let final_md = json2md(mdjs)
    let total_size = size(final_md)
    for (const md_enc_row of md_enc) {
      if (md_enc_row.size + total_size < opts.size) {
        final_md += "\n" + md_enc_row.md
        total_size += md_enc_row.size
      }
    }
    for (const md_doc_row of md_doc) {
      if (md_doc_row.size + total_size < opts.size) {
        final_md += "\n" + md_doc_row.md
        total_size += md_doc_row.size
      }
    }
    console.log(total_size)
    console.log(opts.size)
    objectPath.set(process_doc, 'data', btoa(final_md))
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
