import Case from 'case'
import { common } from '@/logic/common'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb-browser'
const { addSchemaOptions, fetchJSON, fhirReplace, loadSelect } = common()
import * as PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)

export async function worker(opts) {
  // opts.online, opts.patient, opts.patientName, opts.patientDOB, opts.patientGender, opts.prefix
  const resources = ['encounters', 'conditions', 'medication_statements', 'immunizations', 'allergy_intolerances', 'document_references']
  const json = await import('@/assets/ui/drawer.json')
  const drawer = json.rows
  const timeline = []
  // const observations = []
  for (const resource of resources) {
    const base = await import('@/assets/fhir/' + resource + '.json')
    const resource1 = drawer.find(item => item.resource === resource)
    const title = 'New ' + Case.title(pluralize.singular(resource))
    let schema = []
    if (resource !== 'observations') {
      if (resource !== 'encounters') {
        schema = base.uiSchema.flat()
      } else {
        schema = base.new.uiSchema.flat()
      }
    }
    if (resource === 'immunizations') {
      const actSites = await fetchJSON('actSites', opts.online)
      schema = addSchemaOptions('site', actSites.concept[0].concept[0].concept, 'code', 'display', schema)
    }
    if (resource === 'medication_statements') {
      const doseform = await fetchJSON('doseform', opts.online)
      const routes = await fetchJSON('routes', opts.online)
      schema = addSchemaOptions('doseUnit', doseform.concept, 'code', 'display', schema)
      schema = addSchemaOptions('route', routes, 'code', 'desc', schema)
    }
    if (resource === 'encounters') {
      const serviceTypes = await fetchJSON('serviceTypes', opts.online)
      schema = addSchemaOptions('serviceType', serviceTypes, 'Code', 'Display', schema)
      const encounterTypes = await fetchJSON('encounterTypes', opts.online)
      schema = addSchemaOptions('type', encounterTypes, 'Code', 'Display', schema)
      schema = await loadSelect('practitioners', 'participant', schema)
    }
    if (resource === 'document_references') {
      const docTypeCodes = await fetchJSON('docTypeCodes', opts.online)
      const docClassCodes = await fetchJSON('docClassCodes', opts.online)
      schema = addSchemaOptions('type', docTypeCodes, 'Code', 'Display', schema, 'http://loinc.org')
      schema = addSchemaOptions('category', docClassCodes, 'Code', 'Display', schema, 'http://loinc.org')
      schema = addSchemaOptions('category', [{'Code': 'clinical-note', 'Display': 'Clinical Note'}], 'Code', 'Display', schema, 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category')
    }
    const db = new PouchDB(opts.prefix + resource)
    try {
      const result = await db.find({selector: {[base.patientField]: {$eq: 'Patient/' + opts.patient }, _id: {"$gte": null}}})
      if (resource !== 'observations') {
        for (const a in result.docs) {
          const timelineItem = {}
          objectPath.set(timelineItem, 'id', objectPath.get(result, 'docs.' + a + '.id'))
          objectPath.set(timelineItem, 'title', fhirReplace('title', base, result.docs[a], schema))
          objectPath.set(timelineItem, 'subtitle', objectPath.get(result, 'docs.' + a + '.' + base.timelineDate) + ', ' + title)
          objectPath.set(timelineItem, 'content', fhirReplace('content', base, result.docs[a], schema))
          objectPath.set(timelineItem, 'extended', fhirReplace('extended', base, result.docs[a], schema))
          objectPath.set(timelineItem, 'status', fhirReplace('status', base, result.docs[a], schema))
          objectPath.set(timelineItem, 'date', new Date(objectPath.get(result, 'docs.' + a + '.' + base.timelineDate)))
          objectPath.set(timelineItem, 'icon', resource1.icon)
          objectPath.set(timelineItem, 'resource', resource)
          objectPath.set(timelineItem, 'keys', base.fuse)
          objectPath.set(timelineItem, 'style', base.uiListContent.contentStyle)
          if (resource === 'encounters') {
            const bundle_db = new PouchDB(opts.prefix + 'bundles')
            const bundle_result = await bundle_db.find({selector: {'entry': {"$elemMatch": {"resource.encounter.reference": 'Encounter/' + objectPath.get(result, 'docs.' + a + '.id')}}, _id: {"$gte": null}}})
            if (bundle_result.docs.length > 0) {
              bundle_result.docs.sort((a1, b1) => moment(b1.timestamp) - moment(a1.timestamp))
              const history = []
              for (const b in bundle_result.docs) {
                if (!objectPath.has(timelineItem, 'bundle')) {
                  objectPath.set(timelineItem, 'bundle', objectPath.get(bundle_result, 'docs.' + b))
                  history.push(objectPath.get(bundle_result, 'docs.' + b))
                } else {
                  history.push(objectPath.get(bundle_result, 'docs.' + b))
                }
              }
              objectPath.set(timelineItem, 'bundle_history', history)
            }
            if (objectPath.has(result, 'docs.' + a + '.sync_id')) {
              const doc_ref_db = new PouchDB(opts.prefix + 'document_references')
              const doc_ref_db_res = await doc_ref_db.find({selector: {'context.encounter.0.reference': {'$regex': objectPath.get(result, 'docs.' + a + '.sync_id')}, _id: {"$gte": null}}})
              if (doc_ref_db_res.docs.length > 0) {
                if (!objectPath.has(timelineItem, 'bundle')) {
                  objectPath.set(timelineItem, 'document_reference', objectPath.get(doc_ref_db_res, 'docs.0'))
                }
              }
            }
          }
          if (resource === 'document_references') {
            if (objectPath.get(result, 'docs.' + a + '.contentType') === 'application/pdf') {
              objectPath.del(result, 'docs.' + a + '.data')
            }
          }
          objectPath.set(timelineItem, 'doc', objectPath.get(result, 'docs.' + a))
          timeline.push(timelineItem)
        }
      } else {
        // for (const f in result.docs) {
        //   const category = result.docs[f].category[0].coding[0].code
        //   const sub = base.categories.find(o => o.value === category)
        //   let schema = sub.uiSchema.flat()
        //   schema = await loadSelect('practitioners', 'performer', schema)
        //   if (category !== 'exam' && category !== 'vital-signs' && category !== 'social-history' && category !== 'all') {
        //     const category1 = Case.camel(category)
        //     const category2 = await fetchJSON(category1, opts.online)
        //     if (category === 'activity') {
        //       const a = []
        //       for (const b of category2) {
        //         a.push(b)
        //       }
        //       objectPath.set(select, category, a)
        //     }
        //     const observationsCodes = []
        //     let c1 = 0
        //     let d1 = ''
        //     const f1 = []
        //     for (const e1 of category2) {
        //       if (category === 'activity') {
        //         if (!f1.includes(objectPath.get(e1, 'CF_CODE10'))) {
        //           objectPath.set(observationsCodes, c1 + '.code', objectPath.get(e1, 'CF_CODE10'))
        //           f1.push(objectPath.get(e1, 'CF_CODE10'))
        //           if (objectPath.get(e1, 'Description') !== '') {
        //             d1 = objectPath.get(e1, 'Description') + ' | '
        //           } else {
        //             d1 = objectPath.get(e1, 'Common Term') + ' | '
        //           }
        //           d1 = d1 + objectPath.get(e1, 'REFID')
        //           objectPath.set(observationsCodes, c1 + '.display', d1)
        //           c1 = c1 + 1
        //         }
        //       } else {
        //         if (!objectPath.has(e1, 'span')) {
        //           if (objectPath.has(e1, 'a.small')) {
        //             objectPath.set(observationsCodes, c1 + '.code', objectPath.get(e1, 'a.small'))
        //             objectPath.set(observationsCodes, c1 + '.display', objectPath.get(e1, '#text'))
        //             c1 = c1 + 1
        //           }
        //         }
        //       }
        //     }
        //     schema = addSchemaOptions('code', observationsCodes, 'code', 'display', schema)
        //   }
        //   const objsItem = {}
        //   objectPath.set(objsItem, 'id', objectPath.get(result, 'docs.' + f + '.id'))
        //   objectPath.set(objsItem, 'title', fhirReplace('title', base, result.docs[f], schema))
        //   objectPath.set(objsItem, 'subtitle', objectPath.get(result, 'docs.' + f + '.' + base.timelineDate) + ', ' + title)
        //   objectPath.set(objsItem, 'content', fhirReplace('content', base, result.docs[f], schema))
        //   objectPath.set(objsItem, 'extended', fhirReplace('extended', base, result.docs[f], schema))
        //   objectPath.set(objsItem, 'status', fhirReplace('status', base, result.docs[f], schema))
        //   objectPath.set(objsItem, 'date', new Date(objectPath.get(result, 'docs.' + f + '.' + base.timelineDate)))
        //   objectPath.set(objsItem, 'icon', resource1.icon)
        //   objectPath.set(objsItem, 'resource', resource)
        //   objectPath.set(objsItem, 'doc', objectPath.get(result, 'docs.' + f))
        //   objectPath.set(objsItem, 'keys', base.fuse)
        //   objectPath.set(objsItem, 'style', base.uiListContent.contentStyle)
        //   observations.push(objsItem)
        // }
      }
    } catch (err) {
      console.log(err)
    }
  }
  const activitiesDb = new PouchDB(opts.prefix + 'activities')
  const activitiesResult = await activitiesDb.find({selector: {event: {$eq: 'Chart Created' }, _id: {"$gte": null}}})
  const timelineIntro = {
    id: 'intro',
    title: 'New Chart Created',
    subtitle: 'Timeline Starts Here',
    icon: 'celebration',
    date: null,
    content: [
      {key: 'Name', value: opts.patientName},
      {key: 'Date of Birth', value: opts.patientDOB},
      {key: 'Gender', value: opts.patientGender}
    ],
    style: 'p'
  }
  if (activitiesResult.docs.length > 0) {
    objectPath.set(timelineIntro, 'subtitle', moment(activitiesResult.docs[0].datetime).format("YYYY-MM-DD"))
    objectPath.set(timelineIntro, 'date', new Date(activitiesResult.docs[0].datetime))
    timeline.push(timelineIntro)
  }
  timeline.sort((c, d) => d.date - c.date)
  // observations.sort((g, h) => h.date - g.date)
  if (activitiesResult.docs.length == 0) {
    timeline.push(timelineIntro)
  }
  // Send the result back to the main thread
  console.log(timeline)
  return timeline
}