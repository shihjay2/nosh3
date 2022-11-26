import dotenv from 'dotenv'
dotenv.config()
import axios from 'axios'
import crypto from 'crypto'
import express from 'express'
import fs from 'fs'
import * as jose from 'jose'

// const Mailgun = require('mailgun.js')
import moment from 'moment'

import objectPath from 'object-path'
import PouchDB from 'pouchdb'
import settings from './settings.mjs'
import { v4 as uuidv4 } from 'uuid'
import { createKeyPair, getKeys, getNPI, equals, urlFix, verify } from './core.mjs'
// const mailgun = new Mailgun(formData)
// const mg = mailgun.client({username: 'api', key: process.env.MAILGUN_API_KEY})
const router = express.Router()
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
export default router

// const jwksService = jose.createRemoteJWKSet(new URL(settings.jwks_uri))

router.post('/verifyJWT', verifyJWTEndpoint)
router.get('/jwks', jwks) // endpoint to share public key
router.get('/config', config)
router.post('/save', save)
router.post('/authenticate', authenticate)
router.get('/exportJWT', exportJWT)
router.get('/addUser', addUser)

router.post('/gnapAuth', gnapAuth)
router.get('/gnapVerify', gnapVerify)

router.post('/mail', mail)
router.get('/test', test)

function config(req, res) {
  if (req.get('referer') === req.protocol + '://' + req.hostname + '/app/login') {
    var response = {
      auth: process.env.AUTH
    }
    if (process.env.AUTH === 'mojoauth') {
      objectPath.set(response, 'key', process.env.MOJOAUTH_API_KEY)
    }
    if (process.env.AUTH === 'magic') {
      objectPath.set(response, 'key', process.env.MAGIC_API_KEY)
    }
    if (process.env.AUTH === 'trustee') {
      objectPath.set(response, 'key', process.env.GNAP_API_KEY)
      objectPath.set(response, 'url', process.env.TRUSTEE_URL)
    }
    res.status(200).json(response)
  } else {
    res.status(401).send('Unauthorized')
  }
}

async function save(req, res) {
  if (req.get('referer') === req.protocol + '://' + req.hostname + '/app/login') {
    const db = new PouchDB((settings.couchdb_uri + '/magic'), settings.couchdb_auth)
    var doc = req.body
    objectPath.set(doc, '_id', 'nosh_' + uuidv4())
    await db.put(doc)
    res.status(200).json(doc)
  } else {
    res.status(401).send('Unauthorized')
  }
}

async function authenticate(req, res) {
  if (req.get('referer') === req.protocol + '://' + req.hostname + '/app/login') {
    if (req.body.auth === 'mojoauth') {
      var email = req.body.user.email
    }
    if (req.body.auth === 'magic') {
      var email = req.body.email
    }
    const db_users = new PouchDB((settings.couchdb_uri + '/users'), settings.couchdb_auth)
    const result_users = await db_users.find({
      selector: {'email': {$eq: email}}
    })
    if (result_users.docs.length > 0) {
      var payload = {
        "_auth": req.body,
        "_nosh": {
          "email": email,
          "did": '',
          "pin": process.env.COUCHDB_ENCRYPT_PIN,
          "trustee": ''
        },
        "_noshAuth": process.env.AUTH,
        "_noshAPI": {
          "uspstf_key": process.env.USPSTF_KEY,
          "umls_key": process.env.UMLS_KEY,
          "mailgun_key": process.env.MAILGUN_API_KEY,
          "mailgun_domain": process.env.MAILGUN_DOMAIN,
          "oidc_relay_url": process.env.OIDC_RELAY_URL
        }
      }
      if (process.env.INSTANCE == 'docker') {
        objectPath.set(payload, '_noshDB', urlFix(req.protocol + '://' + req.hostname + '/couchdb'))
      } else {
        objectPath.set(payload, '_noshDB', urlFix(process.env.COUCHDB_URL))
      }
      if (process.env.AUTH == 'trustee') {
        objectPath.set(payload, '_nosh.trustee', urlFix(process.env.TRUSTEE_URL) )
      }
      if (process.env.NOSH_ROLE == 'patient') {
        // const db_patients = new PouchDB(settings.couchdb_uri + '/patients', settings.couchdb_auth)
        // const result_patients = await db_patients.find({selector: {'isEncrypted': {$eq: true}}})
        const db_patients = new PouchDB('patients')
        await db_patients.setPassword(process.env.COUCHDB_ENCRYPT_PIN, {name: settings.couchdb_uri + '/patients', opts: settings.couchdb_auth})
        await db_patients.loadEncrypted()
        const result_patients = await db_patients.find({selector: {_id: {$regex: '^nosh_*'}}})
        if (result_patients.docs.length > 0) {
          if (req.body.route === null) {
            objectPath.set(payload, '_noshRedirect', '/app/chart/' + result_patients.docs[0]._id)
          } else {
            objectPath.set(payload, '_noshRedirect', req.body.route)
          }
          objectPath.set(payload, '_noshType', 'pnosh')
          const jwt = await createJWT('mikey', urlFix(req.protocol + '://' + req.hostname + '/'), urlFix(req.protocol + '://' + req.hostname + '/'), payload)
          res.status(200).send(jwt)
        } else {
          // not installed yet
          res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'install')
        }
      } else {
        if (req.body.route === null) {
          objectPath.set(payload, '_noshRedirect', '/app/dashboard')
        } else {
          objectPath.set(payload, '_noshRedirect', req.body.route)
        }
        objectPath.set(payload, '_noshType', 'mdnosh')
        const jwt = await createJWT('mikey', urlFix(req.protocol + '://' + req.hostname + '/'), urlFix(req.protocol + '://' + req.hostname + '/'), payload)
        res.status(200).send(jwt)
      }
    } else {
      res.status(401).send('Unauthorized1')
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}

async function gnapAuth(req, res) {
  var keys = await getKeys()
  if (keys.length === 0) {
    var pair = await createKeyPair()
    keys.push(pair)
  }
  var body = {
    "access_token": {
      "access": ['app']
    },
    "client": {
      "key": {
        "proof": "httpsig",
        "jwk": keys[0].publicKey
      }
    },
    "interact": {
        "start": ["redirect"],
        "finish": {
          "method": "redirect",
          "uri": req.protocol + '://' + req.hostname + '/auth/gnapVerify',
          "nonce": crypto.randomBytes(16).toString('base64url')
        }
    }
  }
  try {
    var response = await axios.post(urlFix(process.env.TRUSTEE_URL) + 'tx', body)
  } catch (e) {
    res.status(401).json(e)
  }
  var doc = response.data
  var db = new PouchDB((settings.couchdb_uri + '/gnap'), settings.couchdb_auth)
  objectPath.set(doc, '_id', 'nosh_' + uuidv4())
  objectPath.set(doc, 'nonce', objectPath.get(body, 'interact.finish.nonce'))
  objectPath.set(doc, 'route', req.body.route)
  await db.put(doc)
  res.status(200).json(doc)
  // res.redirect(doc.interact.redirect)
}

async function gnapVerify(req, res) {
  var db = new PouchDB((settings.couchdb_uri + '/gnap'), settings.couchdb_auth)
  var result = await db.find({
    selector: {_id: {"$gte": null}, nonce: {"$eq": req.query.state_id}}
  })
  var index = null
  for (var a in result.docs) {
    // calculate hash and confirm match
    const hash = crypto.createHash('sha3-512')
    hash.update(result.docs[a].nonce + '\n')
    hash.update(result.docs[a].interact.finish + '\n')
    hash.update(req.query.interact_ref + '\n')
    hash.update(urlFix(process.env.TRUSTEE_URL) + 'tx')
    const hash_result = hash.digest('base64url')
    if (hash_result === req.query.hash) {
      index = a
    }
  }
  if (index !== null) {
    var body = {"interact_ref": req.query.interact_ref}
    try {
      var response = await axios.post(result.docs[index].continue.uri, body)
      db.remove(result.docs[index])
      // subject must be in the response
      if (objectPath.has(response.data, 'subject')) {
        var selector = []
        var nosh = {
          email: '',
          did: '',
          pin: process.env.COUCHDB_ENCRYPT_PIN,
          npi: '',
          templates: []
        }
        var user_id = ''
        var email_id = response.data.subject.sub_ids.find(b => b.format === 'email')
        if (email_id !== undefined) {
          selector.push({'email': {$eq: email_id.email}, _id: {"$gte": null}})
          objectPath.set(nosh, 'email', email_id.email)
        }
        var did_id = response.data.subject.sub_ids.find(b => b.format === 'did')
        if (did_id !== undefined) {
          selector.push({'did': {$eq: did_id.url}, _id: {"$gte": null}})
          objectPath.set(nosh, 'did', did_id.url)
        }
        var db_users = new PouchDB((settings.couchdb_uri + '/users'), settings.couchdb_auth)
        var result_users = await db_users.find({
          selector: {$or: selector}
        })
        // assume access token is JWT that contains verifiable credentials and if valid, attach to payload
        const jwt = response.data.access_token.value
        const verify_results = verify(jwt)
        if (verify_results.status === 'isValid') {
          if (objectPath.has(verify_results, 'payload.vc')) {
            objectPath.set(nosh, 'npi', getNPI(objectPath.get(verify_results, 'payload.vc')))
          }
          if (objectPath.has(verify_results, 'payload.vp') && npi !== '') {
            for (var b in objectPath.get(verify_results, 'payload.vp.verifiableCredential')) {
              if (npi !== '') {
                objectPath.set(nosh, 'npi', getNPI(objectPath.get(verify_results, 'payload.vp.verifiableCredential.' + b )))
              }
            }
          }
          var payload = {
            "_gnap": response.data,
            "jwt": jwt
          }
          if (result_users.docs.length > 0) {
            user_id = result_users.docs[0].id
            if (objectPath.has(verify_results, 'payload._nosh')) {
              // there is an updated user object from wallet, so sync to this instance
              if (!equals(objectPath.get(verify_results, 'payload._nosh'), result_users.docs[0])) {
                await db_users.put(bjectPath.get(verify_results, 'payload._nosh'))
              }
            } else {
              // update user as this is a new instance
              var doc = result_users.docs[0]
              objectPath.set(nosh, '_id', doc._id)
              objectPath.set(nosh, 'id', doc.id)
              objectPath.set(nosh, '_rev', doc._rev)
              await db_users.put(nosh)
              objectPath.set(payload, '_nosh', nosh)
            }
          } else {
            // add new user - authorization server has already granted
            var id = 'nosh_' + uuidv4()
            objectPath.set(nosh, '_id', id)
            objectPath.set(nosh, 'id', id)
            objectPath.set(nosh, 'templates', JSON.parse(fs.readFileSync('./assets/templates.json')))
            await db_users.put(nosh)
            objectPath.set(payload, '_nosh', nosh)
            objectPath.set(payload, '_noshAuth', process.env.AUTH)
          }
          if (process.env.INSTANCE == 'docker') {
            objectPath.set(payload, '_noshDB', urlFix(req.protocol + '://' + req.hostname + '/couchdb'))
          } else {
            objectPath.set(payload, '_noshDB', urlFix(process.env.COUCHDB_URL))
          }
          const api = {
            "uspstf_key": process.env.USPSTF_KEY,
            "umls_key": process.env.UMLS_KEY,
            "mailgun_key": process.env.MAILGUN_API_KEY,
            "mailgun_domain": process.env.MAILGUN_DOMAIN
          }
          objectPath.set(payload, 'noshAPI', api)
          if (process.env.NOSH_ROLE == 'patient') {
            const db_patients = new PouchDB((settings.couchdb_uri + '/patients'), settings.couchdb_auth)
            const result_patients = await db_patients.find({selector: {'isEncrypted': {$eq: true}}})
            if (result_patients.docs.length === 1) {
              if (result.docs[0].route === null) {
                objectPath.set(payload, '_noshRedirect','/app/chart/' + result_patients.docs[0]._id)
              } else {
                objectPath.set(payload, '_noshRedirect', result.docs[0].route)
              }
              objectPath.set(payload, '_noshType', 'pnosh')
            } else {
              // not installed yet
              res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'install')
            }
          } else {
            if (result.docs[0].route === null) {
              objectPath.set(payload, '_noshRedirect', '/app/dashboard/')
            } else {
              objectPath.set(payload, '_noshRedirect', result.docs[0].route)
            }
            objectPath.set(payload, '_noshType', 'mdnosh')
          }
          const jwt = await createJWT(user_id, urlFix(req.protocol + '://' + req.hostname + '/'), urlFix(req.protocol + '://' + req.hostname + '/'), payload)
          res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'app/verifyUser?token=' + jwt)
        } else {
          res.status(401).send('Unauthorized')
        }
      }
    } catch (e) {
      res.status(401).json(e)
    }
  }
}

async function mail(req, res) {
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer('urn:example:issuer')
    .setAudience('urn:example:audience')
    .setExpirationTime('2m')
    .sign(rsaPrivateKey)
  // mg.messages.create(process.env.MAILGUN_DOMAIN, {
  //   from: fromEmail,
  //   to: toEmails,
  //   subject: 'Hello',
  //   html: '<img src="cid:mailgun.png" width="200px"><br><h3>Testing some Mailgun awesomness!</h3>',
  //   text: 'Testing some Mailgun awesomness!',
  //   inline: [mailgunLogo],
  //   attachment: [rackspaceLogo]
  // }).then((msg) => console.log(msg))
  //   .catch((err) => console.log(err))
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
    "vc": {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://www.w3.org/2018/credentials/examples/v1"
      ],
      "id": "http://example.edu/credentials/3732",
      "type": [
        "VerifiableCredential",
        "UniversityDegreeCredential"
      ],
      "issuer": "https://example.edu/issuers/565049",
      "issuanceDate": "2010-01-01T00:00:00Z",
      "credentialSubject": {
        "id": "did:example:ebfeb1f712ebc6f1c276e12ec21",
        "degree": {
          "type": "BachelorDegree",
          "name": "Bachelor of Science and Arts"
        }
      }
    },
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
  const jwt = await new jose.SignJWT(payload_final)
    .setProtectedHeader({ alg: 'RS256' })
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



async function addUser (req, res, next) {
  var name = 'elmo'
  var opts = {headers: { Authorization: `Bearer eyJhbGciOiJSUzI1NiJ9.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL2V4YW1wbGVzL3YxIl0sImlkIjoiaHR0cDovL2V4YW1wbGUuZWR1L2NyZWRlbnRpYWxzLzM3MzIiLCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiVW5pdmVyc2l0eURlZ3JlZUNyZWRlbnRpYWwiXSwiaXNzdWVyIjoiaHR0cHM6Ly9leGFtcGxlLmVkdS9pc3N1ZXJzLzU2NTA0OSIsImlzc3VhbmNlRGF0ZSI6IjIwMTAtMDEtMDFUMDA6MDA6MDBaIiwiY3JlZGVudGlhbFN1YmplY3QiOnsiaWQiOiJkaWQ6ZXhhbXBsZTplYmZlYjFmNzEyZWJjNmYxYzI3NmUxMmVjMjEiLCJkZWdyZWUiOnsidHlwZSI6IkJhY2hlbG9yRGVncmVlIiwibmFtZSI6IkJhY2hlbG9yIG9mIFNjaWVuY2UgYW5kIEFydHMifX19LCJpYXQiOjE2NjA1Njc2MTIsImlzcyI6InVybjpleGFtcGxlOmlzc3VlciIsImF1ZCI6InVybjpleGFtcGxlOmF1ZGllbmNlIiwiZXhwIjoxNjYwNTc0ODEyLCJzdWIiOiJhZG1pbiJ9.GuAZkqMV3yctGivbp1FlMxPY3pI4SAfmVEnLT20iDvW3VsW-_ZoEm4RuU8s9Vh01tBekRs_wwtlGznE0v3XDs_Tg0tRgIcoy2m8lGU21_KOrWcwHPdZi8PmC3oM7gqpkZot-FFE6S6F78hlblhUiTOGrNuVSJaRKDKmcTTkAKsUTAA_8rywTgeYiIoiokNOHq7JE_YoPl_jddiEFxklHm2PWAI-qM21KX5gfH6gMGAWE_ksJuTzU2XQ32bya_jULVYyLyBmJdq6FBWjUupfHn72VBnWbQUu07a2T8t-9jDvl71CAmgfQGt9Ta3KwCIPoy1shT_C6A_3yoeh0k_VRew`}}
  var body = {
    "name": name,
    "password": "lalo37",
    "roles": ['write'],
    "type": "user"
    // "selector": {
    //     "_id": {"$gte": null}
    // },
    // // "fields": ["_id"],
    // "execution_stats": true
  }
  try {
    var result = await axios.put(settings.couchdb_uri + '/_users/org.couchdb.user:' + name, body, opts)
    console.log(result.status)
    res.status(200).json(result.data)
  } catch (e) {
    res.status(200).json(e)
  }
  // res.status(200).json(req.protocol + '://' + req.hostname + req.baseUrl + req.path)
}

async function test (req, res, next) {
  var result = await axios.get('https://open.epic.com/MyApps/EndpointsJson')
  res.status(200).json(result.data)
}

