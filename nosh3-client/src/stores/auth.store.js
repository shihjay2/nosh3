import { defineStore } from 'pinia'
import { router } from '@/helpers'

export const useAuthStore = defineStore(localStorage.getItem('auth_id') || 'auth', {
  state: () => ({
    user: {},
    jwt: null,
    type: null,
    auth: null,
    couchdb: null,
    api: {},
    pin: null,
    instance: null,
    trustee: null,
    gnap_jwt: null,
    rotate_jwt: null,
    rotate_jwt_uri: null,
    stay_logged_in: false,
    patient: null,
    prefix: null,
    sync_resource: [],
    last_sync: 0,
    last_oidc: null,
    returnUrl: null,
    message: null,
    init_sync: false,
    maia: null,
    maia_alt: null,
    timeline_build: false,
    timeline_update: [],
    patient_dob: null,
    patient_name: null,
    patient_gender: null,
    online: false
  }),
  persist: true,
  actions: {
    login(user, payload, jwt) {
      this.user = user
      this.jwt = jwt
      this.type = payload._noshType
      this.auth = payload._noshAuth
      this.couchdb = payload._noshDB
      this.api = payload._noshAPI
      this.pin = payload._nosh.pin
      this.instance = payload._nosh.instance
      this.trustee = payload._nosh.trustee_url
      this.gnap_jwt = payload.jwt
      this.rotate_jwt_uri = payload._gnap.access_token.manage.uri
      this.rotate_jwt = payload._gnap.access_token.manage.access_token.value
      this.patient = payload._nosh.patient
      this.prefix = payload._nosh.prefix
      this.maia = payload._nosh.maia
    },
    logout() {
      let route = '/app/login'
      if (this.instance === 'digitalocean' && this.type === 'pnosh') {
        route = '/app/chart/' + this.patient
      }
      this.user = null
      this.jwt = null
      this.type = null
      this.auth = null
      this.couchdb = null
      this.api = null
      this.pin = null
      this.instance = null
      this.last_oidc = null
      this.trustee = null
      this.gnap_jwt = null
      this.rotate_jwt = null
      this.rotate_jwt_uri = null
      this.prefix = null
      this.maia = null
      this.timeline_build = false
      if (route !== '/app/login') {
        location.reload()
      } else {
        router.push(route)
      }
    },
    update(user) {
      this.user = user
    },
    updateJWT(payload, jwt) {
      this.jwt = jwt
      this.type = payload._noshType
      this.auth = payload._noshAuth
      this.couchdb = payload._noshDB
      this.api = payload._noshAPI
      this.pin = payload._nosh.pin
      this.instance = payload._nosh.instance
      this.trustee = payload._nosh.trustee_url
      this.gnap_jwt = payload.jwt
      this.rotate_jwt_uri = payload._gnap.access_token.manage.uri
      this.rotate_jwt = payload._gnap.access_token.manage.access_token.value
      this.patient = payload._nosh.patient
      this.prefix = payload._nosh.prefix
      this.maia = payload._nosh.maia
    },
    setMessage(message) {
      this.message = message
    },
    setLastOIDC(oidc) {
      this.last_oidc = oidc
    },
    clearLastOIDC() {
      this.last_oidc = null
    },
    setLastSync(timestamp) {
      this.last_sync = timestamp
    },
    setPatient(patient) {
      this.patient = patient
    },
    setPatientInfo(info) {
      this.patient_dob = info.patient_dob
      this.patient_gender = info.patient_gender
      this.patient_name = info.patient_name
    },
    setSync() {
      this.init_sync = true
    },
    unsetSync() {
      this.init_sync = false
    },
    setSyncResource(resource) {
      if (Array.isArray(resource)) {
        this.sync_resource = resource
      } else {
        if (!this.sync_resource.includes(resource)) {
          this.sync_resource.push(resource)
        }
      }
    },
    setMAIA(url) {
      this.maia_alt = url
    },
    clearMAIA() {
      this.maia_alt = null
    },
    setStayLoggedIn(val) {
      this.stay_logged_in = val
    },
    setTimelineBuild() {
      this.timeline_build = true
    },
    setTimelineUpdate(item) {
      this.timeline_update.push(item)
    },
    clearTimelineUpdate() {
      this.timeline_update = []
    },
    unsetTimelineBuild() {
      this.timeline_build = false
    },
    setOnline(online) {
      this.online = online
    }
  }
})