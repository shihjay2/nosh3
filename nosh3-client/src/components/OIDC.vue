<template>
  <div class="q-pa-md">
    <q-input ref="filter" dense="dense" bottom-slots v-model="state.filter" placeholder="Search EPIC Institution" debounce="300" autofocus>
      <template v-slot:append>
        <q-icon v-if="state.filter !== ''" name="close" @click="state.filter = ''" class="cursor-pointer" />
        <q-icon name="search" />
      </template>
    </q-input>
    <q-list>
      <q-item v-if="state.bluebutton" clickable @click="open('cms_bluebutton', 'CMS Bluebutton')">
        CMS Bluebutton
      </q-item>
      <q-item v-if="state.bluebutton" clickable @click="open('cms_bluebutton_sandbox', 'CMS Bluebutton Sandbox')">
        CMS Bluebutton Sandbox
      </q-item>
      <q-item v-if="state.bluebutton" clickable @click="open('https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/', 'EPIC Sandbox')">
        EPIC Sandbox
      </q-item>
      <div v-for="item in state.data" :key="item.id">
        <q-item clickable @click="open(item.resource.address, item.resource.name)">
          {{ item.resource.name }}
        </q-item>
      </div>
    </q-list>
  </div>
</template>

<script>
import { defineComponent, reactive, ref, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import axios from 'axios'
import Case from 'case'
import Fuse from 'fuse.js'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import {v4 as uuidv4} from 'uuid'
import { useAuthStore } from '@/stores'

export default defineComponent({
  name: 'OIDC',
  props: {
    type: String,
    name: String,
    online: Boolean,
    oidcComplete: Boolean,
    patient: String
  },
  emits: ['loading', 'save-oidc'],
  setup(props, { emit }) {
    const { fetchJSON } = common()
    const filter = ref(null)
    const state = reactive({
      filter: '',
      epic: [],
      data: [],
      base_url: '',
      access_token: '',
      refresh_token: '',
      patient_token: '',
      patient: '',
      oidc: {},
      bluebutton: false
    })
    const auth = useAuthStore()
    onMounted(async() => {
      if (props.type === '') {
        state.bluebutton = true
        try {
          emit('loading')
          var result = await axios.post(window.location.origin + '/oidc', {url: 'https://open.epic.com/Endpoints/R4'})
          emit('loading')
          state.epic = result.data.entry
          state.data = result.data.entry
        } catch (e) {
          console.log('Error reaching out to EPIC')
        }
      } else {
        emit('loading')
        var a = JSON.parse(localStorage.getItem('oidc'))
        open(props.type, props.name)
      }
    })
    watch(() => state.filter, async(newVal) => {
      if (newVal !== '') {
        state.data = []
        state.bluebutton = false
        const keys = ['resource.name']
        const fuse = new Fuse(state.epic, {keys: keys})
        var result = fuse.search(newVal)
        for (var a of result) {
          state.data.push(a.item)
        }
      } else {
        state.bluebutton = true
        state.data = state.epic
      }
    })
    watch(() => props.oidcComplete, (newVal) => {
      if (newVal) {
        window.location.href = window.location.origin + '/app/chart/' + props.patient
      }
    })
    const open = async(type, name) => {
      var oidc_state = uuidv4()
      if (props.type === '') {
        var relay_url = auth.api.oidc_relay_url + '/oidc_relay'
        var body = {
          origin_uri: location.protocol + '//' + location.host + location.pathname + '?oidc=' + type,
          response_uri: location.protocol + '//' + location.host + location.pathname + '?oidc=' + type,
          type: type,
          state: oidc_state,
          refresh_token: ''
        }
        if (type !== 'cms_bluebutton' && type !== 'cms_bluebutton_sandbox') {
          objectPath.set(body, 'fhir_url', type)
          state.base_url = type
          objectPath.set(body, 'type', 'epic')
          objectPath.set(body, 'origin_uri', location.protocol + '//' + location.host + location.pathname + '?oidc=epic')
          objectPath.set(body, 'response_uri', location.protocol + '//' + location.host + location.pathname + '?oidc=epic')
          var a = await axios.post(window.location.origin + '/oidc', {url: type + 'metadata'})
          for (var b of a.data.rest[0].security.extension[0].extension) {
            if (b.url == 'authorize') {
              objectPath.set(body, 'fhir_auth_url', b.valueUri)
            }
            if (b.url == 'token') {
              objectPath.set(body, 'fhir_token_url', b.valueUri)
            }
          }
        } else {
          if (type === 'cms_bluebutton') {
            state.base_url = 'https://api.bluebutton.cms.gov/'
          } else {
            state.base_url = 'https://sandbox.bluebutton.cms.gov/'
          }
        }
        localStorage.setItem('oidc', JSON.stringify(body))
        localStorage.setItem('oidc_url', state.base_url)
        localStorage.setItem('oidc_state', oidc_state)
        localStorage.setItem('oidc_name', name)
        var response = await axios.post(window.location.origin + '/oidc', {url: relay_url, body: body})
        localStorage.setItem('oidc_response', response.data)
        window.location.href = auth.api.oidc_relay_url + '/oidc_relay_start/' + oidc_state
      } else {
        objectPath.set(state, 'oidc.origin', name)
        var relay_url1 = auth.api.oidc_relay_url + '/oidc_relay/' + localStorage.getItem('oidc_state')
        var response1 = await axios.post(window.location.origin + '/oidc', {url: relay_url1})
        localStorage.setItem('oidc_access_token', response1.data.access_token)
        state.access_token = response1.data.access_token
        if (objectPath.has(response1, 'data.refresh_token')) {
          localStorage.setItem('oidc_refresh_token', response1.data.refresh_token)
          state.refresh_token = response1.data.refresh_token
        }
        if (objectPath.has(response1, 'data.patient_token')) {
          localStorage.setItem('oidc_patient_token', response1.data.patient_token)
          state.patient_token = response1.data.patient_token
        }
        if (objectPath.has(response1, 'data.patient')) {
          localStorage.setItem('oidc_patient', response1.data.patient)
          state.patient = response1.data.patient
        }
        if (type !== 'cms_bluebutton' && type !== 'cms_bluebutton_sandbox') {
          var resources = await fetchJSON('resources', props.online)
          state.resources = resources.rows
          var c1 = 0
          for (var c of resources.rows) {
            var oidc_url = localStorage.getItem('oidc_url') + Case.pascal(pluralize.singular(c.resource)) + '?patient=' + state.patient_token
            var opts = {headers: {Authorization: 'Bearer ' + state.access_token, Accept: 'application/json'}}
            try {
              var oidc_response = await axios.get(oidc_url, opts)
              var rows = []
              console.log(oidc_response.data)
              for (var c2 of oidc_response.data.entry) {
                if (c2.resource.resourceType === Case.pascal(pluralize.singular(c.resource))) {
                  rows.push(c2.resource)
                }
              }
              var docs = {
                resource: c.resource,
                rows: rows
              }
              objectPath.set(state, 'oidc.docs.' + c1, docs)
              c1++
            } catch (e) {
              console.log(e)
            }
          }
        } else {
          var cms_resources = [
            {label: 'Summary', path: 'v1/connect/userinfo'},
            {label: 'EOB', path: 'v1/fhir/ExplanationOfBenefit/?patient=' + state.patient, resource: 'ExplanationOfBenefit'},
            {label: 'Coverage', path: 'v1/fhir/Coverage/?patient=' + state.patient, resource: 'Coverage'}
          ]
          var d1 = 0
          for (var d of cms_resources) {
            var oidc_url1 = state.base_url + d.path
            var opts1 = {headers: { Authorization: 'Bearer ' + state.access_token}}
            try {
              var oidc_response1 = await axios.get(oidc_url1, opts1)
              if (d.label !== 'Summary') {
                var rows1 = []
                for (var d2 of oidc_response1.data.entry) {
                  if (d2.resource.resourceType === d.resource) {
                    rows.push(d2.resource)
                  }
                }
                var docs1 = {
                  resource: d.label,
                  rows: rows1
                }
                objectPath.set(state, 'oidc.docs.' + d1, docs1)
                d1++
              } else {
                var docs1 = {
                  resource: d.label,
                  rows: oidc_response1.data
                }
                objectPath.set(state, 'oidc.docs.' + d1, docs1)
              }
            } catch (e) {
              console.log(e)
            }
          }
        }
        emit('save-oidc', state.oidc)
      }
    }
    return {
      filter,
      open,
      state
    }
  }
})
</script>
<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
