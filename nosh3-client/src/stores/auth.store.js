import { defineStore } from 'pinia'
import { router } from '@/helpers'

export const useAuthStore = defineStore({
  id: 'auth',
  state: () => ({
    // initialize state from local storage to enable user to stay logged in
    // user: JSON.parse(localStorage.getItem('user')),
    // jwt: localStorage.getItem('jwt'),
    // type: localStorage.getItem('type'),
    // auth: localStorage.getItem('auth'),
    // couchdb: localStorage.getItem('couchdb'),
    // api: JSON.parse(localStorage.getItem('api')),
    // pin: localStorage.getItem('pin'),
    // instance: localStorage.getItem('instance'),
    // trustee: localStorage.getItem('trustee'),
    // gnap_jwt: localStorage.getItem('gnap_jwt'),
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
    message: null
  }),
  persist: true,
  actions: {
    clearOIDC() {
      this.oidc = []
    },
    login(user, payload, jwt) {
      // update pinia state
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
      // store user details and jwt in local storage to keep user logged in between page refreshes
      // localStorage.setItem('user', JSON.stringify(user))
      // localStorage.setItem('jwt', jwt)
      // localStorage.setItem('type', payload._noshType)
      // localStorage.setItem('auth', payload._noshAuth)
      // localStorage.setItem('couchdb', payload._noshDB)
      // localStorage.setItem('api', JSON.stringify(payload._noshAPI))
      // localStorage.setItem('pin', payload._nosh.pin)
      // localStorage.setItem('instance', payload._nosh.instance)
      // localStorage.setItem('trustee', payload._nosh.trustee)
      // localStorage.setItem('gnap_jwt', payload.jwt)
      // localStorage.setItem('prefix', payload._nosh.prefix)
    },
    logout() {
      var route = '/app/login'
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
      // localStorage.removeItem('user')
      // localStorage.removeItem('jwt')
      // localStorage.removeItem('type')
      // localStorage.removeItem('auth')
      // localStorage.removeItem('couchdb')
      // localStorage.removeItem('api')
      // localStorage.removeItem('pin')
      // localStorage.removeItem('instance')
      // localStorage.removeItem('trustee')
      // localStorage.removeItem('gnap_jwt')
      // localStorage.removeItem('prefix')
      console.log(window.location.href)
      console.log(route)
      if (route !== '/app/login') {
        location.reload()
      } else {
        router.push(route)
      }
    },
    update(user) {
      this.user = user
      localStorage.setItem('user', JSON.stringify(user))
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
    setSyncResource(resource) {
      if (Array.isArray(resource)) {
        this.sync_resource = resource
      } else {
        if (!this.sync_resource.includes(resource)) {
          this.sync_resource.push(resource)
        }
      }
    }
  }
})