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
        <q-card v-if="state.login">
          <q-card-section>
            <div class="text-body1"><q-circular-progress indeterminate size="1em" color="light-blue" class="q-ma-md" />Verifying User...</div>
          </q-card-section>
          <q-card-section>
            <div class="text-subtitle2"><div v-html="state.progress"></div></div>
            <div class="text-caption text-primary"><div v-html="state.progressNum"></div></div>
          </q-card-section>
        </q-card>
      </div>
    </q-page-container>
  </q-layout>
  <q-dialog v-model="state.loading">
    <q-spinner color="white" size="md" thickness="5"/>
    <q-tooltip :offset="[0, 8]">Loading...</q-tooltip>
  </q-dialog>
</template>
<script>
import { defineComponent, onMounted, reactive, watchEffect } from 'vue'
import { useQuasar } from 'quasar'
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
    const $q = useQuasar()
    const route = useRoute()
    const auth = useAuthStore()
    const { eventAdd, syncAll, syncState } = common()
    const state = reactive({
      progress: '',
      couchdb: '',
      payload: null,
      protectedHeader: null,
      patient: '',
      auth: {},
      progressNum: '',
      config: {},
      schemaPin: [
        {
          "id": "pin",
          "label": "4-digit PIN",
          "model": "pin",
          "type": "password",
          "mask": "####",
          "rules": "required"
        }
      ],
      showPIN: false,
      login: false,
      loading: true
    })
    onMounted(async() => {
      if (auth.user !== null) {
        auth.logout()
      }
      var config = await axios.get(window.location.origin + '/auth/config')
      state.config = config.data
      if (state.config.instance === 'digitalocean' && state.config.type === 'pnosh') {
        if (auth.returnUrl !== null) {
          state.patient = auth.returnUrl.replace('/app/chart/', '')
          var check = await axios.post(window.location.origin + '/auth/pinCheck', {patient: state.patient})
          if (check.data.response === 'Error') {
            state.loading = false
            state.showPIN = true
          }
          if (check.data.response === 'Forbidden') {
            state.login = false
            $q.notify({
              message: 'Invalid URL - forbidden',
              color: 'red',
              actions: [
                { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
              ]
            })
          }
          if (check.data.response === 'OK') {
            state.loading = false
            state.login = true
          }
        } else {
          state.loading = false
          $q.notify({
            message: 'Invalid URL - null',
            color: 'red',
            actions: [
              { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
            ]
          })
        }
      } else {
        state.loading = false
        state.login = true
      }
      if (state.login) {
        state.progress = 'Token being processed...'
        const keys = await axios.get(window.location.origin + '/auth/jwks')
        const jwk = await jose.importJWK(keys.data.keys[0])
        try {
          const { payload, protectedHeader } = await jose.jwtVerify(route.query.token, jwk)
          objectPath.set(state, 'payload', payload)
          objectPath.set(state, 'protectedHeader', protectedHeader)
          state.progress += '<br/>Token successfully read...'
        } catch (e) {
          console.log(e)
          $q.notify({
            message: 'Unauthorized access!',
            color: 'red',
            actions: [
              { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
            ]
          })
        }
        const jwt = route.query.token
        state.auth = {fetch: (url, opts) => {
          opts.headers.set('Authorization', 'Bearer ' + jwt)
          return PouchDB.fetch(url, opts)
        }}
        state.couchdb = state.payload._noshDB
        state.pin = state.payload._nosh.pin
        state.patient = state.payload._noshRedirect.replace('/app/chart/', '')
        state.progress += '<br/>Setting user...'
        var users = new PouchDB(state.couchdb +  prefix + 'users', state.auth)
        var selector = {'email': {$eq: state.payload._nosh.email}, _id: {"$gte": null}}
        // var selector = [
        //   {'email': {$eq: state.payload._nosh.email}, _id: {"$gte": null}},
        //   {'did': {$eq: state.payload._nosh.did}, _id: {"$gte": null}}
        // ]
        var result = await users.find({
          // selector: {$or: selector}
          selector: selector
        })
        if (result.docs.length > 0) {
          auth.login(result.docs[0], state.payload, jwt)
          await eventAdd('Logged in', true, state.patient)
          state.progress += '<br/>Syncing data...'
          await syncAll(true, state.patient, true)
          state.progress += '<br/>Complete!'
          router.push(auth.returnUrl || state.payload._noshRedirect)
        } else {
          // not authorized - user not set up
          $q.notify({
            message: 'Your email address is ' + result.docs[0].email + ', but you do not have an account',
            color: 'red',
            actions: [
              { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
            ]
          })
        }
      }
    })
    watchEffect(() => {
      if (syncState.total > 0) {
        state.progressNum = syncState.complete + ' out of ' + syncState.total + ' resources completed.'
      }
    })
    return {
      syncAll,
      syncState,
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