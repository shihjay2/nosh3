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
        const destroy_remote= new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'activities', settings.couchdb_auth)
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

export { couchdbConfig, couchdbDatabase, couchdbInstall, couchdbUpdate, createKeyPair, equals, eventAdd, eventUser, getAllKeys, getKeys, getName, getNPI, getPIN, introspect, isMarkdown, markdownParse, pollSet, registerResources, signRequest, sleep, sync, urlFix, userAdd, verify, verifyJWT, verifyPIN }