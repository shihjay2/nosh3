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
        <q-card v-if="state.login" class="q-pa-md">
          <q-card-section>
            <div class="text-h6 text-center">Sign In With</div>
          </q-card-section>
          <q-separator />
          <Form @submit="onSubmit">
            <q-card-section v-if="state.magic">
              <div v-for="field in state.schema" :key="field.id" class="q-pa-sm">
                <QInputWithValidation
                  ref="myInput"
                  :name="field.id"
                  :label="field.label"
                  :type="field.type"
                  :model="state.form[field.id]"
                  @update-model="updateValue"
                  :placeholder="field.placeholder"
                  :rules="field.rules"
                  focus="false"
                />
              </div>
            </q-card-section>
            <q-card-section v-if="state.sending">
              <div v-if="state.config.auth === 'magic'" class="text-body1"><q-circular-progress indeterminate size="1em" color="light-blue" class="q-ma-md" />Sending to Magic...</div>
              <div class="text-subtitle2 text-red">{{ state.timeout }} seconds remaining</div>
              <div class="text-subtitle2">Check your email for your Magic Link for entry into NOSH ChartingSystem and come back here once verified</div>
            </q-card-section>
            <q-card-section v-if="state.showUpdate">
              <div class="text-body1"><q-circular-progress indeterminate size="1em" color="light-blue" class="q-ma-md" />Updating NOSH...</div>
            </q-card-section>
            <q-card-actions vertical align="center">
              <div v-if="state.magic" class="q-pa-md">
                <q-btn v-if="!state.sending" class="full-width q-pa-md" push icon="login" color="primary" label="Magic" type="submit" />
                <q-btn v-if="state.sending" class="full-width q-pa-md" push icon="replay" color="primary" label="Request another Magic Link" @click="resubmit" />
              </div>
              <div v-if="state.gnap" class="q-pa-md">
                <q-btn class="full-width q-pa-md" push icon="vpn_key" color="primary" label="Trustee Authorization Server" @click="gnapSubmit" />
              </div>
              <div class="q-pa-md">
                <q-btn round push icon="replay" color="primary" @click="reload" />
              </div>
            </q-card-actions>
            <q-card-section v-if="state.magic">
              <div v-if="state.config.auth === 'magic'" class="footer-preview1">Secured by<a href="https://magic.link" target="_blank">
                <svg width="62.25" height="23.25" viewBox="0 0 83 31" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient class="_x" id="logo-gradient" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%"></stop><stop offset="100%"></stop></radialGradient></defs><path d="M45.1797 20.8929H47.7932V8.70022H44.1379L41.1771 16.3047L38.2163 8.70022H34.5792V20.8929H37.1745V12.1186L40.6105 20.8929H41.7437L45.1797 12.1186V20.8929Z"></path><path d="M55.4597 20.8929H57.7808V15.1896C57.7808 12.6487 55.9349 11.8444 53.9245 11.8444C52.5354 11.8444 51.1464 12.2831 50.0681 13.2336L50.9454 14.7874C51.6947 14.0928 52.572 13.7455 53.5224 13.7455C54.6921 13.7455 55.4597 14.3304 55.4597 15.2262V16.4509C54.8748 15.738 53.8331 15.3724 52.6634 15.3724C51.2561 15.3724 49.5929 16.1219 49.5929 18.1875C49.5929 20.1617 51.2561 21.1123 52.6634 21.1123C53.8148 21.1123 54.8566 20.6918 55.4597 19.9789V20.8929ZM55.4597 18.7725C55.0759 19.2843 54.3448 19.5402 53.5955 19.5402C52.6816 19.5402 51.9323 19.0649 51.9323 18.2423C51.9323 17.4015 52.6816 16.9079 53.5955 16.9079C54.3448 16.9079 55.0759 17.1638 55.4597 17.6757V18.7725Z"></path><path d="M59.9003 23.1596C60.9969 24.1285 62.1849 24.4758 63.7019 24.4758C65.8768 24.4758 68.4721 23.6532 68.4721 20.2897V12.0637H66.1327V13.1971C65.4199 12.3014 64.4695 11.8444 63.4094 11.8444C61.1797 11.8444 59.5165 13.453 59.5165 16.3412C59.5165 19.2843 61.198 20.8381 63.4094 20.8381C64.4878 20.8381 65.4382 20.3262 66.1327 19.4488V20.3445C66.1327 22.0811 64.8167 22.5747 63.7019 22.5747C62.587 22.5747 61.6549 22.2639 60.9421 21.4779L59.9003 23.1596ZM66.1327 17.7671C65.7489 18.3337 64.9081 18.7725 64.1405 18.7725C62.8246 18.7725 61.9108 17.8585 61.9108 16.3412C61.9108 14.824 62.8246 13.91 64.1405 13.91C64.9081 13.91 65.7489 14.3304 66.1327 14.9154V17.7671Z"></path><path d="M71.9256 10.7659C72.6933 10.7659 73.3147 10.1443 73.3147 9.37658C73.3147 8.60882 72.6933 7.9873 71.9256 7.9873C71.1763 7.9873 70.5366 8.60882 70.5366 9.37658C70.5366 10.1443 71.1763 10.7659 71.9256 10.7659ZM70.7742 20.8929H73.0953V12.0637H70.7742V20.8929Z"></path><path d="M74.8303 16.4692C74.8303 19.1929 76.7859 21.1123 79.5092 21.1123C81.3185 21.1123 82.4151 20.3262 83 19.5037L81.483 18.0961C81.0627 18.6811 80.423 19.0467 79.6188 19.0467C78.2115 19.0467 77.2246 18.0047 77.2246 16.4692C77.2246 14.9337 78.2115 13.91 79.6188 13.91C80.423 13.91 81.0627 14.2573 81.483 14.8606L83 13.453C82.4151 12.6304 81.3185 11.8444 79.5092 11.8444C76.7859 11.8444 74.8303 13.7638 74.8303 16.4692Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7002 -5.55184e-07C14.0256 1.62362 15.4875 3.13142 17.0683 4.50592C16.0151 7.92275 15.4481 11.5529 15.4481 15.3154C15.4481 19.078 16.0151 22.7082 17.0684 26.125C15.4876 27.4995 14.0257 29.0073 12.7003 30.6309C11.375 29.0075 9.91333 27.4998 8.33271 26.1255C9.38605 22.7085 9.95313 19.0782 9.95313 15.3154C9.95313 11.5527 9.38605 7.92237 8.3327 4.50537C9.9133 3.13103 11.375 1.6234 12.7002 -5.55184e-07ZM5.3107 23.7627C3.63771 22.5899 1.86221 21.5534 0.000311902 20.6694C0.516837 18.976 0.794702 17.1784 0.794702 15.316C0.794702 13.4532 0.516736 11.6553 3.00821e-05 9.9616C1.86203 9.07753 3.63762 8.04101 5.3107 6.86817C5.95048 9.57999 6.28902 12.4082 6.28902 15.3154C6.28902 18.2227 5.95049 21.0509 5.3107 23.7627ZM19.1114 15.3154C19.1114 18.2227 19.4499 21.051 20.0897 23.7628C21.763 22.5898 23.5388 21.5531 25.4011 20.669C24.8847 18.9757 24.6069 17.1783 24.6069 15.3159C24.6069 13.4534 24.8848 11.6557 25.4014 9.96213C23.539 9.07794 21.7631 8.04124 20.0897 6.86817C19.4499 9.57999 19.1114 12.4082 19.1114 15.3154Z"></path></svg>
              </a></div>
            </q-card-section>
          </Form>
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
        <q-card v-if="state.verifying">
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
import { defineComponent, onMounted, nextTick, reactive, ref, watchEffect } from 'vue'
import { useQuasar } from 'quasar'
import axios from 'axios'
import { common } from '@/logic/common'
import { Form } from 'vee-validate'
import * as jose from 'jose'
import { Magic } from 'magic-sdk'
import objectPath from 'object-path'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import QInputWithValidation from '@/components/QInputWithValidation.vue'
import { router } from '@/helpers'
import { useAuthStore } from '@/stores'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'LoginView',
  components: {
    Form,
    QInputWithValidation
  },
  setup () {
    const $q = useQuasar()
    const auth = useAuthStore()
    const myInput = ref(null)
    const { eventAdd, syncAll, syncState } = common()
    const state = reactive({
      login: false,
      complete: false,
      form: {},
      formPin: {},
      sending: false,
      verifying: false,
      count: {},
      progress: '',
      progressNum: '',
      config: {},
      timeout: 30,
      schema: [
        {
          "id": "email",
          "label": "Email for Magic Sign-In",
          "model": "email",
          "type": "email",
          "placeholder": "yourname@email.com",
          "rules": "required"
        }
      ],
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
      payload: null,
      protectedHeader: null,
      patient: '',
      url: '',
      // db
      auth: {},
      couchdb: '',
      pin: '',
      showPIN: false,
      showUpdate: false,
      loading: true,
      magic: true,
      gnap: true
    })
    var auth_status = null
    var magic = null
    onMounted(async() => {
      if (auth.user !== null) {
        auth.logout()
      }
      if (auth.message !== null) {
        console.log('Message: ' + auth.message)
      }
      const config = await axios.get(window.location.origin + '/auth/config')
      state.config = config.data
      if (state.config.auth === 'magic') {
        magic = new Magic(state.config.key)
      }
      state.url = auth.returnUrl
      if (state.config.instance === 'digitalocean' && state.config.type === 'pnosh') {
        state.magic = false
        if (auth.returnUrl !== null) {
          state.patient = auth.returnUrl.replace('/app/chart/', '')
          const check = await axios.post(window.location.origin + '/auth/pinCheck', {patient: state.patient})
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
            state.showUpdate = true
            const update = await axios.get(window.location.origin + '/auth/update')
            if (update.data.response == 'OK') {
              state.showUpdate = false
              state.login = true
            } else {
              $q.notify({
                message: 'Update failed - reload page again',
                color: 'red',
                actions: [
                  { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
                ]
              })
            }
          }
        } else {
          state.loading = false
          $q.notify({
            message: 'Invalid URL - no patient specified',
            color: 'red',
            actions: [
              { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
            ]
          })
        }
      } else {
        if (state.config.type !== 'pnosh') {
          state.gnap = false
        }
        state.loading = false
        state.login = true
      }
      if (state.login && state.magic) {
        nextTick(() => {
          const a = myInput.value.find(b => b._.props.readonly !== true)
          a._.props.focus = true
        })
      }
    })
    watchEffect(() => {
      if (syncState.total > 0) {
        state.progressNum = syncState.complete + ' out of ' + syncState.total + ' resources completed.'
      }
    })
    const authenticate = async(body) => {
      if (auth_status !== null) {
        clearInterval(auth_status)
        auth_status = null
        state.timeout = 0
      }
      state.sending = false
      state.login = false
      state.verifying = true
      try {
        const jwt_result = await axios.post(window.location.origin + '/auth/authenticate', body)
        const jwt = jwt_result.data
        state.progress = 'Token received and being processed...'
        if (state.progress !== '') {
          const keys = await axios.get(window.location.origin + '/auth/jwks')
          const jwk = await jose.importJWK(keys.data.keys[0])
          try {
            const { payload, protectedHeader } = await jose.jwtVerify(jwt_result.data, jwk)
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
            resubmit()
          }
          state.auth = {fetch: (url, opts) => {
            opts.headers.set('Authorization', 'Bearer ' + jwt)
            return PouchDB.fetch(url, opts)
          }}
          state.couchdb = state.payload._noshDB
          state.pin = state.payload._nosh.pin
          state.patient = state.payload._nosh.patient
          state.progress += '<br/>Setting user...'
          const prefix = state.payload._nosh.prefix
          const users = new PouchDB(state.couchdb + prefix + 'users', state.auth)
          const selector = {'email': {$eq: state.payload._nosh.email}, _id: {"$gte": null}}
            // {'did': {$eq: state.payload._nosh.did}, _id: {"$gte": null}}
          const result = await users.find({
            // selector: {$or: selector}
            selector: selector
          })
          if (result.docs.length > 0) {
            auth.login(result.docs[0], state.payload, jwt)
            await eventAdd('Logged in', state.patient)
            const localDB = new PouchDB(prefix + 'users')
            const localinfo = await localDB.info()
            if (localinfo.doc_count == 0 && localinfo.update_seq == 0) {
              state.progress += '<br/>Syncing data for the first time...'
              await syncAll(true, state.patient, true)
              state.progress += '<br/>Complete!'
            }
            // redirect to previous url or default to home page
            router.push(auth.returnUrl || state.payload._noshRedirect)
          } else {
          $q.notify({
              message: 'Unauthorized access!',
              color: 'red',
              actions: [
                { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
              ]
            })
            resubmit()
          }
        }
      } catch (e) {
        console.log(e)
        $q.notify({
          message: 'Unauthorized access!',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
        resubmit()
      }
    }
    const gnapSubmit = async() => {
      const url = auth.returnUrl
      state.sending = false
      state.loading = true
      const body = {route: url, patient: state.patient}
      const a = await axios.post(window.location.origin + '/auth/gnapAuth', body)
      if (objectPath.has(a, 'data.interact.redirect')) {
        window.location.href = a.data.interact.redirect
      } else {
        $q.notify({
          message: 'Error connecting to Trustee!  Please try again later!',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const onSubmit = async(values) => {
      const { email } = values
      const url = auth.returnUrl
      state.timeout = 30
      if (state.config.auth === 'magic') {
        state.sending = true
        let data = {}
        auth_status = setInterval(async() => {
          if (state.timeout < 0) {
            clearInterval(auth_status)
          } else {
            state.timeout -= 1
          }
        }, 1000)
        do {
          try {
            await magic.auth.loginWithMagicLink({email: email, showUI: false})
          } catch (e) {
            state.sending = false
            console.log(e)
            $q.notify({
              message: 'Error connecting to Magic!  Please try again later!',
              color: 'red',
              actions: [
                { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
              ]
            })
          }
          data = await magic.user.getMetadata()
          objectPath.set(data, 'auth', 'magic')
          objectPath.set(data, 'route', url)
          objectPath.set(data, 'patient', state.patient)
          authenticate(data)
        }
        while (state.timeout > 0 && auth_status !== null)
      }
    }
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
    const reload = () => {
      window.location.href = state.url
    }
    const resubmit = () => {
      state.login = true
      state.verifying = false
      state.sending = false
    }
    const updateValue = (val, field, type) => {
      state.form[field] = val
    }
    const updateValue1 = (val, field, type) => {
      state.formPin[field] = val
    }
    return {
      authenticate,
      gnapSubmit,
      onSubmit,
      onSubmitPIN,
      reload,
      resubmit,
      updateValue,
      updateValue1,
      myInput,
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
$coolGray-40: #a2a9b0;
$purple-70-hover: #5e00cf;
.footer-preview {
  display: flex;
  justify-content: center;
  color: $coolGray-40;
  font-size: 10px;
  svg {
    margin: 0 5px;
    vertical-align: middle;
    width: 14px;
    path {
      transition: 0.3s all ease-in-out;
      fill: $coolGray-40;
    }
  }
  a {
    text-decoration: none;
    color: $coolGray-40;
    transition: 0.3s all ease-in-out;
    display: flex;
    &:hover {
      color: $purple-70-hover;
      svg {
        path {
          fill: $purple-70-hover;
        }
      }
    }
  }
}
.footer-preview1 {
  display:flex;
  align-items: center;
  justify-content: center;
  color: #b6b4ba;
  margin-right: 10px;
  font-size: 12px;
  svg {
    margin: 0 5px;
    fill: #b6b4ba;
  }
  a {
    text-decoration: none;
    color: $coolGray-40;
    transition: 0.3s all ease-in-out;
    display: flex;
    &:hover {
      color: $purple-70-hover;
      svg {
        path {
          fill: $purple-70-hover;
        }
      }
    }
  }
}
</style>