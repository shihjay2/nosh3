import { createApp } from 'vue'
import App from './App.vue'
import './registerServiceWorker'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'
import quasarUserOptions from './quasar-user-options'
import { router } from './helpers'
import { defineRule, configure } from 'vee-validate'
import AllRules from '@vee-validate/rules'

const app = createApp(App)
app.use(Quasar, quasarUserOptions)
app.use(createPinia())
app.use(router)
app.mount('#app')

Object.keys(AllRules).forEach(rule => {
  defineRule(rule, AllRules[rule])
})

configure({
  generateMessage: context => {
    return `The field ${context.field} is invalid`;
  }
})
