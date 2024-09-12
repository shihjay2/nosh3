import { defineStore } from 'pinia'
import { router } from '@/helpers'

export const useAuthStore = defineStore({
  id: 'auth',
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
    patient: null,
    prefix: null,
    sync_resource: [],
    oidc: [],
    returnUrl: null,
    message: null,
    init_sync: false,
    maia: null,
    maia_alt: null
  }),
  persist: true,
  actions: {
    clearOIDC() {
      this.oidc = []
    },
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
      this.trustee = null
      this.gnap_jwt = null
      this.prefix = null
      this.maia = null
      if (route !== '/app/login') {
        location.reload()
      } else {
        router.push(route)
      }
    },
    update(user) {
      this.user = user
    },
    setMessage(message) {
      this.message = message
    },
    setOIDC(oidc) {
      this.oidc = oidc
    },
    setPatient(patient) {
      this.patient = patient
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
    }
  }
})