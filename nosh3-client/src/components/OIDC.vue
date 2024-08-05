<template>
  <div class="q-pa-md">
    <q-input ref="filter" dense="dense" bottom-slots v-model="state.filter" placeholder="Search EPIC Institution or Synthetic Record" debounce="300" autofocus>
      <template v-slot:append>
        <q-icon v-if="state.filter !== ''" name="close" @click="state.filter = ''" class="cursor-pointer" />
        <q-icon name="search" />
      </template>
    </q-input>
    <q-list>
      <q-item v-if="state.bluebutton" clickable @click="open('cms_bluebutton', 'CMS Bluebutton', 'cms_bluebutton')">
        CMS Bluebutton
      </q-item>
      <q-item v-if="state.bluebutton" clickable @click="open('cms_bluebutton_sandbox', 'CMS Bluebutton Sandbox', 'cms_bluebutton_sandbox')">
        CMS Bluebutton Sandbox
      </q-item>
      <q-item v-if="state.bluebutton" clickable @click="open('https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/', 'EPIC Sandbox', 'Endpoint')">
        EPIC Sandbox
      </q-item>
      <div v-for="item in state.data" :key="item.id">
        <q-item clickable @click="open(item.resource.address, item.resource.name, item.resource.resourceType)">
          <q-item-section>{{ item.resource.name }}</q-item-section>
          <q-item-section v-if="item.resource.resourceType === 'Endpoint'" avatar>
            <img src="https://open.epic.com/Content/Images/logo.png?version=R41429" height="25">
          </q-item-section>
          <q-item-section v-else avatar>
            <img src="https://synthea.mitre.org/logos/logo?v=1562710747000" height="25">
          </q-item-section>
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
import sortArray from 'sort-array'
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
      bluebutton: false,
      loading: false
    })
    const auth = useAuthStore()
    onMounted(async() => {
      if (props.type === '') {
        state.bluebutton = true
        state.loading = true
        try {
          emit('loading')
          var result = await axios.post(window.location.origin + '/oidc', {url: 'https://open.epic.com/Endpoints/R4'})
          const data_build = result.data.entry
          // synthetic records
          const result_synth = await axios.get('https://api.github.com/repos/agropper/Challenge/contents/synthetic?ref=main')
          for (var synth_row of result_synth.data) {
            const synth_push = {
              resource: {
                address: synth_row.download_url,
                name: synth_row.name.replace('.json', ''),
                resourceType: 'synthea'
              }
            }
            data_build.push(synth_push)
          }
          sortArray(data_build, {by: 'name', computed:{name: row => row.resource.name}, order: 'asc'})
          state.data = data_build
          emit('loading')
          state.epic = state.data
          state.loading = false
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
        if (state.loading !== true) {
          state.bluebutton = true
          state.data = state.epic
        }
      }
    })
    watch(() => props.oidcComplete, (newVal) => {
      if (newVal) {
        window.location.href = window.location.origin + '/app/chart/' + props.patient
      }
    })
    const open = async(type, name, origin) => {
      var oidc_state = uuidv4()
      if (props.type === '') {
        if (origin !== 'synthea') {
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
          try {
            var oidc_response2 = await axios.get(type)
            var resources2 = await fetchJSON('resources', props.online)
            state.resources = resources2.rows
            var c1_synthea = 0
            for (var c_synthea of resources2.rows) {
              var rows2 = []
              if (c_synthea.resource !== 'patients') {
                for (var c2_synthea of oidc_response2.data.entry) {
                  if (c2_synthea.resource.resourceType === Case.pascal(pluralize.singular(c_synthea.resource))) {
                    rows2.push(c2_synthea.resource)
                  }
                }
                var docs_synthea = {
                  resource: c_synthea.resource,
                  rows: rows2
                }
                objectPath.set(state, 'oidc.docs.' + c1_synthea, docs_synthea)
                c1_synthea++
              }
            }
            emit('save-oidc', state.oidc)
          } catch (e) {
            console.log(e)
          }
        }
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
            if (c.resource !== 'patients') {
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
