require('dotenv').config()
const axios = require('axios')
const fs = require('fs')
const jose = require('jose')
const objectPath = require('object-path')
const PouchDB = require('pouchdb')
const settings = require('./settings')
const {v4: uuidv4} = require('uuid')

const options = {
  // scope: ['read', 'write']
  claims: [
    // {name: 'sub'},
    {name: 'aud', value: 'urn:example:audience'}
  ]
}
PouchDB.plugin(require('pouchdb-find'))

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

async function couchdbDatabase() {
  const resources = JSON.parse(fs.readFileSync('./assets/resources.json'))
  for (var resource of resources.rows) {
    const db_resource = new PouchDB((settings.couchdb_uri + '/' + resource.resource), settings.couchdb_auth)
    await db_resource.info()
  }
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
  objectPath.set(public_key, 'kid', uuidv4())
  objectPath.set(public_key, 'alg', alg)
  var private_key = await jose.exportJWK(privateKey)
  objectPath.set(private_key, 'kid', uuidv4())
  objectPath.set(private_key, 'alg', alg)
  var keys = await getKeys()
  if (keys.length > 0) {
    var doc = keys[0]
    objectPath.set(doc, 'publicKey', public_key)
    objectPath.set(doc, 'privateKey', private_key)
  } else {
    var id = 'nosh_' + uuidv4()
    var doc = {_id: id, publicKey: public_key, privateKey: private_key}
  }
  const db = new PouchDB((settings.couchdb_uri + '/keys'), settings.couchdb_auth)
  await db.put(doc)
  return doc
}

async function getAllKeys() {
  var keys = []
  var publicKey = ''
  var mojo_key = null
  var trustee_key = null
  // MojoAuth key
  var mojokey_opts = {headers: { 'X-API-Key': process.env.MOJOAUTH_API_KEY}}
  try {
    var mojo_key = await axios.get('https://api.mojoauth.com/token/jwks', mojokey_opts)
  } catch (err) {
    console.log(err)
  }
  if (mojo_key !== null && mojo_key.status === 200 && objectPath.has(mojo_key, 'data.keys')) {
    for (var a in mojo_key.data.keys) {
      keys.push(mojo_key.data.keys[a])
    }
  }
  // Trustee key
  try {
    var trustee_key = await axios.get(urlFix(process.env.TRUSTEE_URL)+ 'jwks')
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
  const db = new PouchDB((settings.couchdb_uri + '/keys'), settings.couchdb_auth)
  const result = await db.find({
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

function urlFix(url) {
  return url.replace(/\/?$/, '/')
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
        next()
      } else {
        res.status(401).send('Unauthorized')
      }
    } else {
      res.status(401).json(response.error)
    }
  }
}

module.exports = {couchdbDatabase, couchdbInstall, createKeyPair, getKeys, getNPI, gnapResourceRegistration, equals, urlFix, verify, verifyJWT}