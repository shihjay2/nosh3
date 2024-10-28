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
  emits: ['sync-on'],
  setup(props, { emit }) {
    const { getPrefix } = common()
    const state = reactive({
      sync_on: false,
      sync_tooltip: ''
    })
    let sync = null
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
      const remote = new PouchDB(couchdb + prefix + resource, auth)
      if (resource !== 'users' && resource !== 'presentations' && resource !== 'binaries') {
        await local.setPassword(pin, {name: couchdb + prefix + resource, opts: auth})
      }
      sync = local.sync(remote, {
        live: true, 
        retry: true 
      }).on('change', (info) => { 
        state.sync_on = true
        emit('sync-on')
        state.sync_tooltip = 'Syncing ' + Case.title(props.resource) + '...'
      }).on('paused', (err) => {
        state.sync_on = false
        emit('sync-on')
      }).on('active', () => {
        state.sync_on = true
        emit('sync-on')
        state.sync_tooltip = 'Syncing ' + Case.title(props.resource) + '...'
      }).on('denied', (err) => {
        console.log(err)  
      }).on('complete', (info) => {
        state.sync_on = false
        emit('sync-on')
        console.log('PouchDB encrypted sync complete for DB: ' + props.resource )
      }).on('error', (err) => {
        console.log(err)
      })
    })
    watch(() => props.stop, async(newVal) => {
      if (newVal) {
        sync.cancel()
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
