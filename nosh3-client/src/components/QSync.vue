<template>
  <q-tooltip v-if="state.sync_on">{{ state.sync_tooltip }}</q-tooltip>
</template>

<script>
import { defineComponent, reactive, onMounted, watch } from 'vue'
import Case from 'case'
import { common } from '@/logic/common'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import comdb from 'comdb'
PouchDB.plugin(PouchDBFind)
PouchDB.plugin(comdb)
import { useAuthStore } from '@/stores'

export default defineComponent({
  name: 'QSync',
  props: {
    resource: String,
    stop: Boolean
  },
  emits: ['sync-on', 'sync-off'],
  setup(props, { emit }) {
    const { getPrefix } = common()
    const state = reactive({
      sync_on: false,
      sync_tooltip: ''
    })
    let sync_to = null
    let sync_from = null
    onMounted(async() => {
      const auth_store = useAuthStore()
      const couchdb = auth_store.couchdb
      const auth = {fetch: (url, opts) => {
        opts.headers.set('Authorization', 'Bearer ' + auth_store.jwt)
        return PouchDB.fetch(url, opts)
      }}
      const pin = auth_store.pin
      const prefix = getPrefix()
      const local = new PouchDB(prefix + props.resource)
      const remote = new PouchDB(couchdb + prefix + props.resource, auth)
      if (props.resource !== 'users' && props.resource !== 'presentations' && props.resource !== 'binaries') {
        await local.setPassword(pin, {name: couchdb + prefix + props.resource, opts: auth})
      }
      console.log('loading ' + props.resource)
      sync_to = local.replicate.to(remote, {
        live: true, 
        retry: true 
      }).on('change', (info) => { 
        console.log('sync change: ' + props.resource)
        state.sync_on = true
        emit('sync-on', Case.title(props.resource))
        state.sync_tooltip = 'Syncing ' + Case.title(props.resource) + '...'
      }).on('paused', (err) => {
        console.log('sync pause: ' + props.resource)
        state.sync_on = false
        emit('sync-off', Case.title(props.resource))
      }).on('active', () => {
        console.log('sync resume: ' + props.resource)
        state.sync_on = true
        emit('sync-on', Case.title(props.resource))
        state.sync_tooltip = 'Syncing ' + Case.title(props.resource) + '...'
      }).on('denied', (err) => {
        console.log(err)  
      }).on('complete', (info) => {
        console.log('sync complete: ' + props.resource)
        state.sync_on = false
        emit('sync-off', Case.title(props.resource))
        console.log('PouchDB encrypted sync complete for DB: ' + props.resource )
      }).on('error', (err) => {
        console.log(err)
      })
      sync_from = local.replicate.from(remote, {
        live: true, 
        retry: true 
      }).on('change', (info) => { 
        console.log('sync change: ' + props.resource)
        state.sync_on = true
        emit('sync-on', Case.title(props.resource))
        state.sync_tooltip = 'Syncing ' + Case.title(props.resource) + '...'
      }).on('paused', (err) => {
        console.log('sync pause: ' + props.resource)
        state.sync_on = false
        emit('sync-off', Case.title(props.resource))
      }).on('active', () => {
        console.log('sync resume: ' + props.resource)
        state.sync_on = true
        emit('sync-on', Case.title(props.resource))
        state.sync_tooltip = 'Syncing ' + Case.title(props.resource) + '...'
      }).on('denied', (err) => {
        console.log(err)  
      }).on('complete', (info) => {
        console.log('sync complete: ' + props.resource)
        state.sync_on = false
        emit('sync-off', Case.title(props.resource))
        console.log('PouchDB encrypted sync complete for DB: ' + props.resource )
      }).on('error', (err) => {
        console.log(err)
      })
    })
    watch(() => props.stop, async(newVal) => {
      if (newVal) {
        sync_to.cancel()
        synd_from.cancel()
      }
    })
    return {
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">

</style>
