import dotenv from 'dotenv'
dotenv.config()
import axios from 'axios'
import Case from 'case'
import crypto from 'crypto'
import fs from 'fs'
import { createSigner, httpbis } from 'http-message-signatures'
import { parseFullName } from 'parse-full-name'
import * as jose from 'jose'
import * as marked from 'marked'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb'
import settings from './settings.mjs'
import { v4 as uuidv4 } from 'uuid'

import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)
import comdb from 'comdb'
PouchDB.plugin(comdb)

function addSchemaOptions(id, arr, val, label, schema, system='') {
  const options = []
  for (const a of arr) {
    const b = {}
    if (a[val] !== undefined && a[val] !== 'notSelectable' ) {
      b.value = a[val]
      b.label = a[label]
      if (system !== '') {
        b.system = system
      }
      options.push(b)
    }
  }
  for (const c in schema) {
    if (Array.isArray(schema[c])) {
      for (const d in schema[c]) {
        if (id == schema[c][d].id) {
          if (objectPath.has(schema, c + '.' + d + '.options')) {
            objectPath.set(schema, c + '.' + d + '.options', objectPath.get(schema, c + '.' + d + '.options').concat(options))
          } else {
            objectPath.set(schema, c + '.' + d + '.options', options)
          }
        }
      }
    } else {
      if (id == schema[c].id) {
        if (objectPath.has(schema, c + '.options')) {
          objectPath.set(schema, c + '.options', objectPath.get(schema, c + '.options').concat(options))
        } else {
          objectPath.set(schema, c + '.options', options)
        }
      }
    }
  }
  return schema
}

async function couchdbConfig(section, key, value) {
  const opts = JSON.parse(JSON.stringify(settings.couchdb_auth))
  objectPath.set(opts, 'headers', {'Content-Type': 'application/json'})
  const data = JSON.stringify(value).replace(/\\/g, "\\\\")
  try {
    const res = await axios.put(settings.couchdb_uri + '/_node/_local/_config/' + section + '/' + key, data, opts)
    return res.data
  } catch (e) {
    console.log(e.response.data)
    return e
  }
}

async function couchdbDatabase(patient_id='', protocol='', hostname='', email='') {
  const resources = JSON.parse(fs.readFileSync('./assets/resources.json'))
  let prefix = ''
  let gnap_resources = []
  const base_url = urlFix(protocol + '://' + hostname + '/')
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
    gnap_resources = [
      {
        "type": "App",
        "actions": ["read", "write", "delete"],
        "datatypes": ["json", "html"],
        "identifier": patient_id,
        "locations": [base_url + 'app/chart/' + patient_id],
        "privileges": [email, "npi", "offline"],
        "ro": email
      }
    ]
  }
  for (const resource of resources.rows) {
    const db_resource = new PouchDB(urlFix(settings.couchdb_uri) + prefix + resource.resource, settings.couchdb_auth)
    await db_resource.info()
    if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
      if (resource.gnap) {
        if (resource.fhir) {
          const gnap_resource_all = {
            "type": Case.title(resource.resource),
            "actions": ["read", "write", "delete"],
            "datatypes": ["json"],
            "identifier": patient_id,
            "locations": [base_url + "fhir/api/" + patient_id + "/" + Case.pascal(pluralize.singular(resource.resource))],
            "privileges": [email],
            "ro": email
          }
          const gnap_resource_read = {
            "type": Case.title(resource.resource) + " - Read Only",
            "actions": ["read"],
            "datatypes": ["json"],
            "identifier": patient_id,
            "locations": [base_url + "fhir/api/" + patient_id + "/" + Case.pascal(pluralize.singular(resource.resource))],
            "privileges": [email],
            "ro": email
          }
          gnap_resources.push(gnap_resource_all)
          gnap_resources.push(gnap_resource_read)
        } else {
          if (resource.resource === 'timeline') {
            const timeline_read = {
              "type": Case.title(resource.resource) + " - Read Only",
              "actions": ["read"],
              "datatypes": ["text/plain"],
              "identifier": patient_id,
              "locations": [base_url + "api/" + patient_id + "/" + Case.pascal(pluralize.singular(resource.resource))],
              "privileges": [email],
              "ro": email
            }
            const markdown_post = {
              "type": "Markdown - Write Only",
              "actions": ["write"],
              "datatypes": ["text/plain"],
              "identifier": patient_id,
              "locations": [base_url + "api/" + patient_id + "/md"],
              "privileges": [email],
              "ro": email
            }
            gnap_resources.push(timeline_read)
            gnap_resources.push(markdown_post)
          }
        }
      }
    }
  }
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    const keys = await getAllKeys()
    const body = {
      "access": gnap_resources,
      "resource_server": {
        "key": {
          "proof": "httpsig",
          "jwk": keys.publicKey
        }
      }
    }
    const req = {
      hostname: hostname,
      protocol: protocol
    }
    const signedRequest = await signRequest(body, urlFix(process.env.TRUSTEE_URL) + 'api/as/resource', 'POST', req)
    try {
      const doc = await fetch(urlFix(process.env.TRUSTEE_URL) + 'api/as/resource', signedRequest)
        .then((res) => {
          if (res.status > 400 && res.status < 600) { 
            return {error: res}
          } else {
            return res.json()
          }
        })
      console.log(doc)
    } catch (e) {
      console.log(e)
    }
  }
  await eventAdd('Chart Created', {id: 'system', display: 'System', doc_db: null, doc_id: null, diff: null}, patient_id)
}

async function couchdbInstall() {
  const keys = await getKeys()
  if (keys.length === 0) {
    const pair = await createKeyPair()
    keys.push(pair)
  }
  const key = await jose.importJWK(keys[0].publicKey)
  const pem = await jose.exportSPKI(key)
  const result = []
  const commands = [
    {section: 'jwt_keys', key: 'rsa:_default', value: pem}
  ]
  for (const command of commands) {
    const a = await couchdbConfig(command.section, command.key, command.value)
    result.push({command: command, result: a})
  }
  await couchdbRestart()
  await sleep(5)
  return result
}

async function couchdbRestart() {
  const opts = settings.couchdb_auth
  objectPath.set(opts, 'headers', {'Content-Type': 'application/json'})
  try {
    const res = await axios.post(settings.couchdb_uri + '/_node/_local/_restart', '', opts)
    objectPath.del(opts, 'headers')
    return res.data
  } catch (e) {
    console.log(e.response.data)
    return e
  }
}

async function couchdbUpdate(patient_id='', protocol='', hostname='') {
  const resources = JSON.parse(fs.readFileSync('./assets/resources.json'))
  let prefix = ''
  let email = ''
  let gnap_resources = []
  let base_url = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
    base_url = urlFix(protocol + '://' + hostname + '/')
    const db_users = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'users', settings.couchdb_auth)
    const result_users = await db_users.find({selector: {'role': {"$eq": 'patient'}}})
    email = result_users.docs[0].email
  }
  for (const resource of resources.rows) {
    const opts = JSON.parse(JSON.stringify(settings.couchdb_auth))
    objectPath.set(opts, 'skip_setup', true)
    const check = new PouchDB(urlFix(settings.couchdb_uri) + prefix + resource.resource, opts)
    const info = await check.info()
    if (objectPath.has(info, 'error')) {
      const db_resource = new PouchDB(urlFix(settings.couchdb_uri) + prefix + resource.resource, settings.couchdb_auth)
      await db_resource.info()
      if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
        if (resource.gnap) {
          if (resource.fhir) {
            const gnap_resource_all = {
              "type": Case.title(resource.resource),
              "actions": ["read", "write", "delete"],
              "datatypes": ["json"],
              "identifier": patient_id,
              "locations": [base_url + "fhir/api/" + patient_id + "/" + Case.pascal(pluralize.singular(resource.resource))],
              "privileges": [email],
              "ro": email
            }
            const gnap_resource_read = {
              "type": Case.title(resource.resource) + " - Read Only",
              "actions": ["read"],
              "datatypes": ["json"],
              "identifier": patient_id,
              "locations": [base_url + "fhir/api/" + patient_id + "/" + Case.pascal(pluralize.singular(resource.resource))],
              "privileges": [email],
              "ro": email
            }
            gnap_resources.push(gnap_resource_all)
            gnap_resources.push(gnap_resource_read)
          } else {
            if (resource.resource === 'timeline') {
              const timeline_read = {
                "type": Case.title(resource.resource) + " - Read Only",
                "actions": ["read"],
                "datatypes": ["text/plain"],
                "identifier": patient_id,
                "locations": [base_url + "api/" + patient_id + "/" + Case.pascal(pluralize.singular(resource.resource))],
                "privileges": [email],
                "ro": email
              }
              const markdown_post = {
                "type": "Markdown - Write Only",
                "actions": ["write"],
                "datatypes": ["text/plain"],
                "identifier": patient_id,
                "locations": [base_url + "api/" + patient_id + "/md"],
                "privileges": [email],
                "ro": email
              }
              gnap_resources.push(timeline_read)
              gnap_resources.push(markdown_post)
            }
          }
        }
      }
    }
  }
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    if (gnap_resources.length > 0) {
      const keys = await getAllKeys()
      const body = {
        "access": gnap_resources,
        "resource_server": {
          "key": {
            "proof": "httpsig",
            "jwk": keys.publicKey
          }
        }
      }
      const req = {
        hostname: hostname,
        protocol: protocol
      }
      const signedRequest = await signRequest(body, urlFix(process.env.TRUSTEE_URL) + 'api/as/resource', 'POST', req)
      try {
        const doc = await fetch(urlFix(process.env.TRUSTEE_URL) + 'api/as/resource', signedRequest)
          .then((res) => {
            console.log(res)
            if (res.status > 400 && res.status < 600) { 
              return {error: res}
            } else {
              return res.json()
            }
          })
        console.log(doc)
      } catch (e) {
        console.log(e)
      }
    }
  }
  console.log('# records updated: ' + gnap_resources.length)
  return true
}

async function createKeyPair(alg='RS256') {
  const { publicKey, privateKey } = await jose.generateKeyPair(alg)
  const public_key = await jose.exportJWK(publicKey)
  const kid = uuidv4()
  objectPath.set(public_key, 'kid', kid)
  objectPath.set(public_key, 'alg', alg)
  const private_key = await jose.exportJWK(privateKey)
  objectPath.set(private_key, 'kid', kid)
  objectPath.set(private_key, 'alg', alg)
  const id = 'nosh_' + uuidv4()
  const keys = await getKeys()
  let doc = {}
  if (keys.length > 0) {
    doc = keys[0]
    objectPath.set(doc, 'publicKey', public_key)
    objectPath.set(doc, 'privateKey', private_key)
  } else {
    doc = {_id: id, publicKey: public_key, privateKey: private_key}
  }
  const db = new PouchDB(urlFix(settings.couchdb_uri) + 'keys', settings.couchdb_auth)
  await db.put(doc)
  return doc
}

function equals (a, b) {
  if (a === b) {
    return true
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }
  if (!a || !b || (typeof a !== 'object' && typeof b !== 'object')) {
    return a === b
  }
  if (a.prototype !== b.prototype) {
    return false
  }
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) {
    return false
  }
  return keys.every(k => equals(a[k], b[k]))
}

async function eventAdd(event, opts, patient_id='') {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
  }
  const db = new PouchDB('activities')
  // check if old version and destroy
  const check = await db.allDocs({include_docs: true})
  if (check.rows.length > 0) {
    for (const a of check.rows) {
      if (objectPath.has(a, 'doc.diff')) {
        db.destroy()
        const destroy_remote = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'activities', settings.couchdb_auth)
        destroy_remote.destroy()
      }
    }
  }
  const db1 = new PouchDB('activities')
  // check if existing day event doc, otherwise create one
  const datetime = moment().startOf('day').unix()
  const datetime_formal = moment().startOf('day').format('YYYY-MM-DDTHH:mm:ss.SSSZ')
  const check1 = await db1.find({selector: {'datetime': {"$eq": datetime}}})
  let doc = {}
  if (check1.docs.length > 0) {
    doc = check1.docs[0]
  } else {
    doc = {
      _id: 'nosh_' + uuidv4(),
      datetime: datetime,
      datetime_formal: datetime_formal,
      events: []
    }
  }
  const event_item = {
    event: event,
    datetime: moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
    user: opts.display,
    user_id: opts.id,
    doc_db: opts.doc_db,
    doc_id: opts.doc_id,
    diff: opts.diff
  }
  doc.events.push(event_item)
  await db1.put(doc)
  await sync('activities', patient_id)
}

async function eventUser(res, opts, prefix) {
  const db_users = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'users', settings.couchdb_auth)
  const result_users = await db_users.find({selector: {'email': {"$eq": objectPath.get(res, 'locals.payload.sub')}}})
  if (result_users.docs.length > 0) {
    objectPath.set(opts, 'id', result_users.docs[0].id)
    objectPath.set(opts, 'display', result_users.docs[0].display)
  } else {
    objectPath.set(opts, 'id', objectPath.get(res, 'locals.payload.sub'))
    objectPath.set(opts, 'display', objectPath.get(res, 'locals.payload.sub'))
  }
  return opts
}

function fetchJSON(json) {
  return JSON.parse(fs.readFileSync('./assets/' + json + '.json'))
}

function fhirDisplay(field, index='0') {
  let model = field.display
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

function fhirModel(field) {
  let model = field.model
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

function fhirReplace(key, base, result, uiSchema) {
  const row = base.uiListContent[key]
  let str = ''
  let field = ''
  let model = ''
  let display_model = ''
  if (key === 'content') {
    const models = []
    for (const a in base.uiListContent.contentFields) {
      field = uiSchema.find(({ id }) => id === base.uiListContent.contentFields[a])
      if (field !== undefined) {
        model = fhirModel(field)
        const obj = {}
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
            for (const b in field.modelChoice) {
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
                  let value = ''
                  for (const c in obj['value']) {
                    let d = {}
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
                        const displayModel = fhirDisplay(field, c)
                        value += objectPath.get(result, displayModel)
                      } else {
                        value += obj['value']
                      }
                    }
                  }
                  obj['value'] = value
                } else {
                  const e = field.options.find(({ value }) => value === obj['value'])
                  if (e !== undefined) {
                    obj['value'] = e.label
                  } else {
                    if (objectPath.has(field, 'display')) {
                      const displayModel1 = fhirDisplay(field)
                      obj['value'] = objectPath.get(result, displayModel1)
                    }
                  }
                }
              } else {
                const f = field.options.find(({ value }) => value === obj['value'])
                if (f !== undefined) {
                  obj['value'] = f.label
                } else {
                  if (objectPath.has(field, 'display')) {
                    const displayModel2 = fhirDisplay(field)
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
              const alt_model = model.replace('coding.0.display', 'text')
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
    const found = []
    let rxp = /{([^}]+)}/g
    let curMatch
    let replaceWith = []
    let mapping = {}
    str = row
    while((curMatch = rxp.exec(str))) {
      found.push(curMatch[1])
    }
    for (const g in found) {
      field = uiSchema.find(({ id }) => id === found[g])
      model = fhirModel(field)
      if (objectPath.has(result, model)) {
        replaceWith[g] = objectPath.get(result, model)
        if (typeof field.options !== 'undefined') {
          if (field.multiple === true) {
            if (Array.isArray(replaceWith[g])) {
              let value = ''
              for (const h in replaceWith[g]) {
                let i = {}
                if (typeof field.modelRoot !== 'undefined') {
                  i = field.options.find(({ value }) => value === replaceWith[g][h][field.model])
                } else {
                  i = field.options.find(({ value }) => value === replaceWith[g][h])
                }
                if (h !== '0') {
                  value += '; '
                }
                if (i !== undefined) {
                  value += i.label
                } else {
                  display_model = fhirDisplay(field)
                  if (objectPath.has(result, display_model)) {
                    value = objectPath.get(result, display_model)
                  } else {
                    if (objectPath.has(field, 'alt_label_model')) {
                      if (objectPath.has(result, objectPath.get(field, 'alt_label_model'))) {
                        value = objectPath.get(result, objectPath.get(field, 'alt_label_model'))
                      }
                    }
                  }
                }
              }
              replaceWith[g] = value
            } else {
              const j = field.options.find(({ value }) => value === replaceWith[g])
              if (j !== undefined) {
                replaceWith[g] = j.label
              } else {
                display_model = fhirDisplay(field)
                if (objectPath.has(result, display_model)) {
                  replaceWith[g] = objectPath.get(result, display_model)
                } else {
                  if (objectPath.has(field, 'alt_label_model')) {
                    if (objectPath.has(result, objectPath.get(field, 'alt_label_model'))) {
                      replaceWith[g] = objectPath.get(result, objectPath.get(field, 'alt_label_model'))
                    }
                  }
                }
              }
            }
          } else {
            const k = field.options.find(({ value }) => value === replaceWith[g])
            if (k !== undefined) {
              replaceWith[g] = k.label
            } else {
              display_model = fhirDisplay(field)
              if (objectPath.has(result, display_model)) {
                replaceWith[g] = objectPath.get(result, display_model)
              } else {
                if (objectPath.has(field, 'alt_label_model')) {
                  if (objectPath.has(result, objectPath.get(field, 'alt_label_model'))) {
                    replaceWith[g] = objectPath.get(result, objectPath.get(field, 'alt_label_model'))
                  }
                }
              }
            }
          }
        }
      } else {
        if (model.split('.').slice(-3).join('.') === 'coding.0.display') {
          const alt_model = model.replace('coding.0.display', 'text')
          if (objectPath.has(result, alt_model)) {
            replaceWith[g] = objectPath.get(result, alt_model)
          }
        }
        if (replaceWith[g] === undefined) {
          if (objectPath.has(field, 'alt_model')) {
            const alt_model1 = objectPath.get(field, 'alt_model')
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

async function getAllKeys() {
  const keys = []
  let publicKey = ''
  let trustee_key = null
  // Trustee key
  try {
    trustee_key = await axios.get(urlFix(process.env.TRUSTEE_URL) + 'api/as/jwks')
    if (trustee_key !== null && trustee_key.status === 200 && objectPath.has(trustee_key, 'data.key')) {
      keys.push(trustee_key.data.key)
    }
    // Local key
    const db = new PouchDB(urlFix(settings.couchdb_uri) + 'keys', settings.couchdb_auth)
    const result = await db.find({selector: {_id: {"$gte": null}}})
    for (const a in result.docs) {
      keys.push(result.docs[a].publicKey)
      if (objectPath.has(result, 'docs.' + a + '.privateKey')) {
        publicKey = result.docs[a].publicKey
      }
    }
    return {keys: keys, publicKey: publicKey}
  } catch (err) {
    console.log(err)
  }
}

async function getKeys() {
  const db = new PouchDB(urlFix(settings.couchdb_uri) + 'keys', settings.couchdb_auth)
  const result = await db.find({selector: {_id: {"$gte": null}, privateKey: {"$gte": null}}})
  return result.docs
}

function getName(vc) {
  const name = {display: ''}
  let ret = {}
  for (const a of vc) {
    if (objectPath.has(a, 'vc.credentialSubject.name')) {
      objectPath.set(name, 'display', objectPath.get(a, 'vc.credentialSubject.name'))
      const parsed = parseFullName(objectPath.get(a, 'vc.credentialSubject.name'))
      ret = {...name, parsed}
    }
    if (objectPath.has(a, 'vc.credentialSubject.firstName') && objectPath.has(a, 'vc.credentialSubject.lastName')) {
      objectPath.set(name, 'display', objectPath.get(a, 'vc.credentialSubject.firstName') + ' ' + objectPath.get(a, 'vc.credentialSubject.lastName'))
      ret = {...name, parsed: {
        title: '',
        first: objectPath.get(a, 'vc.credentialSubject.firstName'),
        middle: '',
        last: objectPath.get(a, 'vc.credentialSubject.lastName'),
        nick: '',
        suffix: ''
      }}
    }
  }
  return ret
}

function getNPI(vc) {
  let npi = ''
  for (const a of vc) {
    if (npi === '') {
      if (objectPath.has(a, 'vc.credentialSubject.npi')) {
        npi = a.vc.credentialSubject.npi
      }
    }
  }
  return npi
  // if (objectPath.has(vc, 'credentialSubject.fhirBundle.entry')) {
  //   var a = objectPath.get(vc, 'credentialSubject.fhirBundle.entry').find(b => b.resource.resourceType == 'Practitioner')
  //   if (a !== undefined) {
  //     if (objectPath.has(a.identifier)) {
  //       var c = objectPath.get(a, 'identifier').find(d => d.system == 'http://hl7.org/fhir/sid/us-npi')
  //       if (c !== undefined) {
  //         npi = c.value
  //       }
  //     }
  //   }
  // }
  // return npi
}

async function getPIN(patient_id) {
  const db = new PouchDB('pins', {skip_setup: true})
  const info = await db.info()
  if (objectPath.has(info, 'error')) {
    return false
  }
  try {
    const result = await db.get(patient_id)
    return result.pin
  } catch (e) {
    return false
  }
}

async function getResource(resource, arr, patient_id) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
  }
  const resourceDB = new PouchDB(prefix + resource)
  const result = await resourceDB.allDocs({
    include_docs: true,
    attachments: true,
    startkey: 'nosh_',
  })
  if (result.rows.length > 0) {
    for (const a of result.rows) {
      let label = 'No Name'
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

async function introspect(req, jwt, method, location) {
  try {
    const a = await fetch(urlFix(process.env.TRUSTEE_URL) + '/api/as/.well-known/gnap-as-rs')
      .then((res) => res.json())
    const keys = await getAllKeys()
    const body = {
      "access_token": jwt,
      "proof": "httpsig",
      "resource_server": {
        "key": {
          "proof": "httpsig",
          "jwk": keys.publicKey
        }
      }
    }
    const signedRequest = await signRequest(body, a.introspection_endpoint, 'POST', req)
    try {
      const introspect = await fetch(a.introspection_endpoint, signedRequest)
        .then((res) => res.json())
      if (introspect.active) {
        let i = 0
        for (const item of introspect.access) {
          if (item.locations.includes(location)) {
            if (item.actions.includes(method)) {
              i++
            }
          }
        }
        if (i > 0) {
          return {success: true}
        } else {
          return {error: "locations and actions do not match"}
        }
      } else {
        return {error: "access token invalid"}
      }
    } catch (e) {
      console.log(e)
      return {error: "unable to introspect"}
    }
  } catch (e) {
    console.log(e)
    return {error: "unable to reach GNAP AS"}
  }
}

function isMarkdown(text) {
  const containsNonTextTokens = (tokens) =>{
    return tokens.some(token => {
      // change this as per your needs
      if (token.type !== 'text' && token.type !== 'paragraph' ) { 
        return true
      }
      // Check recursively for nested tokens
      if (token.tokens && containsNonTextTokens(token.tokens)) {
        return true
      }
      return false
    })
  }
  const tokens = marked.lexer(text)
  return containsNonTextTokens(tokens)
}

async function loadSelect(resource, id, schema, patient_id) {
  let arr = []
  if (Array.isArray(resource)) {
    for (const resource0 of resource) {
      arr = await getResource(resource0, arr, patient_id)
    }
  } else {
    arr = await getResource(resource, arr, patient_id)
  }
  if (arr.length > 0) {
    schema = addSchemaOptions(id, arr, 'val', 'label', schema)
  }
  return schema
}

function markdownParse(text) {
  const tokens = marked.lexer(text)
  const arr = []
  arr.push({h4: 'Document'})
  for (const token of tokens) {
    if (token.type === 'heading') {
      arr.push({h5: token.text})
    }
    if (token.type === 'paragraph') {
      arr.push({p: token.text})
    }
    if (token.type === 'list') {
      const ul_arr = []
      for (const item of token.items) {
        ul_arr.push(item.text)
      }
      arr.push({ul: ul_arr})
    }
  }
  return arr
}

async function pollSet(patient_id, resource) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
  }
  const db = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'sync', settings.couchdb_auth)
  const sync_result = await db.find({selector: {'resource': {"$eq": resource}}})
  if (sync_result.docs.length > 0) {
    for (const sync_doc of sync_result.docs) {
      await db.remove(sync_doc)
    }
  }
  let doc = {
    '_id': 'nosh_' + uuidv4(),
    'timestamp': moment().unix(),
    'resource': resource
  }
  await db.put(doc)
  return true
}

async function registerResources(patient_id='', protocol='', hostname='', email='') {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
  }
  const resources = JSON.parse(fs.readFileSync('./assets/resources.json'))
  let base_url = ''
  let gnap_resources = []
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    base_url = urlFix(protocol + '://' + hostname + '/')
    gnap_resources = [
      {
        "type": "App",
        "actions": ["read", "write", "delete"],
        "datatypes": ["json", "html"],
        "identifier": patient_id,
        "locations": [base_url + 'app/chart/' + patient_id],
        "privileges": [email, "npi", "offline"],
        "ro": email
      }
    ]
  }
  for (const resource of resources.rows) {
    const db_resource = new PouchDB(urlFix(settings.couchdb_uri) + prefix + resource.resource, settings.couchdb_auth)
    await db_resource.info()
    if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
      if (resource.gnap) {
        if (resource.fhir) {
          const gnap_resource_all = {
            "type": Case.title(resource.resource),
            "actions": ["read", "write", "delete"],
            "datatypes": ["json"],
            "identifier": patient_id,
            "locations": [base_url + "fhir/api/" + patient_id + "/" + Case.pascal(pluralize.singular(resource.resource))],
            "privileges": [email],
            "ro": email
          }
          const gnap_resource_read = {
            "type": Case.title(resource.resource) + " - Read Only",
            "actions": ["read"],
            "datatypes": ["json"],
            "identifier": patient_id,
            "locations": [base_url + "fhir/api/" + patient_id + "/" + Case.pascal(pluralize.singular(resource.resource))],
            "privileges": [email],
            "ro": email
          }
          gnap_resources.push(gnap_resource_all)
          gnap_resources.push(gnap_resource_read)
        } else {
          if (resource.resource === 'timeline') {
            const timeline_read = {
              "type": Case.title(resource.resource) + " - Read Only",
              "actions": ["read"],
              "datatypes": ["text/plain"],
              "identifier": patient_id,
              "locations": [base_url + "api/" + patient_id + "/" + Case.pascal(pluralize.singular(resource.resource))],
              "privileges": [email],
              "ro": email
            }
            const markdown_post = {
              "type": "Markdown - Write Only",
              "actions": ["write"],
              "datatypes": ["text/plain"],
              "identifier": patient_id,
              "locations": [base_url + "api/" + patient_id + "/md"],
              "privileges": [email],
              "ro": email
            }
            gnap_resources.push(timeline_read)
            gnap_resources.push(markdown_post)
          }
        }
      }
    }
  }
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    const keys = await getAllKeys()
    const body = {
      "access": gnap_resources,
      "resource_server": {
        "key": {
          "proof": "httpsig",
          "jwk": keys.publicKey
        }
      }
    }
    const req = {
      hostname: hostname,
      protocol: protocol
    }
    const signedRequest = await signRequest(body, urlFix(process.env.TRUSTEE_URL) + 'api/as/resource', 'POST', req)
    try {
      const doc = await fetch(urlFix(process.env.TRUSTEE_URL) + 'api/as/resource', signedRequest)
        .then((res) => {
          if (res.status > 400 && res.status < 600) { 
            return {error: res}
          } else {
            return res.json()
          }
        })
      console.log(doc)
      return body
    } catch (e) {
      return false
    }
  }
}

function removeTags(str) {
  if ((str===null) || (str==='')) {
    return false
  } else {
    str = str.toString()
    return str.replace( /(<([^>]+)>)/ig, '')
  }
}

async function signRequest(doc, urlinput, method, req, auth='') {
  const keys = await getKeys()
  if (keys.length === 0) {
    const pair = await createKeyPair()
    keys.push(pair)
  }
  const key_jose = await jose.importJWK(keys[0].privateKey, keys[0].privateKey.alg)
  const body = {
    ...doc,
    "client": {
      "display": {
        "name": "NOSH",
        "uri": req.protocol + "://" + req.hostname
      },
      "key": {
        "proof": "httpsig",
        "jwk": keys[0].publicKey
      }
    }
  }
  const opt = {
    method: method,
    url: urlinput,
    headers: {
      "content-digest": "sha-256=:" + crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex') + "=:",
      "content-type": "application/json",
    },
    body: JSON.stringify(body)
  }
  if (auth !== '') {
    objectPath.set(opt, "headers.authorization", "GNAP " + auth)
  }
  try {
    const key = createSigner(key_jose, 'rsa-v1_5-sha256')
    const signedRequest = await httpbis.signMessage({
      key,
      name: 'sig1',
      fields: [
        '@method',
        '@target-uri',
        'content-digest',
        'content-type'
      ],
      params: [
        'created',
        'nonce',
        'tag',
        'keyid',
        'alg'
      ],
      paramValues: {
        nonce: crypto.randomBytes(16).toString('base64url'),
        tag: "gnap",
        keyid: keys[0].publicKey.kid
      }
    }, opt)
    return signedRequest
  } catch (e) {
    return false
  }
}

async function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

async function sync(resource, patient_id='', save=false, data={}) {
  let prefix = ''
  let pin = process.env.COUCHDB_ENCRYPT_PIN
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
    pin = await getPIN(patient_id)
  }
  const local = new PouchDB(prefix + resource)
  if (resource !== 'users' && resource !== 'presentations' && resource !== 'binaries') {
    await local.setPassword(pin, {name: urlFix(settings.couchdb_uri) + prefix + resource, opts: settings.couchdb_auth})
  }
  if (save) {
    const result = await local.put(data)
    await eventAdd('Updated ' + pluralize.singular(resource.replace('_statements', '')), {id: 'system', display: 'System', doc_db: resource, doc_id: result.id, diff: null}, patient_id)
    if (timelineResources.includes(resource)) {
      console.log('updating timeline because of ' + resource)
      await timelineUpdate({id: data._id, resource: resource, action: 'update'}, patient_id)
    }
  }
  if (resource !== 'users' && resource !== 'presentations' && resource !== 'binaries') {
    const info = await local.info()
    if (info.doc_count > 0) {
      try {
        await local.loadDecrypted()
      } catch (e) {
        console.log(e)
      }
    }
    try {
      await local.loadEncrypted()
      console.log('PouchDB sync complete for DB: ' + resource)
    } catch (e) {
      console.log(e)
    }
  } else {
    const remote = new PouchDB(urlFix(settings.couchdb_uri) + prefix + resource, settings.couchdb_auth)
    try {
      await local.sync(remote).on('complete', () => {
        console.log('PouchDB sync complete for DB: ' + resource)
      }).on('error', (err) => {
        console.log(err)
      })
    } catch (e) {
      console.log(e)
    }
  }
  await pollSet(patient_id, resource)
}

const timelineResources = ['encounters', 'conditions', 'medication_statements', 'immunizations', 'allergy_intolerances', 'document_references']

async function timelineUpdate(opts, patient_id) {
  let prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
  }
  await sync('timeline', patient_id)
  const timelineDB = new PouchDB(prefix + 'timeline')
  const result = await timelineDB.allDocs({
    include_docs: true,
    attachments: true,
    startkey: 'nosh_'
  })
  let timeline = []
  let timeline_doc = {}
  if (opts.action == 'delete') {
    if (result.rows.length > 0) {
      timeline_doc = objectPath.get(result, 'rows.0.doc')
      const check = objectPath.get(result, 'rows.0.doc.timeline').filter((row) => row.id === opts.id && row.resource === opts.resource)
      if (check !== -1) {
        timeline = objectPath.get(result, 'rows.0.doc.timeline').filter((row) => row.id !== opts.id)
      }
    }
  } else {
    if (result.rows.length > 0) {
      timeline_doc = objectPath.get(result, 'rows.0.doc')
      timeline = objectPath.get(result, 'rows.0.doc.timeline')
      const check = objectPath.get(result, 'rows.0.doc.timeline').filter((row) => row.id === opts.id && row.resource === opts.resource)
      if (check !== -1) {
        timeline = timeline.filter((row) => row.id !== opts.id)
      }
    }
    if (objectPath.has(opts, 'id')) {
      const json = fetchJSON('/ui/drawer')
      const drawer = json.rows
      const base = fetchJSON('/fhir/' + opts.resource)
      const resource1 = drawer.find(item => item.resource === opts.resource)
      const title = 'New ' + Case.title(pluralize.singular(opts.resource))
      let schema = []
      if (opts.resource !== 'observations') {
        if (opts.resource !== 'encounters') {
          schema = base.uiSchema.flat()
        } else {
          schema = base.new.uiSchema.flat()
        }
      }
      if (opts.resource === 'immunizations') {
        const actSites = fetchJSON('actSites')
        schema = addSchemaOptions('site', actSites.concept[0].concept[0].concept, 'code', 'display', schema)
      }
      if (opts.resource === 'medication_statements') {
        const doseform = fetchJSON('doseform')
        const routes = fetchJSON('routes')
        schema = addSchemaOptions('doseUnit', doseform.concept, 'code', 'display', schema)
        schema = addSchemaOptions('route', routes, 'code', 'desc', schema)
      }
      if (opts.resource === 'encounters') {
        const serviceTypes = fetchJSON('serviceTypes')
        schema = addSchemaOptions('serviceType', serviceTypes, 'Code', 'Display', schema)
        const encounterTypes = fetchJSON('encounterTypes')
        schema = addSchemaOptions('type', encounterTypes, 'Code', 'Display', schema)
        schema = await loadSelect('practitioners', 'participant', schema, patient_id)
      }
      if (opts.resource === 'document_references') {
        const docTypeCodes = fetchJSON('docTypeCodes')
        const docClassCodes = fetchJSON('docClassCodes')
        schema = addSchemaOptions('type', docTypeCodes, 'Code', 'Display', schema, 'http://loinc.org')
        schema = addSchemaOptions('category', docClassCodes, 'Code', 'Display', schema, 'http://loinc.org')
        schema = addSchemaOptions('category', [{'Code': 'clinical-note', 'Display': 'Clinical Note'}], 'Code', 'Display', schema, 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category')
      }
      const db = new PouchDB(prefix + opts.resource)
      const doc = await db.get(opts.id)
      const timelineItem = {}
      objectPath.set(timelineItem, 'id', opts.id)
      objectPath.set(timelineItem, 'title', fhirReplace('title', base, doc, schema))
      objectPath.set(timelineItem, 'subtitle', objectPath.get(doc,  base.timelineDate) + ', ' + title)
      objectPath.set(timelineItem, 'content', fhirReplace('content', base, doc, schema))
      objectPath.set(timelineItem, 'extended', fhirReplace('extended', base, doc, schema))
      objectPath.set(timelineItem, 'status', fhirReplace('status', base, doc, schema))
      objectPath.set(timelineItem, 'date', moment(objectPath.get(doc, base.timelineDate)).utc().unix())
      objectPath.set(timelineItem, 'icon', resource1.icon)
      objectPath.set(timelineItem, 'resource', opts.resource)
      objectPath.set(timelineItem, 'keys', base.fuse)
      objectPath.set(timelineItem, 'style', base.uiListContent.contentStyle)
      if (opts.resource === 'encounters') {
        const bundle_db = new PouchDB(prefix + 'bundles')
        const bundle_result = await bundle_db.find({selector: {'entry': {"$elemMatch": {"resource.encounter.reference": 'Encounter/' + opts.id}}, _id: {"$gte": null}}})
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
        if (objectPath.has(doc, 'sync_id')) {
          const doc_ref_db = new PouchDB(prefix + 'document_references')
          const doc_ref_db_res = await doc_ref_db.find({selector: {'context.encounter.0.reference': {'$regex': objectPath.get(doc, 'sync_id')}, _id: {"$gte": null}}})
          if (doc_ref_db_res.docs.length > 0) {
            if (!objectPath.has(timelineItem, 'bundle')) {
              objectPath.set(timelineItem, 'document_reference', objectPath.get(doc_ref_db_res, 'docs.0'))
            }
          }
        }
      }
      if (opts.resource === 'document_references') {
        const binary_ids = []
        for (const c in objectPath.get(doc, 'content')) {
          const binary_id = objectPath.get(doc, 'content.' + c + '.attachment.url').substring(objectPath.get(doc, 'content.' + c + '.attachment.url').indexOf('/') + 1)
          binary_ids.push(binary_id)
        }
        objectPath.set(timelineItem, 'binaries', binary_ids)
      }
      timeline.push(timelineItem)
    }
  }
  if (result.rows.length > 0) {
    if (opts.action === 'update') {
      timeline.sort((c, d) => d.date - c.date)
    }
    objectPath.set(timeline_doc, 'timeline', timeline)
    await sync('timeline', patient_id, true, timeline_doc)
    
  }
  return timeline
}

function urlFix(url) {
  return url.replace(/\/?$/, '/')
}

async function userAdd() {
  const id = 'nosh_' + uuidv4()
  const user = {
    display: process.env.NOSH_DISPLAY,
    id: id,
    _id: id,
    email: process.env.NOSH_EMAIL,
    role: process.env.NOSH_ROLE,
    did: process.env.NOSH_DID
  }
  const id1 = 'nosh_' + uuidv4()
  if (user.role === 'patient') {
    const patient = {
      "_id": id1,
      "resourceType": "Patient",
      "id": id1,
      "name": [
        {
          "family": process.env.NOSH_LASTNAME,
          "given": [
            process.env.NOSH_FIRSTNAME
          ],
          "use": "official",
        }
      ],
      "text": {
        "status": "generated",
        "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">" + process.env.NOSH_FIRSTNAME + ' ' + process.env.NOSH_LASTNAME + "</div>"
      },
      "birthDate": process.env.NOSH_BIRTHDAY,
      "gender": process.env.NOSH_GENDER,
      "extension": [
        {
          "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race"
        },
        {
          "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"
        },
        {
          "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
          "valueCode": process.env.NOSH_BIRTHGENDER
        }
      ]
    }
    await sync('patients', id1, true, patient)
    objectPath.set(user, 'reference', 'Patient/' + id1)
    await sync('users', id1, true, user)
  }
  if (user.role === 'provider') {
    const practitioner = {
      "_id": id1,
      "resourceType": "Practitioner",
      "id": id1,
      "name": [
        {
          "family": process.env.NOSH_LASTNAME,
          "use": "official",
          "given": [
            process.env.NOSH_FIRSTNAME
          ],
          "suffix": [
            process.env.NOSH_SUFFIX
          ]
        }
      ],
      "text": {
        "status": "generated",
        "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">" + process.env.NOSH_FIRSTNAME + ' ' + process.env.NOSH_LASTNAME + ', ' + process.env.NOSH_SUFFIX + "</div>"
      }
    }
    await sync('practitioners', '', true, practitioner)
    objectPath.set(user, 'reference', 'Practitioner/' + id1)
    objectPath.set(user, 'templates', JSON.parse(fs.readFileSync('./assets/templates.json')))
    await sync('users', '', true, user)
  }
  return user
}

async function verify(jwt) {
  const keys = await getAllKeys()
  const response = {}
  let found = 0
  if (keys.keys.length > 0) {
    for (const a in keys.keys) {
      const jwk = await jose.importJWK(keys.keys[a])
      try {
        const { payload, protectedHeader } = await jose.jwtVerify(jwt, jwk)
        objectPath.set(response, 'payload', payload)
        objectPath.set(response, 'protectedHeader', protectedHeader)
        found++
      } catch (err) {
        objectPath.set(response, 'errors.' + a, err)
      }
    }
    if (found > 0) {
      objectPath.set(response, 'status', 'isValid')
    } else {
      objectPath.set(response, 'status', 'notValid')
    }
  } else {
    objectPath.set(response, 'status', 'noKeys')
  }
  return response
}

async function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    try {
      const a = await axios.get(urlFix(process.env.TRUSTEE_URL) + '/api/as/.well-known/gnap-as-rs')
      const err = new Error('You are not authenticated!')
      res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
      res.setHeader('WWW-Authenticate', 'GNAP as_uri=' + a.data.grant_request_endpoint).status(401).send(err)
    } catch (e) {
      console.log(e)
    }
  } else {
    let pin = true
    if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
      pin = await getPIN(req.params.pid)
    }
    if (pin) {
      const jwt = authHeader.split(' ')[1]
      const response = await verify(jwt)
      let method = 'write'
      if (response.status === 'isValid') {
        // if (objectPath.has(response, 'payload.vc') || objectPath.has(response, 'payload.vp')) {
          // has verfiable credential or verifiable presentation (multiple vc's)
          // res.status(200).json(response.payload.vc)
        // } else {
          // res.status(200).json(payload)
        // }
        if (req.method === 'GET') {
          method = 'read'
        }
        const location = req.protocol + '://' + req.hostname + req.baseUrl + req.path
        const introspect_result = await introspect(req, jwt, method, location)
        if (objectPath.has(introspect_result, 'success')) {
          res.locals.payload = response.payload
          next()
        } else {
          res.status(401).json(objectPath.get(introspect_result))
        }
      } else {
        res.status(401).json(response.error)
      }
    } else {
      res.status(401).json({status: 'awaiting resource to be available'})
    }
  }
}

async function verifyPIN(pin, patient_id) {
  const hashpins = new PouchDB('hashpins')
  const remote_hashpins = new PouchDB(urlFix(settings.couchdb_uri) + 'hashpins', settings.couchdb_auth)
  try {
    await hashpins.sync(remote_hashpins).on('complete', () => {
      console.log('PouchDB sync complete for DB: hashpins')
    }).on('error', (err) => {
      console.log(err)
    })
    try {
      const result = await hashpins.get(patient_id)
      const hash = crypto.pbkdf2Sync(pin, result.salt, 1000, 64, 'sha512').toString('hex')
      if (hash === result.hash) {
        return true
      } else {
        return false
      }
    } catch (e) {
      return false
    }
  } catch (e) {
    return false
  }
}

export { addSchemaOptions, couchdbConfig, couchdbDatabase, couchdbInstall, couchdbUpdate, createKeyPair, equals, eventAdd, eventUser, fetchJSON, fhirDisplay, fhirModel, fhirReplace, getAllKeys, getKeys, getName, getNPI, getPIN, getResource, introspect, isMarkdown, loadSelect, markdownParse, pollSet, registerResources, removeTags, signRequest, sleep, sync, timelineResources, timelineUpdate, urlFix, userAdd, verify, verifyJWT, verifyPIN }