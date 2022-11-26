require('dotenv').config()
const express = require('express')
const axios = require('axios')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const Engine = require('fhir-kit-mapping-language')
const fs = require('fs')
const isReachable = require('is-reachable')
const morgan = require('morgan')
const objectPath = require('object-path')
const PouchDB = require('pouchdb')
const {v4: uuidv4} = require('uuid')
PouchDB.plugin(require('pouchdb-find'))
PouchDB.plugin(require('comdb'))

const fhir = require('./fhir')
const auth = require('./auth')
const client = __dirname + '/nosh3-client/dist/'
const { couchdbDatabase, couchdbInstall, urlFix, verifyJWT } = require('./core')
const settings = require('./settings')
const app = express()

app.enable('trust proxy')
app.use(morgan('tiny'))
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use('/fhir', fhir)
app.use('/auth', auth)
app.use('/app', express.static(client))

app.use('/app/chart', (req, res) => {
  res.sendFile(client + "index.html")
})
app.get('/app/dashboard', (req, res) => {
  res.sendFile(client + "index.html")
})
// app.use('/app/chart', verifyJWT, (req,res) => {
//   res.sendFile(client + "index.html")
// })
// app.get('/app/dashboard', verifyJWT, (req, res) => {
//   res.sendFile(client + "index.html")
// })
app.get('/app/login', (req, res) => {
  res.sendFile(client + "index.html")
})

app.get('/app/verify', (req, res) => {
  res.sendFile(client + "index.html")
})

app.get('/fetch/:file/:type?', (req, res) => {
  var type = 'json'
  if (req.params.type == 'txt') {
    var type = 'txt'
  }
  if (type === 'json') {
    var raw = fs.readFileSync('./assets/' + req.params.file + '.' + type)
    res.status(200).json(JSON.parse(raw))
  } else {
    var raw = fs.readFileSync('./assets/' + req.params.file + '.' + type, 'utf-8')
    res.status(200).send(raw)
  }
})

app.post('/fhirmap', (req, res) => {
  const engine = new Engine(fs.readFileSync('./assets/map_' + req.body.resource + '.txt', 'utf-8'))
  const targets = engine.execute('http://hl7.org/fhir/StructureMap/Immunization3to4', req.body.doc)
  console.log(targets)
  res.status(200).json(targets)
})

app.post('/oidc', async(req, res) => {
  if (objectPath.has(req, 'body.body')) {
    var result = await axios.post(req.body.url, req.body.body, {headers: {'Content-Type': 'application/json'}})
  } else {
    var result = await axios.get(req.body.url, {headers: {'Content-Type': 'application/json'}})
  }
  res.status(200).json(result.data)
})

app.get('/start', async(req, res) => {
  var opts = JSON.parse(JSON.stringify(settings.couchdb_auth))
  objectPath.set(opts, 'skip_setup', true)
  const check = new PouchDB((settings.couchdb_uri + '/users'), opts)
  try {
    await check.info()
    res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'app/login')
  } catch (e) {
    // installation needed
    await couchdbInstall()
    var b = false
    for (let a = 0; a < 20; a++) {
      if (!b) {
        b = await isReachable(settings.couchdb_uri)
      }
    }
    if (b) {
      await couchdbDatabase()
      const users = new PouchDB((settings.couchdb_uri + '/_users'), settings.couchdb_auth)
      await users.info()
      const db_users = new PouchDB((settings.couchdb_uri + '/users'), settings.couchdb_auth)
      var result = await db_users.find({selector: {_id: {$regex: "^nosh_*"}}})
      if (result.docs.length === 0) {
        const id = 'nosh_' + uuidv4()
        var user = {
          display: process.env.NOSH_DISPLAY,
          id: id,
          _id: id,
          email: process.env.NOSH_EMAIL,
          role: process.env.NOSH_ROLE,
          did: process.env.NOSH_DID
        }
        const id1 = 'nosh_' + uuidv4()
        if (user.role === 'patient') {
          var patient = {
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
          const db1 = new PouchDB('patients')
          await db1.setPassword(process.env.COUCHDB_ENCRYPT_PIN, {name: settings.couchdb_uri + '/patients', opts: settings.couchdb_auth})
          await db1.put(patient)
          objectPath.set(user, 'reference', 'Patient/' + id1)
        }
        if (user.role === 'provider') {
          var practitioner = {
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
          const db2 = new PouchDB('practitioners')
          await db2.setPassword(process.env.COUCHDB_ENCRYPT_PIN, {name: settings.couchdb_uri + '/practitioners', opts: settings.couchdb_auth})
          await db2.put(practitioner)
          objectPath.set(user, 'reference', 'Practitioner/' + id1)
          objectPath.set(user, 'templates', JSON.parse(fs.readFileSync('./assets/templates.json')))
        }
        await db_users.put(user)
        if (user.role === 'patient') {
          res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'app/chart/' + id1)
        }
        if (user.role === 'provider') {
          res.redirect(urlFix(req.protocol + '://' + req.hostname + '/') + 'app/dashboard')
        }
      } else {
        res.status(200).send('NOSH is already installed')
      }
    } else {
      res.status(200).send('CouchDB is not restarting for some reason; try again')
    }
  }
})

const port = process.env.PORT || 4000;
app.listen(port, () => {
    console.log(`listening on ${port}`)
})