import axios from 'axios'
import Case from 'case'
import { reactive } from '@vue/reactivity'
import * as jose from 'jose'
import jsPDF from 'jspdf'
import fastDiff from 'fast-diff'
import moment from 'moment'
import objectPath from 'object-path'
import * as Papa from 'papaparse'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import comdb from 'comdb'
PouchDB.plugin(PouchDBFind)
PouchDB.plugin(comdb)
import {v4 as uuidv4} from 'uuid'
import { useAuthStore } from '@/stores'

export function common() {
  const addSchemaOptions = (id, arr, val, label, schema) => {
    var options = []
    for (var a of arr) {
      var b = {}
      if (a[val] !== undefined && a[val] !== 'notSelectable' ) {
        b.value = a[val]
        b.label = a[label]
        options.push(b)
      }
    }
    for (var c in schema) {
      if (Array.isArray(schema[c])) {
        for (var d in schema[c]) {
          if (id == schema[c][d].id) {
            objectPath.set(schema, c + '.' + d + '.options', options)
          }
        }
      } else {
        if (id == schema[c].id) {
          objectPath.set(schema, c + '.options', options)
        }
      }
    }
    return schema
  }
  const bundleBuild = async(entries, target, signature_data, patient_id) => {
    const id = 'nosh_' + uuidv4()
    const id1 = 'nosh_' + uuidv4()
    const time = moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    const bundleDoc = {
      '_id': id,
      'id': id,
      'resourceType': 'Bundle',
      'type': 'document',
      'timestamp': time
    }
    const signature = [{
      'type': [{
        'system': 'urn:iso-astm:E1762-95:2013',
        'code': '1.2.840.10065.1.12.1.1',
        'display': "Author's Signature"
      }],
      'when': signature_data.time,
      'who': {
        'reference': signature_data.reference
        // 'reference' : 'Practitioner/xcda-author'
      },
      'targetFormat': 'application/fhir',
      'sigFormat': 'application/json',
      'data': signature_data.data
    }]
    const provenanceDoc = {
      '_id': id1,
      'id': id1,
      'resourceType': 'Provenance',
      'target': [{reference: target}],
      'recorded': time,
      'signature': signature
    }
    await sync('provenances', false, patient_id, true, provenanceDoc)
    entries.push({resource: provenanceDoc})
    objectPath.set(bundleDoc, 'entry', entries)
    await sync('bundles', false, patient_id, true, bundleDoc)
    return bundleDoc
  }
  const divBuild = async(resource, doc) => {
    // create div
    var value = '<div xmlns="http://www.w3.org/1999/xhtml">'
    const base = await import('@/assets/fhir/' + resource + '.json')
    const schema = base.uiSchema.flat()
    var divContent = base.divContent
    const found = []
    var rxp = /{([^}]+)}/g, curMatch
    var replaceWith = []
    var mapping = {}
    var field = {}
    var modelRoot = ''
    while((curMatch = rxp.exec(divContent))) {
      found.push(curMatch[1])
    }
    for (var a in found) {
      field = schema.find(({ id }) => id === found[a])
      if (field !== undefined) {
        if (typeof field.modelRoot !== 'undefined') {
          if (field.modelArray == false) {
            modelRoot += field.modelRoot + '.' + field.model
          } else {
            modelRoot += field.modelRoot + '.0.' + field.model
          }
        } else {
          modelRoot += field.model
        }
        if (objectPath.has(doc, modelRoot)) {
          replaceWith[a] = objectPath.get(doc, modelRoot)
        } else {
          replaceWith[a] = ''
        }
      } else {
        replaceWith[a] = ''
      }
    }
    found.forEach((e,i) => mapping[`{${e}}`] = replaceWith[i])
    divContent = divContent.replace(/\{\w+\}/ig, n => mapping[n])
    value += divContent + '</div>'
    objectPath.set(doc, 'text.status', 'generated')
    objectPath.set(doc, 'text.div', value)
    return doc
  }
  const eventAdd = async(event, patient_id, opts={doc_db: null, doc_id: null, diff: null}) => {
    const auth_store = useAuthStore()
    const prefix = getPrefix()
    const db = new PouchDB(prefix + 'activities')
    // check if old version and destroy
    const check = await db.allDocs({include_docs: true})
    if (check.rows.length > 0) {
      for (var a of check.rows) {
        if (objectPath.has(a, 'doc.diff')) {
          db.destroy()
          const couchdb = auth_store.couchdb
          const auth = {fetch: (url, opts) => {
            opts.headers.set('Authorization', 'Bearer ' + auth_store.jwt)
            return PouchDB.fetch(url, opts)
          }}
          const destroy_remote = new PouchDB(couchdb + prefix + 'activities', auth)
          destroy_remote.destroy()
        }
      }
    }
    const db1 = new PouchDB(prefix + 'activities')
    // check if existing day event doc, otherwise create one
    const datetime = moment().startOf('day').unix()
    const datetime_formal = moment().startOf('day').format('YYYY-MM-DDTHH:mm:ss.SSSZ')
    const check1 = await db1.find({selector: {'datetime': {"$eq": datetime}}})
    if (check1.docs.length > 0) {
      var doc = check1.docs[0]
    } else {
      var doc = {
        _id: 'nosh_' + uuidv4(),
        datetime: datetime,
        datetime_formal: datetime_formal,
        events: []
      }
    }
    const event_item = {
      event: event,
      datetime: moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
      user: auth_store.user.display,
      user_id: auth_store.user.id,
      doc_db: opts.doc_db,
      doc_id: opts.doc_id,
      diff: opts.diff
    }
    doc.events.push(event_item)
    await db1.put(doc)
    await sync('activities', false, patient_id)
  }
  const fetchJSON = async(type, online) => {
    if (localStorage.getItem(type) === null) {
      if (online) {
        var a = await axios.get(window.location.origin + '/fetch/' + type)
        localStorage.setItem(type, JSON.stringify(a.data))
        return a.data
      }
    } else {
      return JSON.parse(localStorage.getItem(type))
    }
  }
  const fetchTXT = async(type, online) => {
    if (localStorage.getItem(type) === null) {
      if (online) {
        var url = window.location.origin + '/fetch/' + type + '/txt'
        var a = await axios.get(url)
        var b = Papa.parse(a.data)
        if (type === 'cvx') {
          var c = b.data.filter(item => (item[4] == 'Active'))
          localStorage.setItem(type, JSON.stringify(c))
          return c
        } else if (type === 'cvx_vis') {
          var d = b.data.filter(item => (item[5] == 'Current'))
          localStorage.setItem(type, JSON.stringify(d))
          return d
        } else {
          localStorage.setItem(type, JSON.stringify(b))
          return b
        }
      }
    } else {
      return JSON.parse(localStorage.getItem(type))
    }
  }
  const fhirDisplay = (field, index='0') => {
    var model = field.display
    if (typeof field.modelParent !== 'undefined') {
      model = field.modelParent + '.0.'
      if (typeof field.modelRoot !== 'undefined') {
        if (field.modelArray == false) {
          model += field.modelRoot + '.' + field.display
        } else {
          if (field.multiple == true) {
            model += field.modelRoot + '.' + index + '.' + field.display
          } else {
            model += field.modelRoot + '.0.' + field.display
          }
        }
      }
    } else {
      if (typeof field.modelRoot !== 'undefined') {
        if (field.modelArray == false) {
          model = field.modelRoot + '.' + field.display
        } else {
          if (field.multiple == true) {
            model = field.modelRoot + '.' + index + '.' + field.display
          } else {
            model = field.modelRoot + '.0.' + field.display
          }
        }
      }
    }
    return model
  }
  const fhirModel = (field) => {
    var model = field.model
    if (typeof field.modelParent !== 'undefined') {
      model = field.modelParent + '.0.'
      if (typeof field.modelRoot !== 'undefined') {
        if (field.modelArray == false) {
          model += field.modelRoot + '.' + field.model
        } else {
          if (field.multiple == true) {
            model += field.modelRoot
          } else {
            model += field.modelRoot + '.0.' + field.model
          }
        }
      }
    } else {
      if (typeof field.modelRoot !== 'undefined') {
        if (field.modelArray == false) {
          model = field.modelRoot + '.' + field.model
        } else {
          if (field.multiple == true) {
            model = field.modelRoot
          } else {
            model = field.modelRoot + '.0.' + field.model
          }
        }
      }
    }
    return model
  }
  const fhirReplace = (key, base, result, uiSchema) => {
    var row = base.uiListContent[key]
    var str = ''
    var field = ''
    var model = ''
    if (key === 'content') {
      var models = []
      for (var a in base.uiListContent.contentFields) {
        field = uiSchema.find(({ id }) => id === base.uiListContent.contentFields[a])
        if (field !== undefined) {
          model = fhirModel(field)
          var obj = {}
          if (objectPath.has(result, model)) {
            obj['key'] = field.label
            obj['value'] = objectPath.get(result, model)
            if (typeof field.modelOne !== 'undefined') {
              if (objectPath.has(result, model + '.' + field.modelOne + '.' + field.modelEnd)) {
                obj['value'] = objectPath.get(result, model + '.' + field.modelOne + '.' + field.modelEnd)
              }
              if (objectPath.has(result, model + '.' + field.modelRange[0] + '.' + field.modelEnd)) {
                obj['value'] = objectPath.get(result, model + '.' + field.modelRange[0] + '.' + field.modelEnd)
                obj['value'] += ' to '
                obj['value'] += objectPath.get(result, model + '.' + field.modelRange[1] + '.' + field.modelEnd)
              }
            }
            if (typeof field.modelChoice !== 'undefined') {
              for (var b in field.modelChoice) {
                if (objectPath.has(result, model + '.' + field.modelChoice[b] + '.' + field.modelEnd)) {
                  obj['value'] = objectPath.get(result, model + '.' + field.modelChoice[b] + '.' + field.modelEnd)
                }
              }
            }
            if (typeof field.text !== 'undefined') {
              if (objectPath.has(result, model + '.' + field.text)) {
                obj['value'] = objectPath.get(result, model + '.' + field.text)
              }
            }
            if (obj['value'] !== undefined && obj['value'] !== '') {
              if (typeof field.options !== 'undefined') {
                if (field.multiple === true) {
                  if (Array.isArray(obj['value'])) {
                    var value = ''
                    for (var c in obj['value']) {
                      var d = {}
                      if (typeof field.modelRoot !== 'undefined') {
                        d = field.options.find(({ value }) => value === objectPath.get(obj['value'], c + '.' + field.model))
                      } else {
                        d = field.options.find(({ value }) => value === obj['value'][c])
                      }
                      if (c !== '0') {
                        value += '; '
                      }
                      if (d !== undefined) {
                        value += d.label
                      } else {
                        if (objectPath.has(field, 'display')) {
                          var displayModel = fhirDisplay(field, c)
                          value += objectPath.get(result, displayModel)
                        } else {
                          value += obj['value']
                        }
                      }
                    }
                    obj['value'] = value
                  } else {
                    var e = field.options.find(({ value }) => value === obj['value'])
                    if (e !== undefined) {
                      obj['value'] = e.label
                    } else {
                      if (objectPath.has(field, 'display')) {
                        var displayModel1 = fhirDisplay(field)
                        obj['value'] = objectPath.get(result, displayModel1)
                      }
                    }
                  }
                } else {
                  var f = field.options.find(({ value }) => value === obj['value'])
                  if (f !== undefined) {
                    obj['value'] = f.label
                  } else {
                    if (objectPath.has(field, 'display')) {
                      var displayModel2 = fhirDisplay(field)
                      obj['value'] = objectPath.get(result, displayModel2)
                    }
                  }
                }
              }
              if (base.fhir.resourceType == 'Composition' && field.id == 'text') {
                obj['value'] = removeTags(obj['value'])
              }
              models.push(obj)
            } else {
              if (model.split('.').slice(-2).join('.') === 'coding.0.display') {
                var alt_model = model.replace('coding.0.display', 'text')
                if (objectPath.has(result, alt_model)) {
                  obj['value'] = objectPath.get(result, alt_model)
                } else {
                  obj['value'] = ''
                }
              } else {
                obj['value'] = ''
              }
            }
          }
        }
      }
      return models
    } else {
      var found = []
      var rxp = /{([^}]+)}/g
      var curMatch
      var replaceWith = []
      var mapping = {}
      str = row
      while((curMatch = rxp.exec(str))) {
        found.push(curMatch[1])
      }
      for (var g in found) {
        field = uiSchema.find(({ id }) => id === found[g])
        model = fhirModel(field)
        if (objectPath.has(result, model)) {
          replaceWith[g] = objectPath.get(result, model)
          if (typeof field.options !== 'undefined') {
            if (field.multiple === true) {
              if (Array.isArray(replaceWith[g])) {
                var value = ''
                for (var h in replaceWith[g]) {
                  var i = {}
                  if (typeof field.modelRoot !== 'undefined') {
                    i = field.options.find(({ value }) => value === replaceWith[g][h][field.model])
                  } else {
                    i = field.options.find(({ value }) => value === replaceWith[g][h])
                  }
                  if (h !== '0') {
                    value += '; '
                  }
                  value += i.label
                }
                replaceWith[g] = value
              } else {
                var j = field.options.find(({ value }) => value === replaceWith[g])
                replaceWith[g] = j.label
              }
            } else {
             var k = field.options.find(({ value }) => value === replaceWith[g])
              replaceWith[g] = k.label
            }
          }
        } else {
          if (model.split('.').slice(-3).join('.') === 'coding.0.display') {
            var alt_model = model.replace('coding.0.display', 'text')
            if (objectPath.has(result, alt_model)) {
              replaceWith[g] = objectPath.get(result, alt_model)
            }
          }
          if (replaceWith[g] === undefined) {
            if (objectPath.has(field, 'alt_model')) {
              var alt_model1 = objectPath.get(field, 'alt_model')
              if (objectPath.has(result, alt_model1)) {
                replaceWith[g] = objectPath.get(result, alt_model1)
              } else {
                replaceWith[g] = 'Not Defined'
              }
            } else {
              replaceWith[g] = 'Not Defined'
            }
          }
        }
      }
      found.forEach((e,i) => mapping[`{${e}}`] = replaceWith[i])
      str = str.replace(/\{\w+\}/ig, n => mapping[n])
      return str
    }
  }
  const getPrefix = () => {
    const auth_store = useAuthStore()
    return auth_store.prefix
  }
  const getResource = async(resource, arr) => {
    const prefix = getPrefix()
    const resourceDB = new PouchDB(prefix + resource)
    var result = await resourceDB.allDocs({
      include_docs: true,
      attachments: true,
      startkey: 'nosh_',
    })
    if (result.rows.length > 0) {
      for (var a of result.rows) {
        console.log(a)
        var label = 'No name'
        if (objectPath.has(a, 'doc.text.div')) {
          label = removeTags(a.doc.text.div)
        }
        arr.push({
          val: Case.pascal(pluralize.singular(resource)) + '/' + a.doc.id,
          label: label
        })
      }
    }
    return arr
  }
  const getSignedEncounters = async(yearback="100") => {
    const auth_store = useAuthStore()
    const prefix = getPrefix()
    var ret = []
    const encountersDB = new PouchDB(prefix + 'encounters')
    const period = moment().subtract(yearback, 'year').format('YYYY-MM-DD')
    const encountersResult = await encountersDB.find({selector: {'subject.reference': {$eq: 'Patient/' + auth_store.patient }, 'period.start': { "$gte": period }, _id: {"$gte": null}}})
    if (encountersResult.docs.length > 0) {
      for (var a of encountersResult.docs) {
        const bundlesDB = new PouchDB(prefix + 'bundles')
        const bundlesResult = await bundlesDB.find({selector: {'entry.0.resource.encounter.reference': {$eq: 'Encounter/' + a.id}, _id: {"$gte": null}}})
        if (bundlesResult.docs.length > 0) {
          bundlesResult.docs.sort((b, c) => moment(c.timestamp) - moment(b.timestamp))
          ret.push(bundlesResult.docs[0])
        }
      }
    }
    return ret
  }
  const getValue = (object, path) => {
    let path_arr = path.split('.')
    return path_arr.reduce((tmp, key) => {
        return tmp[key]
    }, object)
  }
  const groupItems = (array, path) => {
    return array.reduce((groups, item) => {
        var name = getValue(item, path)
        var group = groups[name] || (groups[name] = [])
        group.push(item)
        return groups;
    }, { })
  }
  const historyDXMatch = async(needle_arr) => {
    var ret = []
    var bundles = await getSignedEncounters()
    if (bundles.length > 0) {
      for (var bundle of bundles) {
        var a = bundle.entry.filter(d => d.resource.resourceType === 'Condition')
        if (a.length > 0) {
          for (var dx of needle_arr) {
            var c = a.find(b => b.code.coding[0].code.includes(dx))
            if (c !== undefined) {
              ret.push(bundle)
            }
          }
        }
      }
    }
    return ret
  }
  const importFHIR = async(doc, resource, patient, origin) => {
    if (resource !== 'practitioners' && resource !== 'related_persons') {
      const id = 'nosh_' + uuidv4()
      objectPath.set(doc, 'sync_id', objectPath.get(doc, 'id'))
      objectPath.set(doc, 'id', id)
      objectPath.set(doc, '_id', id)
      if (resource === 'observations') {
        if (!objectPath.has(doc, 'effectivePeriod.start')) {
          objectPath.set(doc, 'effectivePeriod.start', objectPath.get(doc, 'effectiveDateTime'))
        }
        if (objectPath.has(doc, 'performer.0.reference')) {
          if (objectPath.get(doc, 'performer.0.reference').search('Practitioner') === 0) {
            const nosh_id = await referenceSearch('practitioners', objectPath.get(doc, 'performer.0.reference').split('/').slice(-1).join(''))
            if (nosh_id === null) {
              const reference_new_id = await importReference('practitioners', objectPath.get(doc, 'performer.0.reference').split('/').slice(-1).join(''), origin)
              objectPath.set(doc, 'performer.0.reference', 'Practitioner/' + reference_new_id)
            } else {
              objectPath.set(doc, 'performer.0.reference', 'Practitioner/' + nosh_id)
            }
          }
        }
      }
      if (resource === 'encounters') {
        if (objectPath.has(doc, 'participant')) {
          for (var b in objectPath.get(doc, 'participant')) {
            if (objectPath.get(doc, 'participant.' + b + '.individual.reference').search('Practitioner') === 0) {
              const nosh_id1 = await referenceSearch('practitioners', objectPath.get(doc, 'participant.' + b + '.individual.reference').split('/').slice(-1).join(''))
              if (nosh_id1 === null) {
                const reference_new_id1 = await importReference('practitioners', objectPath.get(doc, 'participant.' + b + '.individual.reference').split('/').slice(-1).join(''), origin)
                objectPath.set(doc, 'participant.' + b + '.individual.reference', 'Practitioner/' + reference_new_id1)
              } else {
                objectPath.set(doc, 'participant.' + b + '.individual.reference', 'Practitioner/' + nosh_id1)
              }
            }
          }
        }
      }
      if (resource === 'document_references') {
        if (objectPath.has(doc, 'content')) {
          for (var c in objectPath.get(doc, 'content')) {
            if (objectPath.has(doc, 'content.' + c + '.attachment.contentType')) {
              if (objectPath.get(doc, 'content.' + c + '.attachment.contentType').includes('text/plain')) {
                var doc0 = new jsPDF()
                doc0.text(objectPath.get(doc, 'content.' + c + '.attachment.data'), 10, 10)
                const pdf = doc0.output('datauristring')
                objectPath.set(doc, 'content.' + c + '.attachment.contentType', pdf.substr(pdf.indexOf(':') + 1, pdf.indexOf(';') - pdf.indexOf(':') - 1))
                objectPath.set(doc, 'content.' + c + '.attachment.data', pdf.substr(pdf.indexOf(',') + 1))
              }
              if (objectPath.get(doc, 'content.' + c + '.attachment.contentType').includes('image')) {
                var img = new Image()
                img.onload = () => {
                  var doc1 = new jsPDF('p', 'px', 'a4')
                  doc1.addImage(objectPath.get(doc, 'content.' + c + '.attachment.data'), 10, 10, img.width, img.height)
                  const pdf1 = doc1.output('datauristring')
                  objectPath.set(doc, 'content.' + c + '.attachment.contentType', pdf1.substr(pdf1.indexOf(':') + 1, pdf1.indexOf(';') - pdf1.indexOf(':') - 1))
                  objectPath.set(doc, 'content.' + c + '.attachment.data', pdf1.substr(pdf1.indexOf(',') + 1))
                }
                img.src = objectPath.get(doc, 'content.' + c + '.attachment.data')
              }
            }
          }
        }
      }
      if (resource === 'immunizations' ||
          resource === 'allergy_intolerances' ||
          resource === 'related_persons') {
        objectPath.set(doc, 'patient.reference', 'Patient/' + patient)
      } else if (resource === 'tasks') {
        objectPath.set(doc, 'for.reference', 'Patient/' + patient)
      } else {
        if (resource !== 'practitioners' &&
            resource !== 'organizations' &&
            resource !== 'appointments' &&
            resource !== 'users' &&
            resource !== 'patients') {
          objectPath.set(doc, 'subject.reference', 'Patient/' + patient)
        }
      }
      await sync(resource, false, patient, true, doc)
    }
  }
  const importReference = async(resource, reference_id, origin) => {
    const auth_store = useAuthStore()
    const oidc = auth_store.oidc
    const a = oidc.findIndex(b => b.origin == origin)
    const c = oidc[a].docs.findIndex(d => d.resource == resource)
    const e = oidc[a].docs[c].rows.findIndex(f => f.id == reference_id)
    if (e !== -1) {
      const reference_doc = objectPath.get(oidc, a + '.docs.' + c + '.rows.' + e)
      const reference_new_id = 'nosh_' + uuidv4()
      objectPath.set(reference_doc, 'sync_id', objectPath.get(reference_doc, 'id'))
      objectPath.set(reference_doc, 'id', reference_new_id)
      objectPath.set(reference_doc, '_id', reference_new_id)
      if (!objectPath.has(reference_doc, 'text.div')) {
        reference_doc = await divBuild(resource, reference_doc)
      }
      await sync(resource, false, props.patient, true, reference_doc)
      var a1 = oidc.findIndex(b1 => b1.origin == origin)
      var c1 = oidc[a].docs.findIndex(d1 => d1.resource == resource)
      objectPath.del(oidc, a1 + '.docs.' + c1 + '.rows.' + index)
      auth.setOIDC(oidc)
      return reference_new_id
    }
  }
  const inbox = async(resource, user) => {
    const prefix = getPrefix()
    const localDB = new PouchDB(prefix + resource)
    var result = {}
    if (resource === 'communications') {
      var docs_arr = []
      const a = await localDB.query((doc, emit) => {
        if (doc.status == 'in-progress') {
          for (let recipient of doc.recipient) {
            if (recipient.reference == user.reference) {
              emit(recipient)
            }
          }
        }
      })
      for (var b of a.rows) {
        var c = await localDB.get(b.id)
        docs_arr.push(c)
      }
      var withReply = docs_arr.filter(d => d.inResponseTo !== undefined)
      var single = docs_arr.filter(e => e.inResponseTo === undefined)
      var grouped = groupItems(withReply, 'inResponseTo.reference')
      var keys = Object.keys(grouped)
      keys.forEach(key => {
        grouped[key].sort((f, g) => moment(g.sent) - moment(f.sent))
        single.push(grouped[key][0])
      })
      objectPath.set(result, 'docs', single)
    } else {
      var subselectors = []
      var ors = []
      var options = ['draft','requested','received','accepted','ready','in-progress','on-hold']
      for (var option of options) {
        ors.push({'status': {$eq: option}})
      }
      subselectors.push({'owner.reference': {$eq: user.reference}})
      subselectors.push({$or: ors})
      subselectors.push({_id: {"$gte": null}})
      var selector = {$and: subselectors}
      result = await localDB.find({selector: selector})
    }
    return result
  }
  const loadSchema = async(resource, category, schema, online, options) => {
    const prefix = getPrefix()
    var countries = []
    var select = {}
    var states = []
    if (resource === 'immunizations') {
      var actSites = await fetchJSON('actSites', online)
      schema = addSchemaOptions('site', actSites.concept[0].concept[0].concept, 'code', 'display', schema)
    }
    if (resource === 'medication_statements') {
      var doseform = await fetchJSON('doseform', online)
      var routes = await fetchJSON('routes', online)
      schema = addSchemaOptions('doseUnit', doseform.concept, 'code', 'display', schema)
      schema = addSchemaOptions('route', routes, 'code', 'desc', schema)
    }
    if (resource === 'conditions' ||
        resource === 'allergy_intolerances' ||
        resource === 'medication_statements' ||
        resource === 'tasks') {
      options = setOptions()
    }
    if (resource === 'patients' ||
        resource === 'practitioners' ||
        resource === 'related_persons' ||
        resource === 'organizations' ||
        resource === 'insurance_plans') {
      countries = await fetchJSON('countries', online)
      states = await fetchJSON('states', online)
      schema = addSchemaOptions('country', countries, 'iso2', 'name', schema)
    }
    if (resource === 'patients' ||
        resource === 'related_persons' ||
        resource === 'practitioners') {
      var language = await fetchJSON('language', online)
      schema = addSchemaOptions('language', language, 'alpha2', 'English', schema)
    }
    if (resource === 'patients') {
      var ethnicity = await fetchJSON('ethnicity', online)
      schema = addSchemaOptions('ethnicity', ethnicity, 'Code', 'Display', schema)
      var race = await fetchJSON('race', online)
      schema = addSchemaOptions('race', race, 'Code', 'Display', schema)
    }
    if (resource === 'related_persons') {
      var relationship = await fetchJSON('relationship', online)
      schema = addSchemaOptions('relationship', relationship, 'Code', 'Display', schema)
    }
    if (resource === 'encounters' || resource === 'appointments') {
      var serviceTypes = await fetchJSON('serviceTypes', online)
      schema = addSchemaOptions('serviceType', serviceTypes, 'Code', 'Display', schema)
    }
    if (resource === 'appointments') {
      var serviceCategories = await fetchJSON('serviceCategories', online)
      schema = addSchemaOptions('serviceCategory', serviceCategories, 'Code', 'Display', schema)
      schema = await loadSelect('patients', 'patient', schema)
      schema = await loadSelect('practitioners', 'practitioner', schema)
    }
    if (resource === 'encounters') {
      var encounterTypes = await fetchJSON('encounterTypes', online)
      schema = addSchemaOptions('type', encounterTypes, 'Code', 'Display', schema)
      schema = await loadSelect('practitioners', 'participant', schema)
    }
    if (resource === 'practitioners') {
      var degrees = await fetchJSON('degrees', online)
      schema = addSchemaOptions('degree', degrees.concept, 'code', 'display', schema)
    }
    if (resource === 'document_references') {
      var docTypeCodes = await fetchJSON('docTypeCodes', online)
      var docClassCodes = await fetchJSON('docClassCodes', online)
      schema = addSchemaOptions('type', docTypeCodes, 'Code', 'Display', schema)
      schema = addSchemaOptions('category', docClassCodes, 'Code', 'Display', schema)
    }
    if (resource === 'users') {
      var encounterTypes = await fetchJSON('encounterTypes', online)
      schema = addSchemaOptions('type', encounterTypes, 'Code', 'Display', schema)
      var serviceTypes = await fetchJSON('serviceTypes', online)
      schema = addSchemaOptions('serviceType', serviceTypes, 'Code', 'Display', schema)
      var serviceCategories = await fetchJSON('serviceCategories', online)
      schema = addSchemaOptions('serviceCategory', serviceCategories, 'Code', 'Display', schema)
      var compType = await fetchJSON('compType', online)
      schema = addSchemaOptions('code', compType, 'Code', 'Display', schema)
      var docClassCodes = await fetchJSON('docClassCodes', online)
      schema = addSchemaOptions('category', docClassCodes, 'Code', 'Display', schema)
    }
    if (resource === 'observations') {
      schema = await loadSelect('practitioners', 'performer', schema)
      if (category !== 'exam' && category !== 'vital-signs' && category !== 'social-history' && category !== 'all') {
        var category1 = Case.camel(category)
        var category2 = await fetchJSON(category1, online)
        if (category === 'activity') {
          var a = []
          for (var b of category2) {
            a.push(b)
          }
          objectPath.set(select, category, a)
        }
        var observationsCodes = []
        var c = 0
        var d = ''
        var f = []
        for (var e of category2) {
          if (category === 'activity') {
            if (!f.includes(objectPath.get(e, 'CF_CODE10'))) {
              objectPath.set(observationsCodes, c + '.code', objectPath.get(e, 'CF_CODE10'))
              f.push(objectPath.get(e, 'CF_CODE10'))
              if (objectPath.get(e, 'Description') !== '') {
                d = objectPath.get(e, 'Description') + ' | '
              } else {
                d = objectPath.get(e, 'Common Term') + ' | '
              }
              d = d + objectPath.get(e, 'REFID')
              objectPath.set(observationsCodes, c + '.display', d)
              c = c + 1
            }
          } else {
            if (!objectPath.has(e, 'span')) {
              if (objectPath.has(e, 'a.small')) {
                objectPath.set(observationsCodes, c + '.code', objectPath.get(e, 'a.small'))
                objectPath.set(observationsCodes, c + '.display', objectPath.get(e, '#text'))
                c = c + 1
              }
            }
          }
        }
        schema = addSchemaOptions('code', observationsCodes, 'code', 'display', schema)
      }
    }
    if (resource === 'compositions') {
      var compSection = await fetchJSON('compSection', online)
      var compType = await fetchJSON('compType', online)
      var docClassCodes = await fetchJSON('docClassCodes', online)
      schema = addSchemaOptions('code', compType, 'Code', 'Display', schema)
      schema = addSchemaOptions('category', docClassCodes, 'Code', 'Display', schema)
      schema = await loadSelect('practitioners', 'author', schema)
      schema = await loadSelect('practitioners', 'section_author', schema)
      for (var g of compSection) {
        if (g.Code !== undefined && g.Code !== 'notSelectable') {
          if (objectPath.has(g, 'Common')) {
            options.push({
              label: g.Display,
              value: g.Code,
              doc: {},
              resource: 'compositions'
            })
          }
        }
      }
      options.push({
        label: 'Other',
        value: 'other',
        doc: {},
        resource: 'compositions'
      })
    }
    if (resource === 'care_plans') {
      var outcomeTypes = await fetchJSON('outcomeTypes', online)
      schema = addSchemaOptions('outcome', outcomeTypes, 'Code', 'Display', schema)
      options = []
      options.push({
        label: 'New Condition',
        value: 'add',
        doc: {},
        resource: 'conditions'
      })
      const conditionsDB = new PouchDB(prefix + 'conditions')
      var result = await conditionsDB.allDocs({
        include_docs: true,
        attachments: true,
        startkey: 'nosh_',
      })
      for (var h of result.rows) {
        options.push({
          label: h.doc.code.coding[0].display + ' [' + h.doc.code.coding[0].code + ']',
          value: h.doc.id,
          doc: h.doc,
          resource: 'conditions'
        })
      }
    }
    if (resource === 'service_requests') {
      schema = await loadSelect('practitioners', 'requester', schema)
      options = [
        {"value": "draft", "label": "Draft"},
        {"value": "active", "label": "Active"},
        {"value": "on-hold", "label": "On Hold"},
        {"value": "revoked", "label": "Revoked"},
        {"value": "completed", "label": "Completed"},
        {"value": "entered-in-error", "label": "Entered In Error"},
        {"value": "unknown", "label": "Unknown"}
      ]
    }
    if (resource === 'communications') {
      schema = await loadSelect(['practitioners','patients','related_persons'], 'recipients', schema)
    }
    if (resource === 'tasks') {
      options = [
        {"value": "draft", "label": "Draft"},
        {"value": "requested", "label": "Requested"},
        {"value": "received", "label": "Received"},
        {"value": "accepted", "label": "Accpted"},
        {"value": "rejected", "label": "Rejected"},
        {"value": "ready", "label": "Ready"},
        {"value": "cancelled", "label": "Cancelled"},
        {"value": "in-progress", "label": "In Progress"},
        {"value": "on-hold", "label": "On Hold"},
        {"value": "failed", "label": "Failed"},
        {"value": "completed", "label": "Completed"},
        {"value": "entered-in-error", "label": "Entered in Error"}
      ]
      schema = await loadSelect('practitioners', 'owner', schema)
    }
    return {schema: schema, options: options, select: select, states: states, countries: countries}
  }
  const loadSelect = async(resource, id, schema) => {
    var arr = []
    if (Array.isArray(resource)) {
      for (var resource0 of resource) {
        arr = await getResource(resource0, arr)
      }
    } else {
      arr = await getResource(resource, arr)
    }
    if (arr.length > 0) {
      schema = addSchemaOptions(id, arr, 'val', 'label', schema)
    }
    return schema
  }
  const observationResult = async(code, patient) => {
    const prefix = getPrefix()
    var res = ''
    const observationDB = new PouchDB(prefix + 'observations')
    const result = await observationDB.find({selector: {
      'subject.reference': {$eq: 'Patient/' + patient },
      'code.coding.0.code': {$eq: code},
      _id: {"$gte": null}}})
    if (result.docs.length > 0) {
      result.docs.sort((b, c) => moment(c.effectivePeriod.start) - moment(b.effectivePeriod.start))
      if (objectPath.has(result, 'docs.0.valueQuantity.value')) {
        res = objectPath.get(result, 'docs.0.valueQuantity.value')
      }
    }
    return res
  }
  const observationStatus = async(type, patient, boolean=false, unknown=false) => {
    const prefix = getPrefix()
    var map = [
      {
        type: 'pregnancy',
        search: '82810-3',
        positive: ['LA15173-0']
      },
      {
        type: 'tobacco',
        search: '72166-2',
        positive: ['LA18976-3','LA18977-1','LA18979-7','LA18981-3', 'LA18982-1']
      },
      {
        type: 'sexually_active',
        search: '86648-3',
        positive: ['LA33-6']
      }
    ]
    var item = map.find(a => a.type === type)
    if (unknown === true) {
      var ret = 'U'
    } else {
      var ret = 'N'
    }
    const observationDB = new PouchDB(prefix + 'observations')
    const result = await observationDB.find({selector: {
      'subject.reference': {$eq: 'Patient/' + patient },
      'code.coding.0.code': {$eq: item.search},
      _id: {"$gte": null}}})
    if (result.docs.length > 0) {
      result.docs.sort((b, c) => moment(c.effectivePeriod.start) - moment(b.effectivePeriod.start))
      if (objectPath.has(result, 'docs.0.valueCodableConcept.coding.0.code')) {
        if (item.positive.includes(objectPath.get(result, 'docs.0.valueCodableConcept.coding.0.code'))) {
          ret = 'Y'
        } else {
          ret = 'N'
        }
      }
    }
    if (boolean) {
      if (ret === 'N') {
        return false
      } else {
        return true
      }
    } else {
      return ret
    }
  }
  const observationStatusRaw = async(type, patient) => {
    const prefix = getPrefix()
    var map = [
      {
        type: 'pregnancy',
        search: '82810-3'
      },
      {
        type: 'tobacco',
        search: '72166-2'
      },
      {
        type: 'sexually_active',
        search: '86648-3'
      }
    ]
    var item = map.find(a => a.type === type)
    var ret = {}
    const observationDB = new PouchDB(prefix + 'observations')
    const result = await observationDB.find({selector: {
      'subject.reference': {$eq: 'Patient/' + patient },
      'code.coding.0.code': {$eq: item.search},
      _id: {"$gte": null}}})
    if (result.docs.length > 0) {
      result.docs.sort((b, c) => moment(c.effectivePeriod.start) - moment(b.effectivePeriod.start))
      if (objectPath.has(result, 'docs.0.valueCodableConcept.coding.0.code')) {
        ret = objectPath.get(result, 'docs.0.valueCodableConcept.coding.0')
      }
    }
    return ret
  }
  const patientList = async(user) => {
    var arr = []
    const patientDB = new PouchDB('patients')
    const patientList = await patientDB.find({selector: {_id: {$regex: '^nosh_*'}}})
    for (var a in patientList.docs) {
      arr.push({
        name: removeTags(patientList.docs[a].text.div),
        url: location.protocol + '//' + location.host + '/app/chart/' + patientList.docs[a].id,
        id: patientList.docs[a].id
      })
    }
    if (objectPath.has(user, 'charts')) {
      for (var b in user.charts) {
        var c = arr.find(d => d.id === user.charts[b].id)
        if (c === -1) {
          arr.push(user.charts[b])
        }
      }
    }
    return arr
  }
  const patientStatus = async(type, patient, boolean=false) => {
    const prefix = getPrefix()
    var map = [
      {
        type: 'race',
        field: 'extension.0.extension',
        default: 'white',
        positive: ['2054-5']
      }
    ]
    var item = map.find(a => a.type === type)
    var ret = item.default
    const patientDB = new PouchDB(prefix + 'patients')
    const result = await patientDB.find({selector: {
      'id': {$eq: patient },
      [item.field]: {"$gte": null},
      _id: {"$gte": null}}})
    if (result.docs.length > 0) {
      for (var b of item.positive) {
        if (Array.isArray(objectPath.get(result, 'docs.0.' + item.field))) {
          var c = objectPath.get(result, 'docs.0.' + item.field)
          var e = c.find(d => d.valueCoding.code == b)
          if (e !== undefined) {
            ret = 'africanAmerican'
          }
        }
      }
    }
    return ret
  }
  const referenceSearch = async(resource, id) => {
    const prefix = getPrefix()
    const db = new PouchDB(prefix + resource)
    var results = await db.find({
      selector: {'sync_id': {$eq: id}, _id: {"$gte": null}}
    })
    if (results.docs.length > 0) {
      return objectPath.get(results, 'docs.0.id')
    } else {
      return null
    }
  }
  const removeTags = (str) => {
    if ((str===null) || (str==='')) {
      return false
    } else {
      str = str.toString()
      return str.replace( /(<([^>]+)>)/ig, '')
    }
  }
  const setOptions = () => {
    return [
      {
        label: 'All',
        value: 'all'
      },
      {
        label: 'Active',
        value: 'active'
      },
      {
        label: 'Inactive',
        value: 'inactive'
      }
    ]
  }
  const sleep = async(seconds) => {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
  const sync = async(resource, online, patient_id, save=false, data={}, destroy=false) => {
    const auth_store = useAuthStore()
    const couchdb = auth_store.couchdb
    const auth = {fetch: (url, opts) => {
      opts.headers.set('Authorization', 'Bearer ' + auth_store.jwt)
      return PouchDB.fetch(url, opts)
    }}
    const pin = auth_store.pin
    const prefix = getPrefix()
    const local = new PouchDB(prefix + resource)
    if (save) {
      var prev_data = ''
      var diff = null
      try {
        const prev = await local.get(data._id)
        prev_data = JSON.stringify(prev)
      } catch (e) {
        console.log('New Document!')
      }
      const result = await local.put(data)
      if (prev_data !== '') {
        diff = fastDiff(prev_data, JSON.stringify(data))
      }
      const opts = {
        doc_db: resource,
        doc_id: result.id,
        diff: diff
      }
      if (resource === 'users' && data.id === auth_store.user.id) {
        auth_store.update(data)
      }
      auth_store.setSyncResource(resource)
      await eventAdd('Updated ' + pluralize.singular(resource.replace('_statements', '')), patient_id, opts)
    }
    if (online) {
      if (resource !== 'users' && resource !== 'presentations') {
        try {
          await local.setPassword(pin, {name: couchdb + prefix + resource, opts: auth})
          var info = await local.info()
          try {
            if (info.doc_count > 0) {
              await local.loadDecrypted({batch_size: 20})
            }
            try {
              await local.loadEncrypted({batch_size: 20, batches_limit: 2})
              console.log('PouchDB encrypted sync complete for DB: ' + resource )
            } catch (e) {
              console.log(e)
            }
          } catch (e) {
            console.log(e)
          }
        } catch (e) {
          console.log(e)
        }
      } else {
        const remote = new PouchDB(couchdb + prefix + resource, auth)
        local.sync(remote,{batch_size: 50, batches_limit: 5}).on('complete', () => {
          console.log('PouchDB sync complete for DB: ' + resource)
        }).on('error', (err) => {
          console.log(err)
        })
      }
    }
    if (destroy) {
      if (resource !== 'users' && resource !== 'presentations') {
        await local.setPassword(pin, {name: couchdb + prefix + resource, opts: auth})
      }
      await local.destroy()
      // if (resource === 'users' || resource === 'presentations') {
        const destroy_remote = new PouchDB(couchdb + prefix + resource, auth)
        await destroy_remote.destroy()
      // }
      const new_local = new PouchDB(prefix + resource)
      await new_local.info()
      const new_destroy_remote = new PouchDB(couchdb + prefix + resource, auth)
      await new_destroy_remote.info()
      console.log('PouchDB destroy and sync complete for DB: ' + resource)
    }
  }
  const syncAll = async(online, patient_id) => {
    var resources = await fetchJSON('resources', online)
    objectPath.set(syncState, 'total', resources.rows.length)
    objectPath.set(syncState, 'complete', 0)
    for (var resource of resources.rows) {
      objectPath.set(syncTooltip, 'text', 'Syncing ' + Case.title(resource.resource) + '...')
      await sync(resource.resource, online, patient_id, false, {})
      objectPath.set(syncState, 'complete', objectPath.get(syncState, 'complete') + 1)
    }
    await sleep(5)
  }
  const syncEmailToUser = async(resource, category, doc, patient_id) => {
    const prefix = getPrefix()
    if (resource === 'patients' ||
        resource === 'practitioners' ||
        resource === 'related_persons') {
      const db_users = new PouchDB(prefix + 'users')
      const result_users = await db_users.find({selector: {'reference': {$eq: Case.pascal(pluralize.singular(resource)) + '/' + doc.id}}})
      if (result_users.docs.length > 0) {
        if (category === 'telecom') {
          var a = doc[category].find(b => b.system == 'email')
          if (a !== undefined) {
            if (result_users.docs[0].email !== a.value) {
              result_users.docs[0].email = a.value
              await sync('users', false, patient_id, true, result_users.docs[0])
            }
          }
        }
        if (category === 'identity') {
          var c = removeTags(doc.text.div)
          if (result_users.docs[0].display !== c) {
            result_users.docs[0].display = c
            await sync('users', false, patient_id, true, result_users.docs[0])
          }
        }
      }
    }
  }
  const syncSome = async(online, patient_id) => {
    const auth_store = useAuthStore()
    const resources = auth_store.sync_resource
    if (resources.length > 0) {
      if (online) {
        for (var resource of resources) {
          if (resource !== undefined) {
            objectPath.set(syncTooltip, 'text', 'Syncing ' + Case.title(resource) + '...')
            await sync(resource, online, patient_id, false, {})
          }
        }
        auth_store.setSyncResource([])
      }
    }
  }
  const syncState = reactive({ total: 0, complete: 0 })
  const syncTooltip = reactive({ text: '' })
  const thread = async(doc, online, patient_id) => {
    var arr = []
    arr.push(doc)
    arr = await threadEarlier(doc, arr)
    arr = await threadLater(doc.id, arr, doc.status, online, patient_id)
    return arr
  }
  const threadEarlier = async(doc, arr) => {
    const prefix = getPrefix()
    const localDB = new PouchDB(prefix + 'communications')
    if (objectPath.has(doc, 'inResponseTo')) {
      var doc1 = await localDB.get(doc.inResponseTo.reference.replace('Communication/', ''))
      arr.push(doc1)
      await threadEarlier(doc1, arr)
    }
    return arr
  }
  const threadLater = async(id, arr, status, online, patient_id) => {
    const prefix = getPrefix()
    const localDB = new PouchDB(prefix + 'communications')
    if (status === 'completed') {
      var selector = {"inResponseTo.reference": {$eq: 'Communication/' + id }, status: {$eq: 'completed'}, _id: {"$gte": null}}
    } else {
      var pending = {"inResponseTo.reference": {$eq: 'Communication/' + id }, status: {$eq: 'preparation'}, _id: {"$gte": null}}
      const pending_result = await localDB.find({selector: pending})
      if (pending_result.docs.length > 0) {
        for (var a in pending_result.docs) {
          if (moment(pending_result.docs[a].sent).isBefore()) {
            objectPath.set(pending_result, 'docs.' + a + '.status', 'in-progress')
            await sync('communications', false, patient_id, true, pending_result.docs[a])
          }
        }
      }
      var selector = {"inResponseTo.reference": {$eq: 'Communication/' + id }, status: {$eq: 'in-progress'}, _id: {"$gte": null}}
    }
    const result = await localDB.find({selector: selector})
    if (result.docs.length > 0) {
      for (var b in result.docs) {
        arr.push(result.docs[b])
      }
    }
    return arr
  }
  const updateUser = async(user, field, val) => {
    var arr = []
    if (objectPath.has(user, field)) {
      arr = objectPath.get(user, field)
    }
    var a = arr.map(b => b.id).indexOf(val.id)
    if (a === -1) {
      arr.push(val)
      if (field === 'charts') {
        arr.sort((c, d) => d.date - c.date)
      }
      if (field === 'unsigned') {
        arr.sort((c, d) => c.date - d.date)
      }
      objectPath.set(user, field, arr)
    } else {
      if (field === 'charts') {
        arr.splice(a, 1)
        arr.push(val)
        objectPath.set(user, field, arr)
      }
    }
    return user
  }
  const verifyJWT = async(online) => {
    if (online) {
      const auth_store = useAuthStore()
      const keys = await axios.get(window.location.origin + '/auth/jwks')
      const jwk = await jose.importJWK(keys.data.keys[0])
      const jwt = auth_store.jwt
      try {
        const { payload, protectedHeader } = await jose.jwtVerify(jwt, jwk)
        return true
      } catch (e) {
        throw new Error(e)
      }
    }
  }
  return {
    addSchemaOptions,
    bundleBuild,
    divBuild,
    eventAdd,
    fetchJSON,
    fetchTXT,
    fhirDisplay,
    fhirModel,
    fhirReplace,
    getPrefix,
    getResource,
    getSignedEncounters,
    getValue,
    groupItems,
    historyDXMatch,
    importFHIR,
    importReference,
    inbox,
    loadSchema,
    loadSelect,
    observationResult,
    observationStatus,
    observationStatusRaw,
    patientList,
    patientStatus,
    referenceSearch,
    removeTags,
    setOptions,
    sync,
    syncAll,
    syncEmailToUser,
    syncSome,
    syncState,
    syncTooltip,
    thread,
    threadEarlier,
    threadLater,
    updateUser,
    verifyJWT
  }
}