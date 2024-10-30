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
import { useQuasar } from 'quasar'
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
    const $q = useQuasar()
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
          const result = await axios.post(window.location.origin + '/oidc', {url: 'https://open.epic.com/Endpoints/R4'})
          const data_build = result.data.entry
          // synthetic records
          const result_synth = await axios.get('https://api.github.com/repos/agropper/Challenge/contents/synthetic?ref=main')
          for (const synth_row of result_synth.data) {
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
        open(props.type, props.name)
      }
    })
    watch(() => state.filter, async(newVal) => {
      if (newVal !== '') {
        state.data = []
        state.bluebutton = false
        const keys = ['resource.name']
        const fuse = new Fuse(state.epic, {keys: keys})
        const result = fuse.search(newVal)
        for (const a of result) {
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
      const oidc_state = uuidv4()
      if (props.type === '') {
        if (origin !== 'synthea') {
          const relay_url = auth.api.oidc_relay_url + '/oidc_relay'
          const body = {
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
          emit('loading')
          const response = await axios.post(window.location.origin + '/oidc', {url: relay_url, body: body})
          localStorage.setItem('oidc_response', response.data)
          window.location.href = auth.api.oidc_relay_url + '/oidc_relay_start/' + oidc_state
        } else {
          objectPath.set(state, 'oidc.origin', name + ' Synthetic Records')
          auth.setLastOIDC(name + ' Synthetic Records')
          try {
            emit('loading')
            const oidc_response2 = await axios.get(type)
            const resources2 = await fetchJSON('resources', props.online)
            state.resources = resources2.rows
            let c1_synthea = 0
            for (const c_synthea of resources2.rows) {
              const rows2 = []
              if (c_synthea.resource !== 'patients') {
                let c2_synthea_count = 0
                for (const c2_synthea of oidc_response2.data.entry) {
                  if (c2_synthea.resource.resourceType === Case.pascal(pluralize.singular(c_synthea.resource))) {
                    if (c2_synthea_count < 300) {
                      rows2.push(c2_synthea.resource)
                    }
                    c2_synthea_count++
                  }
                }
                const docs_synthea = {
                  resource: c_synthea.resource,
                  rows: rows2
                }
                objectPath.set(state, 'oidc.docs.' + c1_synthea, docs_synthea)
                c1_synthea++
              }
            }
            emit('save-oidc', state.oidc)
            emit('loading')
          } catch (e) {
            console.log(e)
          }
        }
      } else {
        const notif = $q.notify({
          group: false,
          timeout: 0,
          spinner: true,
          message: 'Sync from ' + name + '...',
          color: 'primary'
        })
        const debug = []
        let i = 0
        objectPath.set(state, 'oidc.origin', name)
        auth.setLastOIDC(name)
        const relay_url1 = auth.api.oidc_relay_url + '/oidc_relay/' + localStorage.getItem('oidc_state')
        const response1 = await axios.post(window.location.origin + '/oidc', {url: relay_url1})
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
          const resources = await fetchJSON('resources', props.online)
          state.resources = resources.rows
          let c1 = 0
          for (const c of resources.rows) {
            if (c.fhir) {
              if (c.resource !== 'patients') {
                const oidc_url = localStorage.getItem('oidc_url') + Case.pascal(pluralize.singular(c.resource)) + '?patient=' + state.patient_token
                const opts = {headers: {Authorization: 'Bearer ' + state.access_token, Accept: 'application/json'}}
                const counter = Number(i) + 1
                notif({
                  caption: counter + '/' + resources.rows.length + ': Syncing ' + Case.capital(c.resource)
                })
                try {
                  const oidc_response = await axios.get(oidc_url, opts)
                  const rows = []
                  for (const c2 of oidc_response.data.entry) {
                    if (c2.resource.resourceType === Case.pascal(pluralize.singular(c.resource))) {
                      if (c.resource === 'document_references') {
                        if (objectPath.has(c2, 'resource.content.0.attachment.url')) {
                          try {
                            const oidc_url_binary = localStorage.getItem('oidc_url') + objectPath.get(c2, 'resource.content.0.attachment.url')
                            const oidc_response_binary = await axios.get(oidc_url_binary, opts)
                            const oidc_type = objectPath.get(c2, 'resource.content.0.attachment.contentType')
                            objectPath.empty(c2, 'resource.content')
                            objectPath.set(c2, 'resource.content.0.attachment.contentType', oidc_type)
                            objectPath.set(c2, 'resource.content.0.attachment.data', btoa(oidc_response_binary.data))
                            const ret1 = {
                              resource: 'binaries',
                              response: oidc_response_binary
                            }
                            debug.push(ret1)
                            objectPath.set(state, 'oidc.debug', debug)
                          } catch (e) {
                            console.log(e)
                            const err = {
                              resource: 'binaries',
                              error: e
                            }
                            debug.push(err)
                            objectPath.set(state, 'oidc.debug', debug)
                          }
                        }
                      }
                      rows.push(c2.resource)
                    }
                  }
                  const ret = {
                    resource: c.resource,
                    token: state.access_token,
                    url: oidc_url,
                    response: oidc_response
                  }
                  debug.push(ret)
                  objectPath.set(state, 'oidc.debug', debug)
                  const docs = {
                    resource: c.resource,
                    rows: rows
                  }
                  objectPath.set(state, 'oidc.docs.' + c1, docs)
                  notif({
                    caption: counter + '/' + resources.rows.length + ': Synced ' + Case.capital(c.resource)
                  })
                  c1++
                } catch (e) {
                  const err = {
                    resource: c.resource,
                    token: state.access_token,
                    url: oidc_url,
                    error: e
                  }
                  debug.push(err)
                  objectPath.set(state, 'oidc.debug', debug)
                }
              }
            }
            i++
          }
        } else {
          const cms_resources = [
            {label: 'Summary', path: 'v1/connect/userinfo'},
            {label: 'EOB', path: 'v1/fhir/ExplanationOfBenefit/?patient=', resource: 'ExplanationOfBenefit'},
            {label: 'Coverage', path: 'v1/fhir/Coverage/?patient=', resource: 'Coverage'}
          ]
          let d1 = 0
          let cms_patient = ''
          for (const d of cms_resources) {
            const oidc_url1 = localStorage.getItem('oidc_url') + d.path
            const opts1 = {headers: { Authorization: 'Bearer ' + state.access_token}}
            const counter = Number(i) + 1
            notif({
              caption: counter + '/' + cms_resources.length + ': Syncing ' + d.label
            })
            try {
              const oidc_response1 = await axios.get(oidc_url1 + cms_patient, opts1)
              const ret = {
                resource: d.resource,
                token: state.access_token,
                url: oidc_url1 + cms_patient,
                response: oidc_response1
              }
              debug.push(ret)
              objectPath.set(state, 'oidc.debug', debug)
              if (d.label !== 'Summary') {
                const coverage_arr = auth.coverage
                const eob_arr = auth.eob
                const rows1 = []
                for (const d2 of oidc_response1.data.entry) {
                  if (d.label === 'Coverage') {
                    coverage_arr.push(d2.resource)
                    auth.setCoverage(coverage_arr)
                  }
                  if (d.label === 'EOB') {
                    eob_arr.push(d2.resource)
                    auth.setEOB(eob_arr)
                  }
                  if (d2.resource.resourceType === d.resource) {
                    rows1.push(d2.resource)
                  }
                }
                const docs1 = {
                  resource: d.label,
                  rows: rows1
                }
                objectPath.set(state, 'oidc.docs.' + d1, docs1)
                d1++
              } else {
                cms_patient = oidc_response1.data.patient
                const docs1 = {
                  resource: d.label,
                  rows: oidc_response1.data
                }
                objectPath.set(state, 'oidc.docs.' + d1, docs1)
              }
              notif({
                caption: counter + '/' + cms_resources.length + ': Synced ' + d.label
              })
            } catch (e) {
              console.log(e)
              const err = {
                resource: c.resource,
                token: state.access_token,
                url: oidc_url1 + cms_patient,
                error: e
              }
              debug.push(err)
              objectPath.set(state, 'oidc.debug', debug)
            }
            i++
          }
        }
        notif({
          icon: 'done',
          spinner: false,
          message: 'Sync completed!',
          timeout: 2500
        })
        objectPath.set(state, 'oidc.debug', debug)
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
