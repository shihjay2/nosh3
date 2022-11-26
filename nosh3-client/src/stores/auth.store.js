import { defineStore } from 'pinia'
import { router } from '@/helpers'

export const useAuthStore = defineStore({
  id: 'auth',
  state: () => ({
    // initialize state from local storage to enable user to stay logged in
    user: JSON.parse(localStorage.getItem('user')),
    jwt: localStorage.getItem('jwt'),
    type: localStorage.getItem('type'),
    auth: localStorage.getItem('auth'),
    couchdb: localStorage.getItem('couchdb'),
    api: JSON.parse(localStorage.getItem('api')),
    pin: localStorage.getItem('pin'),
    trustee: localStorage.getItem('trustee'),
    returnUrl: null
  }),
  actions: {
    login(user, payload, jwt) {
      // update pinia state
      this.user = user
      this.jwt = jwt
      this.type = payload._noshType
      this.auth = payload._noshAuth
      this.couchdb = payload._noshDB
      this.api = payload._noshAPI
      this.pin = payload._nosh.pin
      this.trustee = payload._nosh.trustee_url
      // store user details and jwt in local storage to keep user logged in between page refreshes
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('jwt', jwt)
      localStorage.setItem('type', payload._noshType)
      localStorage.setItem('auth', payload._noshAuth)
      localStorage.setItem('couchdb', payload._noshDB)
      localStorage.setItem('api', JSON.stringify(payload._noshAPI))
      localStorage.setItem('pin', payload._nosh.pin)
      localStorage.setItem('trustee', payload._nosh.trustee)
      // redirect to previous url or default to home page
      router.push(this.returnUrl || payload._noshRedirect)
    },
    logout() {
      this.user = null
      this.jwt = null
      this.type = null
      this.auth = null
      this.couchdb = null
      this.api = null
      this.pin = null
      this.trustee = null
      this.returnUrl = null
      localStorage.removeItem('user')
      localStorage.removeItem('jwt')
      localStorage.removeItem('type')
      localStorage.removeItem('auth')
      localStorage.removeItem('couchdb')
      localStorage.removeItem('api')
      localStorage.removeItem('pin')
      localStorage.removeItem('trustee')
      router.push('/app/login')
    },
    update(user) {
      this.user = user
      localStorage.setItem('user', JSON.stringify(user))
      console.log('Pinia user updated')
    }
  }
})