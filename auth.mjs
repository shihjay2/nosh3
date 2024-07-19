import dotenv from 'dotenv'
dotenv.config()
import crypto from 'crypto'
import express from 'express'
import fs from 'fs'
import isReachable from 'is-reachable'
import * as jose from 'jose'
// const Mailgun = require('mailgun.js')
import objectPath from 'object-path'
import PouchDB from 'pouchdb'
import settings from './settings.mjs'
import sortArray from "sort-array"
import { v4 as uuidv4 } from 'uuid'
import { couchdbDatabase, couchdbInstall, couchdbUpdate, createKeyPair, equals, getKeys, getName, getNPI, getPIN, registerResources, signRequest, sync, urlFix, verify, verifyPIN } from './core.mjs'
const router = express.Router()
import PouchDBFind from 'pouchdb-find'
import PouchDBAdapterMemory from 'pouchdb-adapter-memory'
PouchDB.plugin(PouchDBFind)
PouchDB.plugin(PouchDBAdapterMemory)
export default router

router.post('/verifyJWT', verifyJWTEndpoint)
router.get('/jwks', jwks) // endpoint to share public key
router.get('/config', config)
router.post('/authenticate', authenticate)
router.get('/exportJWT', exportJWT)
router.post('/addPatient', addPatient)
router.post('/addResources', addResources)

router.post('/gnapAuth', gnapAuth)
router.post('gnapProxy', gnapProxy)
router.post('/gnapResource', gnapResource)
router.post('/gnapResources', gnapResources)
router.get('/gnapVerify/:patient', gnapVerify)

router.post('/pinCheck', pinCheck)
router.post('/pinClear', pinClear)
router.post('/pinSet', pinSet)

router.get('/test', test)

function config(req, res) {
  const response = {
    auth: process.env.AUTH
  }
  if (process.env.AUTH === 'magic') {
    objectPath.set(response, 'key', process.env.MAGIC_API_KEY)
  }
  if (process.env.AUTH === 'trustee') {
    objectPath.set(response, 'key', process.env.GNAP_API_KEY)
    objectPath.set(response, 'url', process.env.TRUSTEE_URL)
  }
  objectPath.set(response, 'instance', process.env.INSTANCE)
  if (process.env.NOSH_ROLE === 'patient') {
    objectPath.set(response, 'type', 'pnosh')
  } else {
    objectPath.set(response, 'type', 'mdnosh')
  }
  res.status(200).json(response)
}

async function authenticate(req, res) {
  if (req.get('referer') === req.protocol + '://' + req.hostname + '/app/login') {
    if (req.body.auth === 'magic') {
      var email = req.body.email
    }
    var pin = process.env.COUCHDB_ENCRYPT_PIN
    var prefix = ''
    if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
      prefix = req.body.patient + '_'
      pin = await getPIN(req.body.patient)
    }
    if (!pin) {
      res.status(401).send('Unauthorized - No PIN set')
    } else {
      const db_users = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'users', settings.couchdb_auth)
      const result_users = await db_users.find({selector: {'email': {$eq: email}}})
      if (result_users.docs.length > 0) {
        var payload = {
          "_auth": req.body,
          "_nosh": {
            "email": email,
            "id": result_users.docs[0].id,
            "display": result_users.docs[0].display,
            "did": '',
            "pin": pin,
            "trustee": '',
            "instance": process.env.INSTANCE,
            "prefix": prefix
          },
          "_noshAuth": process.env.AUTH,
          "_noshAPI": {
            "uspstf_key": process.env.USPSTF_KEY,
            "umls_key": process.env.UMLS_KEY,
            "mailgun_key": process.env.MAILGUN_API_KEY,
            "mailgun_domain": process.env.MAILGUN_DOMAIN,
            "oidc_relay_url": process.env.OIDC_RELAY_URL
          },
          "jwt": ""
        }
        if (!objectPath.has(result_users, 'docs.0.defaults')) {
          const user_doc = await db_users.get(result_users.docs[0]._id)
          const defaults = {
            "class": 'AMB',
            "type": '14736009',
            "serviceType": '124',
            "serviceCategory": ' 17',
            "appointmentType": 'ROUTINE',
            "category": '34109-9',
            "code": '34108-1'
          }
          objectPath.set(user_doc, 'defaults', defaults)
          await db_users.put(user_doc)
        }
        if (process.env.INSTANCE == 'dev') {
          objectPath.set(payload, '_noshDB', urlFix(req.protocol + '://' + req.hostname + '/couchdb'))
        } else {
          objectPath.set(payload, '_noshDB', urlFix(process.env.COUCHDB_URL))
        }
        if (process.env.AUTH == 'trustee') {
          objectPath.set(payload, '_nosh.trustee', urlFix(process.env.TRUSTEE_URL) )
        }
        if (process.env.NOSH_ROLE == 'patient') {
          await sync('patients', req.body.patient)
          const db_patients = new PouchDB(prefix + 'patients')
          const result_patients = await db_patients.find({selector: {_id: {$regex: '^nosh_*'}}})
          if (result_patients.docs.length > 0) {
            if (req.body.route === null) {
              objectPath.set(payload, '_noshRedirect', '/app/chart/' + result_patients.docs[0]._id)
            } else {
              objectPath.set(payload, '_noshRedirect', req.body.route)
            }
            objectPath.set(payload, '_noshType', 'pnosh')
            objectPath.set(payload, '_nosh.patient', result_patients.docs[0]._id)
            const jwt = await createJWT(result_users.docs[0].id, urlFix(req.protocol + '://' + req.hostname + '/'), urlFix(req.protocol + '://' + req.hostname + '/'), payload)
            res.status(200).send(jwt)
          } else {
            // not installed yet
            res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'start')
          }
        } else {
          if (req.body.route === null) {
            objectPath.set(payload, '_noshRedirect', '/app/dashboard')
          } else {
            objectPath.set(payload, '_noshRedirect', req.body.route)
          }
          objectPath.set(payload, '_noshType', 'mdnosh')
          const jwt = await createJWT(result_users.docs[0].id, urlFix(req.protocol + '://' + req.hostname + '/'), urlFix(req.protocol + '://' + req.hostname + '/'), payload)
          res.status(200).send(jwt)
        }
      } else {
        res.status(401).send('Unauthorized - User not found')
      }
    }
  } else {
    res.status(401).send('Unauthorized - URL does not match')
  }
}

async function gnapAuth(req, res) {
  var pin = process.env.COUCHDB_ENCRYPT_PIN
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.body.patient + '_'
    pin = await getPIN(req.body.patient)
  }
  if (!pin) {
    res.status(401).send('Unauthorized - No PIN set')
  } else {
    await couchdbUpdate(req.body.patient, req.protocol, req.hostname)
    const body = {
      "access_token": {
        "access": [
          {
            "type": "App",
            "actions": ["read", "write"],
            "locations": [req.protocol + "://" + req.hostname + "/app/chart/" + req.body.patient],
            "purpose": "Clinical - Routine"
          }
        ]
      },
      "interact": {
        "start": ["redirect"],
        "finish": {
          "method": "redirect",
          "uri": req.protocol + "://" + req.hostname + "/auth/gnapVerify/" + req.body.patient,
          "nonce": crypto.randomBytes(16).toString('base64url')
        }
      }
    }
    const signedRequest = await signRequest(body, urlFix(process.env.TRUSTEE_URL) + 'api/as/tx', 'POST', req)
    try {
      const doc = await fetch(urlFix(process.env.TRUSTEE_URL) + 'api/as/tx', signedRequest)
        .then((res) => res.json())
      var db = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'gnap', settings.couchdb_auth)
      objectPath.set(doc, '_id', doc.interact.redirect.substring(doc.interact.redirect.lastIndexOf('/') + 1))
      objectPath.set(doc, 'nonce', objectPath.get(body, 'interact.finish.nonce'))
      objectPath.set(doc, 'route', req.body.route)
      objectPath.set(doc, 'patient', req.body.patient)
      await db.put(doc)
      res.status(200).json(doc)
    } catch (e) {
      res.status(401).json(e)
    }
  }
}

async function gnapProxy(req, res) {
  var pin = process.env.COUCHDB_ENCRYPT_PIN
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.body.patient + '_'
    pin = await getPIN(req.body.patient)
  }
  if (!pin) {
    res.status(401).send('Unauthorized - No PIN set')
  } else {
    const body = {
      "access_token": {
        "access": [
          {
            "type": req.body.type,
            "actions": ["read", "write"],
            "locations": [req.body.location],
            "purpose": "Clinical - Routine"
          }
        ]
      },
      "token": req.body.token
    }
    const signedRequest = await signRequest(body, urlFix(process.env.TRUSTEE_URL) + 'api/as/proxy', 'POST', req)
    try {
      const doc = await fetch(urlFix(process.env.TRUSTEE_URL) + 'api/as/proxy', signedRequest)
        .then((res) => res.json())
      res.status(200).json(doc)
    } catch (e) {
      res.status(401).json(e)
    }
  }
}

async function gnapResource(req, res) {
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    const body = {resource: req.body.resource}
    try {
      const signedRequest = await signRequest(body, urlFix(process.env.TRUSTEE_URL) + 'api/as/resource', req.body.method, req, req.body.jwt)
      try {
        const update = await fetch(urlFix(process.env.TRUSTEE_URL) + 'api/as/resource', signedRequest)
          .then((res) => {
            if (res.status > 400 && res.status < 600) { 
              return {error: res}
            } else {
              return res.json()
            }
          })
        res.status(200).json(update)
      } catch (e) {
        console.log(e)
      }
    } catch (e) {
      console.log(e)
    }
  } else {
    res.status(401).send('Unauthorized - feature not available')
  }
}

async function gnapResources(req, res) {
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    const body = {email: req.body.email, filter: req.body.filter}
    try {
      const signedRequest = await signRequest(body, urlFix(process.env.TRUSTEE_URL) + 'api/as/resources', 'POST', req)
      try {
        const resources = await fetch(urlFix(process.env.TRUSTEE_URL) + 'api/as/resources', signedRequest)
          .then((res) => res.json())
        sortArray(resources, {by: 'type', order: 'asc'})
        res.status(200).json(resources)
      } catch (e) {
        console.log(e)
      }
    } catch (e) {
      console.log(e)
    }
  } else {
    res.status(401).send('Unauthorized - feature not available')
  }
}

async function gnapVerify(req, res) {
  var pin = process.env.COUCHDB_ENCRYPT_PIN
  var prefix = ''
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    prefix = req.params.patient + '_'
    pin = await getPIN(req.params.patient)
  }
  if (!pin) {
    res.status(401).send('Unauthorized - No PIN set')
  } else {
    var db = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'gnap', settings.couchdb_auth)
    try {
      var result = await db.get(req.query.interact_ref)
      const hash = crypto.createHash('sha256')
      hash.update(result.nonce + '\n')
      hash.update(result.interact.finish + '\n')
      hash.update(req.query.interact_ref + '\n')
      hash.update(urlFix(process.env.TRUSTEE_URL) + 'api/as/tx')
      const hash_result = hash.digest('base64url')
      if (hash_result !== req.query.hash) {
        res.status(401).send('Interaction hash does not match')
      } else {
        const body = {"interact_ref": req.query.interact_ref}
        try {
          const signedRequest = await signRequest(body, urlFix(process.env.TRUSTEE_URL) + 'api/as/continue', 'POST', req, result.continue.access_token.value)
          try {
            const doc = await fetch(result.continue.uri, signedRequest)
              .then((res) => res.json())
            await db.remove(result)
            if (objectPath.has(doc, 'access_token.subject')) {
              const nosh = {
                email: '',
                did: '',
                pin: pin,
                npi: '',
                display: '',
                trustee: urlFix(process.env.TRUSTEE_URL),
                instance: process.env.INSTANCE,
                prefix: prefix
              }
              var user_id = ''
              // assume access token is JWT that contains verifiable credentials and if valid, attach to payload
              const jwt = doc.access_token.value
              try {
                const verify_results = await verify(jwt)
                console.log(verify_results)
                if (verify_results.status === 'isValid') {
                  if (objectPath.has(verify_results, 'payload.vc')) {
                    var name_obj = getName(objectPath.get(verify_results, 'payload.vc'))
                    objectPath.set(nosh, 'display', name_obj.display)
                    const npi = getNPI(objectPath.get(verify_results, 'payload.vc'))
                    if (npi !== '') {
                      objectPath.set(nosh, 'npi', getNPI(objectPath.get(verify_results, 'payload.vc')))
                      objectPath.set(nosh, 'role', 'provider')
                    }
                  }
                  // if (objectPath.has(verify_results, 'payload.vp') && npi !== '') {
                  //   for (var b in objectPath.get(verify_results, 'payload.vp.verifiableCredential')) {
                  //     if (npi !== '') {
                  //       objectPath.set(nosh, 'npi', getNPI(objectPath.get(verify_results, 'payload.vp.verifiableCredential.' + b )))
                  //       objectPath.set(nosh, 'role', 'provider')
                  //     }
                  //   }
                  // }
                  const db_users = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'users', settings.couchdb_auth)
                  const result_users = await db_users.find({selector: {'email': {"$eq": objectPath.get(verify_results, 'payload.sub')}}})
                  objectPath.set(nosh, 'email', objectPath.get(verify_results, 'payload.sub'))
                  const payload = {
                    "_gnap": doc,
                    "jwt": jwt,
                    "_noshAPI": {
                      "uspstf_key": process.env.USPSTF_KEY,
                      "umls_key": process.env.UMLS_KEY,
                      "mailgun_key": process.env.MAILGUN_API_KEY,
                      "mailgun_domain": process.env.MAILGUN_DOMAIN,
                      "oidc_relay_url": process.env.OIDC_RELAY_URL
                    }
                  }
                  if (result_users.docs.length > 0) {
                    if (!objectPath.has(result_users, 'docs.0.defaults')) {
                      const user_doc = await db_users.get(result_users.docs[0]._id)
                      const defaults = {
                        "class": 'AMB',
                        "type": '14736009',
                        "serviceType": '124',
                        "serviceCategory": ' 17',
                        "appointmentType": 'ROUTINE',
                        "category": '34109-9',
                        "code": '34108-1'
                      }
                      objectPath.set(user_doc, 'defaults', defaults)
                      await db_users.put(user_doc)
                    }
                    user_id = result_users.docs[0].id
                    if (objectPath.has(verify_results, 'payload._nosh')) {
                      // there is an updated user object from wallet, so sync to this instance
                      if (!equals(objectPath.get(verify_results, 'payload._nosh'), result_users.docs[0])) {
                        const new_user = await db_users.put(objectPath.get(verify_results, 'payload._nosh'))
                        objectPath.set(nosh, '_id', new_user.id)
                        objectPath.set(nosh, 'id', new_user.id)
                        objectPath.set(nosh, '_rev', new_user.rev)
                        const user_doc1 = await db_users.get(result_users.docs[0]._id)
                        await db_users.delete(user_doc1)
                      }
                    }
                    objectPath.set(nosh, 'id', user_id)
                    objectPath.set(nosh, 'display', result_users.docs[0].display)
                  } else {
                    // add new user - authorization server has already granted
                    const new_user = JSON.parse(JSON.stringify(nosh))
                    user_id = 'nosh_' + uuidv4()
                    objectPath.set(new_user, '_id', user_id)
                    objectPath.set(new_user, 'id', user_id)
                    objectPath.set(new_user, 'templates', JSON.parse(fs.readFileSync('./assets/templates.json')))
                    console.log(new_user)
                    console.log(name_obj)
                    if (!objectPath.has(new_user, 'role')) {
                      objectPath.set(new_user, 'role', 'proxy')
                      const related_person_id = 'nosh_' + uuidv4()
                      const related_person = {
                        "_id": related_person_id,
                        "resourceType": "RelatedPerson",
                        "id": related_person_id,
                        "name": [
                          {
                            "family": name_obj.parsed.last,
                            "use": "official",
                            "given": [
                              name_obj.parsed.first
                            ],
                            "suffix": [
                              name_obj.parsed.suffix
                            ]
                          }
                        ],
                        "text": {
                          "status": "generated",
                          "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">" + name_obj.display + "</div>"
                        }
                      }
                      console.log(related_person)
                      await sync('related_persons', req.params.patient, true, related_person)
                      objectPath.set(new_user, 'reference', 'RelatedPerson/' + related_person_id)
                    } else {
                      // this is a provider
                      const practitioner_id = 'nosh_' + uuidv4()
                      const practitioner = {
                        "_id": practitioner_id,
                        "resourceType": "Practitioner",
                        "id": practitioner_id,
                        "name": [
                          {
                            "family": name_obj.parsed.last,
                            "use": "official",
                            "given": [
                              name_obj.parsed.first
                            ],
                            "suffix": [
                              name_obj.parsed.suffix
                            ]
                          }
                        ],
                        "text": {
                          "status": "generated",
                          "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">" + name_obj.display + "</div>"
                        }
                      }
                      await sync('practitioners', req.params.patient, true, practitioner)
                      objectPath.set(new_user, 'reference', 'Practitioner/' + practitioner_id)
                    }
                    await db_users.put(new_user)
                  }
                  objectPath.set(payload, '_nosh', nosh)
                  objectPath.set(payload, '_noshAuth', 'trustee')
                  if (process.env.INSTANCE == 'dev') {
                    objectPath.set(payload, '_noshDB', urlFix(req.protocol + '://' + req.hostname + '/couchdb'))
                  } else {
                    objectPath.set(payload, '_noshDB', urlFix(process.env.COUCHDB_URL))
                  }
                  if (process.env.NOSH_ROLE == 'patient') {
                    await sync('patients', req.params.patient)
                    const db_patients = new PouchDB(prefix + 'patients')
                    const result_patients = await db_patients.find({selector: {_id: {$regex: '^nosh_*'}}})
                    if (result_patients.docs.length > 0) {
                      if (result.route === null) {
                        objectPath.set(payload, '_noshRedirect','/app/chart/' + result_patients.docs[0]._id)
                      } else {
                        objectPath.set(payload, '_noshRedirect', result.route)
                      }
                      objectPath.set(payload, '_noshType', 'pnosh')
                      objectPath.set(payload, '_nosh.patient', req.params.patient)
                    } else {
                      // not installed yet
                      res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'start')
                    }
                  } else {
                    if (result.route === null) {
                      objectPath.set(payload, '_noshRedirect', '/app/dashboard/')
                    } else {
                      objectPath.set(payload, '_noshRedirect', result.route)
                    }
                    objectPath.set(payload, '_noshType', 'mdnosh')
                  }
                  const jwt_nosh = await createJWT(user_id, urlFix(req.protocol + '://' + req.hostname + '/'), urlFix(req.protocol + '://' + req.hostname + '/'), payload)
                  res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'app/verify?token=' + jwt_nosh + '&patient=' + req.params.patient)
                } else {
                  res.status(401).send('Unauthorized')
                }
              } catch (e) {
                res.status(401).json(e)
              }
            } else {
              res.status(200).json(doc)
            }
          } catch (e) {
            res.status(401).json(e)
          }
        } catch (e) {
          res.status(401).json(e)
        }
      }
    } catch (e) {
      res.status(401).json(e)
    }
  }
}

async function createJWT(sub, aud, iss, payload=null) {
  // aud is audience - base url of this server
  var keys = await getKeys()
  if (keys.length === 0) {
    var pair = await createKeyPair()
    keys.push(pair)
  }
  const rsaPrivateKey = await jose.importJWK(keys[0].privateKey, 'RS256')
  const payload_vc = {
    // app specific payload
    "_couchdb.roles": ["_admin"],
    "_nosh": {
      "role": "provider" // provider, patient, support, proxy
    }
  }
  if (payload !== null) {
    var payload_final = {
      ...payload_vc,
      ...payload
    }
  } else {
    var payload_final = payload_vc
  }
  var header = { alg: 'RS256' }
  const jwt = await new jose.SignJWT(payload_final)
    .setProtectedHeader(header)
    .setIssuedAt()
    .setIssuer(iss)
    .setAudience(aud)
    .setExpirationTime('2h')
    .setSubject(sub)
    .sign(rsaPrivateKey)
  return jwt
}

async function verifyJWTEndpoint(req, res) {
  const ret = await verify(req.body.token)
  res.status(200).send(ret)
}

async function exportJWT(req, res) {
  var keys = await getKeys()
  if (keys.length === 0) {
    var pair = await createKeyPair()
    keys.push(pair)
  }
  const key = await jose.importJWK(keys[0].publicKey)
  const pem = await jose.exportSPKI(key)
  res.status(200).json(pem)
}

async function jwks(req, res) {
  var keys_arr = []
  var keys = await getKeys()
  if (keys.length === 0) {
    var pair = await createKeyPair()
    keys.push(pair)
  }
  keys_arr.push(keys[0].publicKey)
  res.status(200).json({
    keys: keys_arr
  })
}

async function addPatient(req, res, next) {
  var opts = JSON.parse(JSON.stringify(settings.couchdb_auth))
  objectPath.set(opts, 'skip_setup', true)
  const check = new PouchDB(urlFix(settings.couchdb_uri) + 'users', opts)
  var b = false
  try {
    const info = await check.info()
    if (objectPath.has(info, 'error')) {
      await couchdbInstall()
      var c = 0
      while (!b && c < 40) {
        b = await isReachable(settings.couchdb_uri)
        if (b || c === 39) {
          break
        } else {
          c++
        }
      }
    } else {
      b = true
    }
  } catch (e) {
    console.log(e)
  }
  if (b) {
    const id = 'nosh_' + uuidv4()
    const user = {
      display: req.body.user.display,
      id: id,
      _id: id,
      email: req.body.user.email,
      role: 'patient',
      did: req.body.user.did
    }
    var patient_id = 'nosh_' + uuidv4()
    const patient = {
      "_id": patient_id,
      "resourceType": "Patient",
      "id": patient_id,
      "name": [
        {
          "family": req.body.patient.lastname,
          "given": [
            req.body.patient.firstname
          ],
          "use": "official",
        }
      ],
      "text": {
        "status": "generated",
        "div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">" + req.body.patient.firstname + ' ' + req.body.patient.lastname + "</div>"
      },
      "birthDate": req.body.patient.dob,
      "gender": req.body.patient.gender,
      "extension": [
        {
          "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race"
        },
        {
          "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"
        },
        {
          "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex",
          "valueCode": req.body.patient.birthgender
        }
      ]
    }
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(req.body.pin, salt, 1000, 64, 'sha512').toString('hex')
    const pin = {
      _id: patient_id,
      hash: hash,
      salt: salt
    }
    const pin1 = {
      _id: patient_id,
      pin: req.body.pin
    }
    const hashpins = new PouchDB('hashpins')
    await hashpins.put(pin)
    const pindb = new PouchDB('pins')
    await pindb.put(pin1)
    const remote_hashpins = new PouchDB(urlFix(settings.couchdb_uri) + 'hashpins', settings.couchdb_auth)
    await hashpins.sync(remote_hashpins).on('complete', () => {
      console.log('PouchDB sync complete for DB: hashpins')
    }).on('error', (err) => {
      console.log(err)
    })
    await sync('patients', patient_id, true, patient)
    objectPath.set(user, 'reference', 'Patient/' + patient_id)
    await sync('users', patient_id, true, user)
    await couchdbDatabase(patient_id, req.protocol, req.hostname, req.body.user.email)
    res.status(200).json({
      patient_id: patient_id,
      url: urlFix(req.protocol + '://' + req.hostname + '/') + 'app/chart/' + patient_id
    })
  } else {
    res.status(200).json({response: 'Error connecting to database'})
  }
}

async function addResources(req, res, next) {
  const result = await registerResources(req.body.id, req.protocol, req.hostname, req.body.email)
  res.status(200).json(result)
}

async function pinCheck (req, res, next) {
  if (process.env.INSTANCE === 'digitalocean' && process.env.NOSH_ROLE === 'patient') {
    const db = new PouchDB('pins', {skip_setup: true})
    try {
      await db.info()
      const result = await db.find({selector: {'_id': {$eq: req.body.patient}}})
      if (result.docs.length > 0) {
        const sync_db = new PouchDB('sync')
        const sync = {status: 'nothing to sync', resources: []}
        try {
          const result = await sync_db.find({selector: {'_id': {$eq: req.body.patient}}})
          console.log(result)
          if (result.docs.length > 0) {
            console.log(result.docs)
            objectPath.set(sync, 'status', 'sync')
            objectPath.set(sync, 'resources', result.docs[0].resources)
          }
          console.log(sync)
          await sync_db.remove(result.docs[0])
          res.status(200).json({ response: 'OK', sync})
        } catch (e) {
          console.log(e)
        }
      } else {
        res.status(200).json({ response: 'Error', message: 'PIN required' })
      }
    } catch (e) {
      res.status(200).json({ response: 'Error', message: 'No PIN database exists'})
    }
  } else {
    res.status(200).json({ response: 'OK', message: 'PIN check not required'})
  }
}

async function pinClear (req, res, next) {
  const db = new PouchDB('pins', {skip_setup: true})
  try {
    const info = await db.info()
    if (objectPath.has(info, 'error')) {
      res.status(200).json({ response: 'OK', message: 'No PIN database exists'})
    } else {
      if (req.body.patient == 'all') {
        await db.destroy()
        res.status(200).json({ response: 'OK', message: 'Cleared PIN database'})
      } else {
        try {
          const result = await db.get(req.body.patient)
          await db.remove(result)
          res.status(200).json({ response: 'OK', message: 'Cleared PIN entry'})
        } catch (e) {
          res.status(200).json({ response: 'OK', message: 'No PIN entry found'})
        }
      }
    }
  } catch (e) {
    res.status(200).json({ response: 'OK', message: 'No PIN database exists'})
  }
}

async function pinSet (req, res, next) {
  const pindb = new PouchDB('pins')
  const test = await verifyPIN(req.body.pin, req.body.patient)
  if (test) {
    const pin1 = {
      _id: req.body.patient,
      pin: req.body.pin
    }
    await pindb.put(pin1)
    res.status(200).json({ response: 'OK' })
  } else {
    res.status(200).json({ response: 'Incorrect PIN' })
  }
}

async function test (req, res, next) {
  res.status(200).json({status: 'test'})
}

