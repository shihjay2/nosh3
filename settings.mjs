import dotenv from 'dotenv'
dotenv.config()

export default {
  jwks_uri: "", // URI to the JWKS endpoint exposed by the Authorization Server
  couchdb_uri: process.env.COUCHDB_URL, // URI to couchdb
  couchdb_auth: {auth: {username: process.env.COUCHDB_USER, password: process.env.COUCHDB_PASSWORD}},
  as_uri: ""
};