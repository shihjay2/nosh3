require('dotenv').config()
const axios = require('axios')
const Case = require('case')
const express = require('express')
const moment = require('moment')
const objectPath = require('object-path')
const pluralize = require('pluralize')
const PouchDB = require('pouchdb')
const settings = require('./settings')
const {v4: uuidv4} = require('uuid')
const {getKeys, gnapResourceRegistration, urlFix, verify, verifyJWT} = require('./core')


const router = express.Router()
const options = {
  // scope: ['read', 'write']
  claims: [
    // {name: 'sub'},
    {name: 'aud', value: 'urn:example:audience'}
  ]
}

PouchDB.plugin(require('pouchdb-find'))
PouchDB.plugin(require('comdb'))
module.exports = router

// const jwksService = jose.createRemoteJWKSet(new URL(settings.jwks_uri))

// router.get('/api/:type', querySecuredResource) //search
// router.post('/api/:type', postSecuredResource) //create
// router.get('/api/:type/:id', getSecuredResource) //read
// router.put('/api/:type/:id', putSecuredResource) //update
// router.delete('/api/:type/:id', deleteSecuredResource) //delete
// router.get('/api/:type/:id/_history/:vid', getSecuredResourceVersion) //vread
router.get('/test', test)

router.get('/api/:type', verifyJWT, querySecuredResource) //search
router.post('/api/:type', verifyJWT, postSecuredResource) //create
router.get('/api/:type/:id', verifyJWT, getSecuredResource) //read
router.put('/api/:type/:id', verifyJWT, putSecuredResource) //update
router.delete('/api/:type/:id', verifyJWT, deleteSecuredResource) //delete
router.get('/api/:type/:id/_history/:vid', verifyJWT, getSecuredResourceVersion) //vread

async function deleteSecuredResource(req, res) {
  const startTime = performance.now()
  const db = new PouchDB(settings.couchdb_uri + '/' + Case.snake(pluralize(req.params.type)), settings.couchdb_auth)
  await db.setPassword(process.env.COUCHDB_ENCRYPT_PIN)
  try {
    const doc = await db.get(req.params.id)
    await db.remove(doc)
    const endTime = performance.now()
    const diff = endTime - startTime
    const diagnostics = "Successfully deleted 1 resource(s) in " + diff + "ms"
    res.set('ETag', 'W/"' + doc._rev + '"')
    res.status(200).json({
      "resourceType": "OperationOutcome",
      "issue": [
        {
          "severity": "information",
          "code": "informational",
          "diagnostics": diagnostics
        }
      ]
    })
  } catch (err) {
    res.status(200).json(err)
  }
}

async function getSecuredResource(req, res) {
  const db = new PouchDB(Case.snake(pluralize(req.params.type)))
  await db.setPassword(process.env.COUCHDB_ENCRYPT_PIN, {name: settings.couchdb_uri + Case.snake(pluralize(req.params.type)), opts: settings.couchdb_auth})
  await db.loadEncrypted()
  try {
    const doc = await db.get(req.params.id, {revs_info: true})
    res.status(200).json(doc)
  } catch(err) {
    res.status(200).json(err)
  }
  // res.status(200).json({ data: "Some data from secured endpoint.", user: req.claims.sub });
}

async function getSecuredResourceVersion(req, res) {
  const db = new PouchDB(Case.snake(pluralize(req.params.type)))
  await db.setPassword(process.env.COUCHDB_ENCRYPT_PIN, {name: settings.couchdb_uri + Case.snake(pluralize(req.params.type)), opts: settings.couchdb_auth})
  await db.loadEncrypted()
  try {
    const doc = db.get(req.params.id, {rev: req.params.vid})
    res.status(200).json(doc)
  } catch(err) {
    res.status(200).json(err)
  }
}

// function gnapResourceRegistration(jwt, publicKey) {
//   const params = {
//     "access_token": jwt,
//     "proof": "httpsig",
//     "resource_server": {
//       "key": {
//         "proof": "httpsig",
//         "jwk": publicKey
//       }
//     }
//   }
//   axios.get(settings.as_uri + '/.well-known/gnap-as-rs').then((a) => {
//     axios.post(a.resource_registration_endpoint, params).then((b) => {
//       if (b.active === true) {
//         return true
//       } else {
//         return false
//       }
//     })
//   })
// }

async function postSecuredResource(req, res) {
  const db = new PouchDB(settings.couchdb_uri + '/' + Case.snake(pluralize(req.params.type)), settings.couchdb_auth)
  await db.setPassword(process.env.COUCHDB_ENCRYPT_PIN)
  try {
    const body = await db.put(req.body)
    res.set('ETag', 'W/"' + body._rev + '"')
    res.status(200).json(body)
  } catch(err) {
    res.status(200).json(err)
  }
}

async function putSecuredResource(req, res) {
  const db = new PouchDB(settings.couchdb_uri + '/' + Case.snake(pluralize(req.params.type)), settings.couchdb_auth)
  await db.setPassword(process.env.COUCHDB_ENCRYPT_PIN)
  try {
    const body = await db.put(req.body)
    res.set('ETag', 'W/"' + body._rev + '"')
    res.status(200).json(body)
  } catch(err) {
    res.status(200).json(err)
  }
}

async function querySecuredResource(req, res) {
  const db = new PouchDB(Case.snake(pluralize(req.params.type)))
  await db.setPassword(process.env.COUCHDB_ENCRYPT_PIN, {name: settings.couchdb_uri + Case.snake(pluralize(req.params.type)), opts: settings.couchdb_auth})
  await db.loadEncrypted()
  var entries = []
  var selector = []
  var reference_arr = ['subject','patient','encounter','asserter','requester','author']
  for (var [key, value] of Object.entries(req.query)) {
    var key1 = ''
    if (key == 'patient') {
      key = 'subject'
    }
    if (reference_arr.includes(key)) {
      key1 = Case.camel(key) + '.reference'
    } else {
      key1 = Case.camel(key)
    }
    selector.push({[key1]: value})
  }
  selector.push({_id: {"$gte": null}})
  var result = await db.find({
    selector: {$and: selector}
  })
  var i = 0
  for (var a in result.docs) {
    entries.push({
      resource: result.docs[a],
      search: {mode: 'match'}
    })
    i++
  }
  var id = 'nosh_' + uuidv4()
  var time = moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ')
  res.status(200).json({
    resourceType: 'Bundle',
    id: id,
    _id: id,
    type: 'searchset',
    timestamp: time,
    total: i,
    entry: entries 
  })
}

function test(req,res,next) {
  axios.get('http://localhost:4000/auth/createJWT').then((a) => {
   res.status(200).json({ message: a.data})
  })
  // res.status(200).json(req.protocol + '://' + req.hostname + req.baseUrl + req.path)
}
