import dotenv from 'dotenv'
dotenv.config()
import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'
import * as jose from 'jose'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb'
import settings from './settings.mjs'
import { v4 as uuidv4 } from 'uuid'

const options = {
  // scope: ['read', 'write']
  claims: [
    // {name: 'sub'},
    {name: 'aud', value: 'urn:example:audience'}
  ]
}
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)
import comdb from 'comdb'
PouchDB.plugin(comdb)

// const jwksService = jose.createRemoteJWKSet(new URL(settings.jwks_uri))

async function couchdbConfig(section, key, value) {
  var opts = JSON.parse(JSON.stringify(settings.couchdb_auth))
  objectPath.set(opts, 'headers', {'Content-Type': 'application/json'})
  var data = JSON.stringify(value).replace(/\\/g, "\\\\")
  try {
    var res = await axios.put(settings.couchdb_uri + '/_node/_local/_config/' + section + '/' + key, data, opts)
    return res.data
  } catch (e) {
    console.log(e.response.data)
    return e
  }
}

async function couchdbDatabase(patient_id='') {
  const resources = JSON.parse(fs.readFileSync('./assets/resources.json'))
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
  }
  for (var resource of resources.rows) {
    const db_resource = new PouchDB(urlFix(settings.couchdb_uri) + prefix + resource.resource, settings.couchdb_auth)
    await db_resource.info()
  }
  await eventAdd('Chart Created', {id: 'system', display: 'System', doc_db: null, doc_id: null, diff: null}, patient_id)
}

async function couchdbInstall() {
  var keys = await getKeys()
  if (keys.length === 0) {
    var pair = await createKeyPair()
    keys.push(pair)
  }
  const key = await jose.importJWK(keys[0].publicKey)
  const pem = await jose.exportSPKI(key)
  var result = []
  const commands = [
    {section: 'httpd', key: 'enable_cors', value: 'true'},
    {section: 'cors', key: 'credentials', value: 'true'},
    {section: 'cors', key: 'headers', value: 'accept, authorization, content-type, origin, referer'},
    {section: 'cors', key: 'methods', value: 'GET, PUT, POST, HEAD, DELETE'},
    {section: 'cors', key: 'origins', value: '*'},
    {section: 'chttpd', key: 'authentication_handlers', value: '{chttpd_auth, cookie_authentication_handler}, {chttpd_auth, jwt_authentication_handler}, {chttpd_auth, default_authentication_handler}'},
    {section: 'jwt_keys', key: 'rsa:_default', value: pem}
  ]
  for (var command of commands) {
    var a = await couchdbConfig(command.section, command.key, command.value)
    result.push({command: command, result: a})
  }
  await couchdbRestart()
  await sleep(5)
  return result
}

async function couchdbRestart() {
  var opts = settings.couchdb_auth
  objectPath.set(opts, 'headers', {'Content-Type': 'application/json'})
  try {
    var res = await axios.post(settings.couchdb_uri + '/_node/_local/_restart', '', opts)
    objectPath.del(opts, 'headers')
    return res.data
  } catch (e) {
    console.log(e.response.data)
    return e
  }
}

async function createKeyPair(alg='RS256') {
  const { publicKey, privateKey } = await jose.generateKeyPair(alg)
  var public_key = await jose.exportJWK(publicKey)
  const kid = uuidv4()
  objectPath.set(public_key, 'kid', kid)
  objectPath.set(public_key, 'alg', alg)
  var private_key = await jose.exportJWK(privateKey)
  objectPath.set(private_key, 'kid', kid)
  objectPath.set(private_key, 'alg', alg)
  var id = 'nosh_' + uuidv4()
  var keys = await getKeys()
  if (keys.length > 0) {
    var doc = keys[0]
    objectPath.set(doc, 'publicKey', public_key)
    objectPath.set(doc, 'privateKey', private_key)
  } else {
    var doc = {_id: id, publicKey: public_key, privateKey: private_key}
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
  const db = new PouchDB('activities')
  var doc = {
    _id: 'nosh_' + uuidv4(),
    datetime: moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
    event: event,
    user: opts.display,
    user_id: opts.id,
    doc_db: opts.doc_db,
    doc_id: opts.doc_id,
    diff: opts.diff
  }
  await db.put(doc)
  await sync('activities', patient_id)
}

async function getAllKeys() {
  var keys = []
  var publicKey = ''
  var trustee_key = null
  // Trustee key
  try {
    var trustee_key = await axios.get(urlFix(process.env.TRUSTEE_URL) + 'jwks')
  } catch (err) {
    console.log(err)
  }
  if (trustee_key !== null && trustee_key.status === 200 && objectPath.has(trustee_key, 'data.keys')) {
    for (var b in trustee_key.data.keys) {
      keys.push(trustee_key.data.keys[b])
    }
  }
  // Local key
  const db = new PouchDB((settings.couchdb_uri + '/keys'), settings.couchdb_auth)
  const result = await db.find({
    selector: {_id: {"$gte": null}}
  })
  for (var a in result.docs) {
    keys.push(result.docs[a].publicKey)
    if (objectPath.has(result, 'docs.' + a + '.privateKey')) {
      publicKey = result.docs[a].publicKey
    }
  }
  return {keys: keys, publicKey: publicKey}
}

async function getKeys() {
  const db = new PouchDB(urlFix(settings.couchdb_uri) + 'keys', settings.couchdb_auth)
  var result = await db.find({
    selector: {_id: {"$gte": null}, privateKey: {"$gte": null}}
  })
  return result.docs
}

function getNPI(vc) {
  var npi = ''
  if (objectPath.has(vc, 'credentialSubject.fhirBundle.entry')) {
    var a = objectPath.get(vc, 'credentialSubject.fhirBundle.entry').find(b => b.resource.resourceType == 'Practitioner')
    if (a !== undefined) {
      if (objectPath.has(a.identifier)) {
        var c = objectPath.get(a, 'identifier').find(d => d.system == 'http://hl7.org/fhir/sid/us-npi')
        if (c !== undefined) {
          npi = c.value
        }
      }
    }
  }
  return npi
}

async function getPIN(patient_id) {
  const db = new PouchDB('pins')
  const result = await db.get(patient_id)
  return result.pin
}

async function getUser(email) {
  await sync('users')
  var db = new PouchDB('users')
}

async function gnapInstrospect(jwt, publicKey, location, action) {
  const params = {
    "access_token": jwt,
    "proof": "httpsig",
    "resource_server": {
      "key": {
        "proof": "httpsig",
        "jwk": publicKey
      }
    }
  }
  try {
    var a = await axios.get(urlFix(process.env.TRUSTEE_URL) + '.well-known/gnap-as-rs')
  } catch (err) {
    console.log(err)
    return false
  }
  try {
    var b = await axios.post(a.introspection_endpoint, params)
  } catch (err) {
    console.log(err)
    return false
  }
  if (b.active === true) {
    var i = 0
    for (var c in b.access) {
      var d = b.access[c].locations.find(c => c === location)
      if (d !== undefined) {
        var e = b.access[c].actions.find(f => f === action)
        if (e !== undefined) {
          i++
        }
      }
    }
    if (i > 0) {
      return true
    } else {
      return false
    }
  } else {
    return false
  }
}

async function gnapResourceRegistration(jwt, publicKey) {
  const params = {
    "access_token": jwt,
    "proof": "httpsig",
    "resource_server": {
      "key": {
        "proof": "httpsig",
        "jwk": publicKey
      }
    }
  }
  const a = await axios.get(urlFix(process.env.TRUSTEE_URL) + '.well-known/gnap-as-rs')
  const b = await axios.post(a.resource_registration_endpoint, params)
  if (b.active === true) {
    return true
  } else {
    return false
  }
}

async function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function sync(resource, patient_id='', save=false, data={}) {
  var prefix = ''
  var pin = process.env.COUCHDB_ENCRYPT_PIN
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = patient_id + '_'
    pin = await getPIN(patient_id)
  }
  const local = new PouchDB(prefix + resource)
  if (resource !== 'users') {
    await local.setPassword(pin, {name: urlFix(settings.couchdb_uri) + prefix + resource, opts: settings.couchdb_auth})
  }
  if (save) {
    const result = await local.put(data)
    await eventAdd('Updated ' + pluralize.singular(resource.replace('_statements', '')), {id: 'system', display: 'System', doc_db: resource, doc_id: result.id, diff: null}, patient_id)
  }
  if (resource !== 'users') {
    var info = await local.info()
    if (info.doc_count > 0) {
      await local.loadDecrypted()
    }
    await local.loadEncrypted()
    console.log('PouchDB sync complete for DB: ' + resource)
  } else {
    var remote = new PouchDB(urlFix(settings.couchdb_uri) + prefix + resource, settings.couchdb_auth)
    await local.sync(remote).on('complete', () => {
      console.log('PouchDB sync complete for DB: ' + resource)
    }).on('error', (err) => {
      console.log(err)
    })
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
  var id1 = 'nosh_' + uuidv4()
  if (process.env.NOSH_PATIENT !== '') {
    id1 = process.env.NOSH_PATIENT
  }
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
  
  return 'OK'
}

async function verify(jwt) {
  var keys = await getAllKeys()
  var response = {}
  var found = false
  if (keys.keys.length > 0) {
    for (var a in keys.keys) {
      const jwk = await jose.importJWK(keys.keys[a])
      try {
        const { payload, protectedHeader } = await jose.jwtVerify(jwt, jwk)
        objectPath.set(response, 'status', 'isValid')
        objectPath.set(response, 'payload', payload)
        objectPath.set(response, 'protectedHeader', protectedHeader)
        found = true
      } catch (err) {
        if (found !== true) {
          objectPath.set(response, 'status', 'notValid')
          objectPath.set(response, 'error', err)
        }
      }
    }
  } else {
    objectPath.set(repsonse, 'status', 'noKeys')
  }
  return response
}

async function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    axios.get(urlFix(process.env.TRUSTEE_URL) + '.well-known/gnap-as-rs').then((a) => {
      const err = new Error('You are not authenticated!')
      res.setHeader('WWW-Authenticate', 'GNAP as_uri=' + a.grant_request_endpoint).status(401).send(err)
    })
  } else {
    const jwt = authHeader.split(' ')[1]
    const response = await verify(jwt)
    var method = 'write'
    if (response.status === 'isValid') {
      // if (objectPath.has(response, 'payload.vc') || objectPath.has(response, 'payload.vp')) {
        // has verfiable credential or verifiable presentation (multiple vc's)
        // res.status(200).json(response.payload.vc)
      // } else {
        // res.status(200).json(payload)
      // }
      const url = req.protocol + '://' + req.hostname + req.baseUrl + req.path
      if (req.method === 'GET') {
        method = 'read'
      }
      if (gnapInstrospect(jwt, keys.publicKey, url, method)) {
        res.local.payload = response.payload
        next()
      } else {
        res.status(401).send('Unauthorized')
      }
    } else {
      res.status(401).json(response.error)
    }
  }
}

async function verifyPIN(pin, patient_id) {
  const hashpins = new PouchDB('hashpins')
  const remote_hashpins = new PouchDB(urlFix(settings.couchdb_uri) + 'hashpins', settings.couchdb_auth)
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
}

export { couchdbConfig, couchdbDatabase, couchdbInstall, createKeyPair, equals, eventAdd, getKeys, getNPI, getPIN, getUser, gnapResourceRegistration, sleep, sync, urlFix, userAdd, verify, verifyJWT, verifyPIN }