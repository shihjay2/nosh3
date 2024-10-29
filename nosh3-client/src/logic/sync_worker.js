import registerPromiseWorker from 'promise-worker/register'
import Case from 'case'
import { common } from '@/logic/common'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import comdb from 'comdb'
PouchDB.plugin(PouchDBFind)
PouchDB.plugin(comdb)
import { useAuthStore } from '@/stores'

registerPromiseWorker(async(message) => {
  const { resource, command, } = message
  const { getPrefix } = common()
  const auth_store = useAuthStore()
  const couchdb = auth_store.couchdb
  const auth = {fetch: (url, opts) => {
    opts.headers.set('Authorization', 'Bearer ' + auth_store.jwt)
    return PouchDB.fetch(url, opts)
  }}
  const pin = auth_store.pin
  const prefix = getPrefix()
  const local = new PouchDB(prefix + resource)
  const remote = new PouchDB(couchdb + prefix + resource, auth)
  if (resource !== 'users' && resource !== 'presentations' && resource !== 'binaries') {
    await local.setPassword(pin, {name: couchdb + prefix + resource, opts: auth})
  }
  let sync_to
  let sync_from
  console.log('loading ' + resource)
  if (command === 'start') {
    sync_to = local.replicate.to(remote, {
      live: true, 
      retry: true 
    }).on('change', (info) => { 
      console.log('sync change: ' + resource)
      state.sync_on = true
      emit('sync-on', Case.title(resource))
      state.sync_tooltip = 'Syncing ' + Case.title(resource) + '...'
    }).on('paused', (err) => {
      console.log('sync pause: ' + resource)
      state.sync_on = false
      emit('sync-off', Case.title(resource))
    }).on('active', () => {
      console.log('sync resume: ' + resource)
      state.sync_on = true
      emit('sync-on', Case.title(resource))
      state.sync_tooltip = 'Syncing ' + Case.title(resource) + '...'
    }).on('denied', (err) => {
      console.log(err)  
    }).on('complete', (info) => {
      console.log('sync complete: ' + resource)
      state.sync_on = false
      emit('sync-off', Case.title(resource))
      console.log('PouchDB encrypted sync complete for DB: ' + resource )
    }).on('error', (err) => {
      console.log(err)
    })
    sync_from = local.replicate.from(remote, {
      live: true, 
      retry: true 
    }).on('change', (info) => { 
      console.log('sync change: ' + resource)
      state.sync_on = true
      emit('sync-on', Case.title(resource))
      state.sync_tooltip = 'Syncing ' + Case.title(resource) + '...'
    }).on('paused', (err) => {
      console.log('sync pause: ' + resource)
      state.sync_on = false
      emit('sync-off', Case.title(resource))
    }).on('active', () => {
      console.log('sync resume: ' + resource)
      state.sync_on = true
      emit('sync-on', Case.title(resource))
      state.sync_tooltip = 'Syncing ' + Case.title(resource) + '...'
    }).on('denied', (err) => {
      console.log(err)  
    }).on('complete', (info) => {
      console.log('sync complete: ' + resource)
      state.sync_on = false
      emit('sync-off', Case.title(resource))
      console.log('PouchDB encrypted sync complete for DB: ' + resource )
    }).on('error', (err) => {
      console.log(err)
    })
    return 'Sync started for '  
  }

  if (message.type === 'message') {
    return `Worker reply: ${JSON.stringify(message)}`
  }
})