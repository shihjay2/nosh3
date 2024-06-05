import { createApp } from 'vue'
import App from './App.vue'
import './registerServiceWorker'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { Quasar } from 'quasar'
import quasarUserOptions from './quasar-user-options'
import { router } from './helpers'
import { defineRule, configure } from 'vee-validate'
import * as rules from '@vee-validate/rules'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(Quasar, quasarUserOptions)
app.use(pinia)
app.use(router)
app.mount('#app')

Object.keys(rules).forEach(rule => {
  defineRule(rule, rules[rule])
})

configure({
  generateMessage: context => {
    return `The field ${context.field} is invalid`;
  }
})
