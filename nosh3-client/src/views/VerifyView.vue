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
        <q-card v-if="state.showPIN">
          <q-card-section>
            <div class="text-h6 text-center">Enter PIN</div>
          </q-card-section>
          <q-separator />
          <Form @submit="onSubmitPIN">
            <q-card-section>
              <div v-for="field1 in state.schemaPin" :key="field1.id" class="q-pa-sm">
                <QInputWithValidation
                  ref="myInput"
                  :name="field1.id"
                  :label="field1.label"
                  :type="field1.type"
                  :model="state.formPin[field1.id]"
                  @update-model="updateValue1"
                  :placeholder="field1.placeholder"
                  :rules="field1.rules"
                  focus="false"
                />
              </div>
            </q-card-section>
            <q-card-section>
              <q-list>
                <q-item>
                  <q-item-section avatar>
                    <q-avatar color="red" text-color="white" icon="safety_check" />
                  </q-item-section>
                  <q-item-section>
                    The database requires a 4-digit PIN (only known by the patient) for encryption/decryption.
                  </q-item-section>
                </q-item>
                <q-item>
                  <q-item-section>
                    If you are not the patient, please come back later until the login prompt appears.
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn push icon="pin" color="primary" label="Enter PIN" type="submit" />
            </q-card-actions>
          </Form>
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
import { router } from '@/helpers'
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
      loading: true,
      formPin: {},
    })
    onMounted(async() => {
      if (auth.user !== null) {
        auth.logout()
      }
      var config = await axios.get(window.location.origin + '/auth/config')
      state.config = config.data
      if (state.config.instance === 'digitalocean' && state.config.type === 'pnosh') {
        if (route.query.patient !== null) {
          state.patient = route.query.patient
          // state.patient = auth.returnUrl.replace('/app/chart/', '')
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
        var prefix = ''
        if (state.payload._nosh.instance === 'digitalocean' && state.payload._noshType === 'pnosh') {
          prefix = state.patient + '_'
        }
        var users = new PouchDB(state.couchdb + prefix + 'users', state.auth)
        var selector = {'email': {$eq: state.payload._nosh.email}, _id: {"$gte": null}}
        // var selector = [
        //   {'email': {$eq: state.payload._nosh.email}, _id: {"$gte": null}},
        //   {'did': {$eq: state.payload._nosh.did}, _id: {"$gte": null}}
        // ]
        var result = await users.find({
          // selector: {$or: selector}
          selector: selector
        })
        console.log(state.payload._nosh)
        console.log(result)
        if (result.docs.length > 0) {
          auth.login(result.docs[0], state.payload, jwt)
          await eventAdd('Logged in', true, state.patient)
          state.progress += '<br/>Syncing data...'
          await syncAll(true, state.patient, true)
          state.progress += '<br/>Complete!'
          router.push(state.payload._noshRedirect)
        } else {
          // not authorized - user not set up
          $q.notify({
            message: 'Your email address is ' + state.payload._nosh.email + ', but you do not have an account',
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
    const onSubmitPIN = async(values) => {
      const { pin } = values
      const result = await axios.post(window.location.origin + '/auth/pinSet', {pin: pin, patient: state.patient})
      if (result.data.response === 'OK') {
        state.showPIN = false
        state.login = true
      } else {
        $q.notify({
          message: result.data.response,
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const updateValue1 = (val, field, type) => {
      state.formPin[field] = val
    }
    return {
      syncAll,
      syncState,
      state,
      onSubmitPIN,
      updateValue1
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