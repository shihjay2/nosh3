<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title id="logo" class="absolute-center">
          Nosh
        </q-toolbar-title>
      </q-toolbar>
    </q-header>
    <q-page-container>
      <div class="q-pa-md row items-start q-gutter-md fixed-center">
        <q-card>
          <q-card-section>
            <div class="text-body1"><q-circular-progress v-if="state.sending" indeterminate size="1em" color="light-blue" class="q-ma-md" />Verifying User...</div>
          </q-card-section>
          <q-card-section>
            <div class="text-subtitle2"><div v-html="state.progress"></div></div>
          </q-card-section>
        </q-card>
      </div>
    </q-page-container>
  </q-layout>
</template>
<script>
import { defineComponent, onMounted, reactive } from 'vue'
import { common } from '@/logic/common'
import * as jose from 'jose'
import PouchDB from 'pouchdb-browser'
import { useAuthStore } from '@/stores'
import { useRoute } from 'vue-router'
import objectPath from 'object-path'
import PouchDBFind from 'pouchdb-find'
import axios from 'axios'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'VerifyView',
  setup (props) {
    const route = useRoute()
    const auth = useAuthStore()
    const { syncAll } = common()
    const state = reactive({
      progress: '',
      couchdb: '',
      payload: null,
      protectedHeader: null,
      auth: {},
      sending: false
    })
    onMounted(async() => {
      state.progress = 'Token being processed...'
      state.sending = true
      const keys = await axios.get(window.location.origin + '/auth/jwks')
      const jwk = await jose.importJWK(keys.data.keys[0])
      try {
        const { payload, protectedHeader } = await jose.jwtVerify(route.query.token, jwk)
        objectPath.set(state, 'payload', payload)
        objectPath.set(state, 'protectedHeader', protectedHeader)
        state.progress += '<br/>Token successfully read...'
      } catch (e) {
        state.progress = 'Error: ' + JSON.stringify(e)
      }
      const jwt = route.query.token
      state.auth = {fetch: (url, opts) => {
        opts.headers.set('Authorization', 'Bearer ' + jwt)
        return PouchDB.fetch(url, opts)
      }}
      state.couchdb = state.payload._noshDB
      state.progress += '<br/>Setting user...'
      var users = new PouchDB(state.couchdb + 'users', state.auth)
      var selector = [
        {'email': {$eq: state.payload._nosh.email}, _id: {"$gte": null}},
        {'did': {$eq: state.payload._nosh.did}, _id: {"$gte": null}}
      ]
      var result = await users.find({
        selector: {$or: selector}
      })
      if (result.docs.length > 0) {
        await syncAll(true, state.couchdb, state.auth)
        return auth.login(result.docs[0], state.payload._noshRedirect, jwt, state.payload._noshType, state.payload._noshAuth, state.payload._noshDB, state.payload._noshAPI)
      } else {
        // not authorized - user not set up
        state.progress = 'Your email address is ' + result.docs[0].email + ', but you do not have an account'
      }
    })
    return {
      syncAll,
      state
    }
  }
})
</script>
<style scoped lang="scss">
#logo{
  font-family: 'Pacifico', arial, serif;
  font-size: 30px;
  text-shadow: 4px 4px 4px #aaa;
  vertical-align: middle;
}
</style>