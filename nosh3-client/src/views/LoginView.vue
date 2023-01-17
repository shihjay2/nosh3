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
            <div class="text-h6 text-center">Login</div>
          </q-card-section>
          <q-separator />
          <Form @submit="onSubmit">
            <q-card-section>
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
            <q-card-section>
              <div v-if="state.config.auth === 'mojoauth'" class="footer-preview">Secured by<a href="https://mojoauth.com/" target="_blank">
                <svg viewBox="0 0 211 198" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M209.768 160.513C209.415 159.459 208.927 158.454 208.316 157.524C208.316 157.524 208.316 157.398 208.189 157.335C205.011 152.513 198.505 148.135 189.558 144.408C189.174 144.209 188.772 144.047 188.358 143.924C187.621 143.629 186.905 143.313 186.126 143.019C183.474 142.177 180.653 141.335 177.579 140.492C172.716 139.229 167.474 138.092 161.895 137.061L161.768 136.282V135.924C161.053 131.713 159.179 124.913 155.874 113.482C150.884 95.924 144.021 71.7977 137.895 43.0398C136.442 36.3661 137.284 30.9556 140.463 26.3871C147.747 15.5029 166.337 12.5977 173.179 11.3556C173.974 11.1526 174.783 11.0118 175.6 10.9345C179.453 10.0924 179.916 7.50294 179.916 6.36609C179.907 5.24625 179.496 4.16693 178.758 3.32461C178.02 2.48229 177.004 1.93296 175.895 1.77662H175.474H175.284C155.684 -0.0339065 137.032 -1.63391 121.347 3.22925C103.347 8.63978 91.0316 21.6293 82.7789 44.1766L48.6105 136.282V136.408L48.021 137.25C42.9052 138.198 38.021 139.356 33.4526 140.492C29.3684 141.566 25.7052 142.724 22.3368 143.924C21.9223 144.047 21.5205 144.209 21.1368 144.408C19.9789 144.829 18.9052 145.313 17.8737 145.735C17.7681 145.744 17.6668 145.781 17.5789 145.84C13.076 147.768 8.91098 150.405 5.24208 153.65V153.65C4.22234 154.739 3.31919 155.932 2.54734 157.208C2.54734 157.208 2.42103 157.335 2.42103 157.398C1.32586 159.3 0.745379 161.455 0.736816 163.65C0.736816 171.587 8.31577 178.387 23.3473 183.798V184.892C35.6992 189.416 48.5142 192.558 61.5579 194.261C64.0842 194.619 66.6105 194.998 69.1789 195.229C71.7473 195.461 74.2316 195.84 76.821 196.071H77.1368C86.021 196.85 95.4737 197.271 105.158 197.271C115.874 197.271 126.21 196.787 135.895 195.84H136.189C138.779 195.587 141.368 195.356 143.832 195.061L151.474 193.903C164.451 192.131 177.172 188.824 189.368 184.05L189.663 183.924V182.956C203.326 177.735 210.189 171.229 210.189 163.65C210.194 162.59 210.053 161.535 209.768 160.513V160.513ZM94.1473 82.0714C94.6788 80.4969 95.5395 79.0537 96.672 77.8377C97.8046 76.6216 99.183 75.6607 100.716 75.0187C103.093 73.9424 105.768 73.7121 108.295 74.3661C110.572 74.8998 112.645 76.0851 114.259 77.7772C115.874 79.4694 116.961 81.5952 117.387 83.8949C117.814 86.1947 117.561 88.5688 116.661 90.7274C115.76 92.886 114.25 94.7356 112.316 96.0503C111.999 96.2247 111.759 96.5128 111.646 96.8565C111.533 97.2003 111.554 97.5742 111.705 97.9029C112.505 100.85 113.158 103.798 113.811 106.745C114.421 109.208 115.074 111.671 115.684 114.156C116.168 116.261 116.695 118.24 117.116 120.282C117.432 121.545 117.116 121.777 115.916 121.777H95.0526C93.7894 121.777 93.5579 121.545 93.8526 120.345C94.3368 118.113 94.9263 115.882 95.4737 113.735C96.021 111.587 96.5473 109.145 97.1579 106.871C97.7684 104.598 98.2947 102.303 98.9052 100.008C99.0737 99.1029 99.3895 98.1977 99.4947 97.2503C99.4892 97.05 99.4391 96.8535 99.348 96.6751C99.257 96.4966 99.1273 96.3407 98.9684 96.2187C96.6925 94.7768 94.9883 92.5889 94.1473 90.0293C93.2683 87.4494 93.2683 84.6512 94.1473 82.0714V82.0714Z" fill="#202124"></path></svg>MojoAuth
              </a></div>
              <div v-if="state.config.auth === 'magic'" class="footer-preview1">Secured by<a href="https://magic.link" target="_blank">
                <svg width="62.25" height="23.25" viewBox="0 0 83 31" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient class="_x" id="logo-gradient" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%"></stop><stop offset="100%"></stop></radialGradient></defs><path d="M45.1797 20.8929H47.7932V8.70022H44.1379L41.1771 16.3047L38.2163 8.70022H34.5792V20.8929H37.1745V12.1186L40.6105 20.8929H41.7437L45.1797 12.1186V20.8929Z"></path><path d="M55.4597 20.8929H57.7808V15.1896C57.7808 12.6487 55.9349 11.8444 53.9245 11.8444C52.5354 11.8444 51.1464 12.2831 50.0681 13.2336L50.9454 14.7874C51.6947 14.0928 52.572 13.7455 53.5224 13.7455C54.6921 13.7455 55.4597 14.3304 55.4597 15.2262V16.4509C54.8748 15.738 53.8331 15.3724 52.6634 15.3724C51.2561 15.3724 49.5929 16.1219 49.5929 18.1875C49.5929 20.1617 51.2561 21.1123 52.6634 21.1123C53.8148 21.1123 54.8566 20.6918 55.4597 19.9789V20.8929ZM55.4597 18.7725C55.0759 19.2843 54.3448 19.5402 53.5955 19.5402C52.6816 19.5402 51.9323 19.0649 51.9323 18.2423C51.9323 17.4015 52.6816 16.9079 53.5955 16.9079C54.3448 16.9079 55.0759 17.1638 55.4597 17.6757V18.7725Z"></path><path d="M59.9003 23.1596C60.9969 24.1285 62.1849 24.4758 63.7019 24.4758C65.8768 24.4758 68.4721 23.6532 68.4721 20.2897V12.0637H66.1327V13.1971C65.4199 12.3014 64.4695 11.8444 63.4094 11.8444C61.1797 11.8444 59.5165 13.453 59.5165 16.3412C59.5165 19.2843 61.198 20.8381 63.4094 20.8381C64.4878 20.8381 65.4382 20.3262 66.1327 19.4488V20.3445C66.1327 22.0811 64.8167 22.5747 63.7019 22.5747C62.587 22.5747 61.6549 22.2639 60.9421 21.4779L59.9003 23.1596ZM66.1327 17.7671C65.7489 18.3337 64.9081 18.7725 64.1405 18.7725C62.8246 18.7725 61.9108 17.8585 61.9108 16.3412C61.9108 14.824 62.8246 13.91 64.1405 13.91C64.9081 13.91 65.7489 14.3304 66.1327 14.9154V17.7671Z"></path><path d="M71.9256 10.7659C72.6933 10.7659 73.3147 10.1443 73.3147 9.37658C73.3147 8.60882 72.6933 7.9873 71.9256 7.9873C71.1763 7.9873 70.5366 8.60882 70.5366 9.37658C70.5366 10.1443 71.1763 10.7659 71.9256 10.7659ZM70.7742 20.8929H73.0953V12.0637H70.7742V20.8929Z"></path><path d="M74.8303 16.4692C74.8303 19.1929 76.7859 21.1123 79.5092 21.1123C81.3185 21.1123 82.4151 20.3262 83 19.5037L81.483 18.0961C81.0627 18.6811 80.423 19.0467 79.6188 19.0467C78.2115 19.0467 77.2246 18.0047 77.2246 16.4692C77.2246 14.9337 78.2115 13.91 79.6188 13.91C80.423 13.91 81.0627 14.2573 81.483 14.8606L83 13.453C82.4151 12.6304 81.3185 11.8444 79.5092 11.8444C76.7859 11.8444 74.8303 13.7638 74.8303 16.4692Z"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7002 -5.55184e-07C14.0256 1.62362 15.4875 3.13142 17.0683 4.50592C16.0151 7.92275 15.4481 11.5529 15.4481 15.3154C15.4481 19.078 16.0151 22.7082 17.0684 26.125C15.4876 27.4995 14.0257 29.0073 12.7003 30.6309C11.375 29.0075 9.91333 27.4998 8.33271 26.1255C9.38605 22.7085 9.95313 19.0782 9.95313 15.3154C9.95313 11.5527 9.38605 7.92237 8.3327 4.50537C9.9133 3.13103 11.375 1.6234 12.7002 -5.55184e-07ZM5.3107 23.7627C3.63771 22.5899 1.86221 21.5534 0.000311902 20.6694C0.516837 18.976 0.794702 17.1784 0.794702 15.316C0.794702 13.4532 0.516736 11.6553 3.00821e-05 9.9616C1.86203 9.07753 3.63762 8.04101 5.3107 6.86817C5.95048 9.57999 6.28902 12.4082 6.28902 15.3154C6.28902 18.2227 5.95049 21.0509 5.3107 23.7627ZM19.1114 15.3154C19.1114 18.2227 19.4499 21.051 20.0897 23.7628C21.763 22.5898 23.5388 21.5531 25.4011 20.669C24.8847 18.9757 24.6069 17.1783 24.6069 15.3159C24.6069 13.4534 24.8848 11.6557 25.4014 9.96213C23.539 9.07794 21.7631 8.04124 20.0897 6.86817C19.4499 9.57999 19.1114 12.4082 19.1114 15.3154Z"></path></svg>
              </a></div>
            </q-card-section>
            <q-card-section v-if="state.sending">
              <div v-if="state.config.auth === 'mojoauth'" class="text-body1"><q-circular-progress indeterminate size="1em" color="light-blue" class="q-ma-md" />Sending to MojoAuth...</div>
              <div v-if="state.config.auth === 'magic'" class="text-body1"><q-circular-progress indeterminate size="1em" color="light-blue" class="q-ma-md" />Sending to Magic...</div>
              <div class="text-subtitle2 text-red">{{ state.timeout }} seconds remaining</div>
              <div class="text-subtitle2">Check your email for your Magic Link for entry into NOSH ChartingSystem and come back here once verified</div>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn v-if="!state.sending" push icon="login" color="primary" label="Sign in without password" type="submit" />
              <q-btn v-if="state.sending" push icon="replay" color="primary" label="Request another Magic Link" @click="resubmit" />
            </q-card-actions>
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
  setup (props) {
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
          "label": "Email",
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
      // db
      auth: {},
      couchdb: '',
      pin: '',
      showPIN: false,
      loading: true
    })
    var auth_status = null
    var magic = null
    onMounted(async() => {
      if (auth.user !== null) {
        auth.logout()
      }
      var config = await axios.get(window.location.origin + '/auth/config')
      state.config = config.data
      if (state.config.auth === 'magic') {
        magic = new Magic(state.config.key)
      }
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
      nextTick(() => {
        var a = myInput.value.find(b => b._.props.readonly !== true)
        a._.props.focus = true
      })
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
        var jwt_result = await axios.post(window.location.origin + '/auth/authenticate', body)
        var jwt = jwt_result.data
      } catch (e) {
        $q.notify({
          message: 'Unauthorized access!',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
        resubmit()
      }
      state.progress = 'Token received and being processed...'
      const keys = await axios.get(window.location.origin + '/auth/jwks')
      const jwk = await jose.importJWK(keys.data.keys[0])
      try {
        const { payload, protectedHeader } = await jose.jwtVerify(jwt_result.data, jwk)
        objectPath.set(state, 'payload', payload)
        objectPath.set(state, 'protectedHeader', protectedHeader)
        state.progress += '<br/>Token successfully read...'
      } catch (e) {
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
      state.patient = state.payload._noshRedirect.replace('/app/chart/', '')
      state.progress += '<br/>Setting user...'
      var prefix = ''
      if (state.payload._nosh.instance === 'digitalocean' && state.payload._noshType === 'pnosh') {
        prefix = state.patient + '_'
      }
      var users = new PouchDB(state.couchdb +  prefix + 'users', state.auth)
      var selector = {'email': {$eq: state.payload._nosh.email}, _id: {"$gte": null}}
        // {'did': {$eq: state.payload._nosh.did}, _id: {"$gte": null}}
      var result = await users.find({
        // selector: {$or: selector}
        selector: selector
      })
      if (result.docs.length > 0) {
        auth.login(result.docs[0], state.payload, jwt)
        await eventAdd('Logged in', true, state.patient)
        state.progress += '<br/>Syncing data...'
        await syncAll(true, state.patient)
        state.progress += '<br/>Complete!'
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
    const gnapSubmit = async() => {
      var url = auth.returnUrl
      const body = {route: url}
      state.sending = true
      const a = await axios.post(window.location.origin + '/auth/gnapAuth', body)
      state.sending = false
      if (objectPath.has(a, 'data.interact.redirect')) {
        window.location.href = a.data.interact.redirect
      }
      window.location.href = a.data.interact.redirect
    }
    const onSubmit = async(values) => {
      const { email } = values
      var url = auth.returnUrl
      state.timeout = 30
      if (state.config.auth === 'magic') {
        state.sending = true
        var data = {}
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
    const resubmit = () => {
      state.login = true
      state.verifying = false
      state.sending = false
      if (state.config.auth === 'mojoauth') {
        if (auth_status !== null) {
          clearInterval(auth_status)
        }
        auth_status = null
        state.timeout = 30
      }
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