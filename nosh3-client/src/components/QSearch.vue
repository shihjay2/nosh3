<template>
  <q-select
    filled
    v-model="state.model"
    use-input
    clearable
    :input-debounce="state.debounce"
    :options="state.options"
    :label="label"
    @filter="filterFn"
    style="width: 300px"
    behavior="dialog"
    :disable="state.disable"
    class="full-width"
    dense="dense"
    ref="qSelectRef"
  >
    <template v-slot:append>
      <q-icon name="search"/>
      <q-icon v-if="state.tree" name="account_tree" @click="openTree"/>
    </template>
    <template v-slot:no-option>
      <q-item>
        <q-item-section class="text-grey">
          No results
        </q-item-section>
      </q-item>
    </template>
  </q-select>
  <q-dialog v-model="state.dialogDosage">
    <QDosage
      v-if="state.dialogDosage"
      @select-dosage="selectDosage"
      :medication_strengths="state.medication_strengths"
      :medication_rxcuis="state.medication_rxcuis"
      :medication_final="state.medication_final"
    />
  </q-dialog>
  <q-dialog v-model="state.dialogVaccine" persistent>
    <QVaccine
      v-if="state.dialogVaccine"
      @select-vaccine="selectVaccine"
      @close-vaccine="closeVaccine"
      :vaccine="state.vaccine"
    />
  </q-dialog>
  <q-dialog v-model="state.pulldown_tree" maximized transition-show="slide-up" transition-hide="slide-down">
    <q-card v-if="state.pulldown_tree_wait">
      <q-circular-progress
        indeterminate
        size="50px"
        color="primary"
        class="q-ma-md"
      />
      Loading...
    </q-card>
    <q-card v-if="state.pulldown_tree_final">
      <q-bar dark class="bg-primary text-white">
        <div class="text-weight-bold">
          {{ state.pulldown_bar }}
        </div>
        <q-space />
        <q-btn dense flat icon="close" @click="closePopup">
          <q-tooltip>Close</q-tooltip>
        </q-btn>
        <q-btn v-if="state.pulldown_selected !== ''" dense flat icon="check" @click="selectTree">
          <q-tooltip>Select</q-tooltip>
        </q-btn>
      </q-bar>
      <q-card-section>
        <div class="q-pa-md q-gutter-sm">
          <q-input ref="filterRef" filled v-model="state.pulldown_filter" label="Filter">
            <template v-slot:append>
              <q-icon v-if="state.pulldown_filter !== ''" name="clear" class="cursor-pointer" @click="resetFilter" />
            </template>
          </q-input>
          <q-tree
            :nodes="state.pulldown_nodes"
            node-key="value"
            :filter="state.pulldown_filter"
            @lazy-load="onLazyLoad"
            v-model:selected="state.pulldown_selected"
            selected-color="primary"
            default-expand-all
          />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, reactive, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { common } from '@/logic/common'
import axios from 'axios'
import { firstBy } from 'thenby'
import Fuse from 'fuse.js'
import jsqry from 'jsqry'
import objectPath from 'object-path'
import QDosage from './QDosage.vue'
import QVaccine from './QVaccine.vue'
import { useAuthStore } from '@/stores'

export default defineComponent({
  name: "QSearch",
  components: {
    QDosage,
    QVaccine
  },
  props: {
    search: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    code: {
      type: String
    },
    text: {
      type: String
    },
    name: {
      type: String
    },
    rxcui: {
      type: String
    },
    doseUnit: {
      type: String
    },
    route: {
      type: String,
    },
    targetDisease: {
      type: String
    },
    targetDiseaseText: {
      type: String
    },
    routesArray: {
      type: Array
    },
    resource: {
      type: String
    },
    online: Boolean,
    focus: Boolean
  },
  emits: ['copy-selected'],
  setup(props, { emit }) {
    const $q = useQuasar()
    const { fetchJSON, fetchTXT } = common()
    const state = reactive({
      options: [],
      model: '',
      debounce: 0,
      disable: false,
      bodySite: [],
      imaging: [],
      laboratory: [],
      // Search Medication
      selectedMedication: {},
      medication_final: {},
      medication_strengths: {},
      medication_rxcuis: {},
      dialogDosage: false,
      drugform: {},
      // search Vaccine
      searchVaccine: false,
      selectedVaccine: null,
      cvx: [],
      cvx_vis: [],
      vis_barcode_lookup: [],
      vis_url: [],
      targetDiseases: {},
      vacSched: {},
      dialogVaccine: false,
      vaccine: {},
      // search SNOMED
      token: '',
      st: '',
      apiKey: '',
      // snomed_tree
      tree: false,
      pulldown_tree: false,
      pulldown_tree_wait: false,
      pulldown_tree_final: false,
      pulldown_start: '',
      pulldown_filter: '',
      pulldown_nodes: [],
      pulldown_type: '',
      pulldown_bar: '',
      pulldown_selected: ''
    })
    const auth = useAuthStore(localStorage.getItem('auth_id'))
    onMounted(async() => {
      state.apiKey = auth.api.umls_key
      if (props.search === 'searchVaccine') {
        state.cvx = await fetchTXT('cvx', props.online)
        state.cvx_vis = await fetchTXT('cvx_vis', props.online)
        state.vis_barcode_lookup = await fetchTXT('vis_barcode_lookup', props.online)
        state.vis_url = await fetchTXT('vis_url', props.online)
        state.targetDiseases = await fetchJSON('targetDiseases', props.online)
        state.vacSched = await fetchJSON('vacSched', props.online)
      }
      if (props.search === 'searchMedication' ||
          props.search === 'searchMedicationAllergy' ||
          props.search === 'searchSNOMED') {
        state.drugform = await fetchJSON('drugform', props.online)
      }
      if (props.search === 'searchSNOMED') {
        state.debounce = 300
        state.tree = true
        state.pulldown_type = 'SNOMEDCT_US'
        if (props.resource === 'medication_statements' || props.resource === 'allergy_intolerances') {
          state.pulldown_start = '410942007' // drugs
        }
        if (props.resource === 'service_requests') {
          state.pulldown_start = '71388002' // procedures
        }
      }
      if (props.search === 'searchLOINC') {
        state.debounce = 300
        state.tree = true
        state.pulldown_type = 'LNC'
        if (props.resource === 'observations') {
          state.pulldown_start = 'LP7787-7' // clinical
        }
        if (props.resource === 'service_requests') {
          state.pulldown_start = 'LP29693-6' // laboratory
        }
      }
    })
    watch(() => state.model, json => {
      if (json !== null) {
        if (props.search === 'searchICD10' ||
            props.search === 'searchBodySite' ||
            props.search === 'searchSNOMED' ||
            props.search === 'searchLOINC' ||
            props.search === 'searchLaboratory' ||
            props.search === 'searchImaging') {
          emit('copy-selected', json, props.search)
        }
        if (props.search === 'searchMedication' ||
            props.search === 'searchMedicationAllergy') {
          if (state.dialogDosage === false) {
            state.dialogDosage = true
            state.medication_strengths = json.value.strength
            state.medication_rxcuis = json.value.rxcui
            state.medication_final.name = json.value.name
            state.medication_final.index = json.value.index
          }
        }
        if (props.search === 'searchVaccine') {
          if (state.dialogVaccine === false) {
            state.dialogVaccine = true
            state.vaccine = json.value
          }
        }
      }
    })
    watch(() => props.focus, (newVal) => {
      if (newVal) {
        qSelectRef.value.focus()
      }
    })
    const closeDosage = () => {
      state.dialogDosage = false
      state.medication_final = {},
      state.medication_strengths = {}
      state.medication_rxcuis = {}
    }
    const closePopup = () => {
      state.disable = false
      state.pulldown_tree = false
    }
    const closeVaccine = () => {
      state.dialogVaccine = false
      state.vaccine = {}
    }
    const filterFn = (val, update) => {
      update(() => {
        if (val !== '') {
          const searchTerm = val.toLocaleLowerCase()
          if (props.search === 'searchICD10') {
            getCondition(searchTerm)
          }
          if (props.search === 'searchBodySite') {
            getBodySite(searchTerm)
          }
          if (props.search === 'searchMedication' ||
              props.search === 'searchMedicationAllergy') {
            getMedication(searchTerm)
          }
          if (props.search === 'searchVaccine') {
            getVaccine(searchTerm)
          }
          if (props.search === 'searchSNOMED') {
            getConcept(searchTerm)
          }
          if (props.search === 'searchLOINC') {
            getLOINC(searchTerm)
          }
          if (props.search === 'searchLaboratory') {
            getLaboratory(searchTerm)
          }
          if (props.search === 'searchImaging') {
            getImaging(searchTerm)
          }
        }
      })
    }
    const filterRef = ref(null)
    const findItemNested = (arr, val, nestingKey) => {
      if (arr.length == 0) return
      return arr.find(d => d.value == val)
        || findItemNested(arr.flatMap(d => d[nestingKey] || []), val, nestingKey)
        || 'Not found'
    }
    const getBodySite = async(searchTerm) => {
      state.cvx = await fetchTXT('cvx', props.online)
      state.bodySite = await fetchJSON('bodySite', props.online)
      const fuse = new Fuse(state.bodySite.result, {keys: ['name', 'sourceUi']})
      const result = fuse.search(searchTerm)
      const shortresult = result.slice(0,10)
      state.options = []
      for (const i in shortresult) {
        const j = {}
        j.label = result[i].item.name
        j.value = {
          code: result[i].item.sourceUi,
          text: result[i].item.name
        }
        state.options.push(j)
      }
    }
    const getConcept = async(searchTerm) => {
      const params = {
        apiKey: state.apiKey,
        string: searchTerm,
        sabs: 'SNOMEDCT_US',
        returnIdType: 'code'
      }
      const opt = {
        timeout: 500
      }
      try {
        const d = await axios.get('https://uts-ws.nlm.nih.gov/rest/search/current', {params}, {opt})
        for (const i in d.data.result.results) {
          const j = {}
          j.label = d.data.result.results[i].name
          j.value = {
            code: d.data.result.results[i].ui,
            codeText: d.data.result.results[i].name,
            codeSystem: 'http://snomed.info/sct'
          }
          if (state.options.length > 0) {
            const k = jsqry.query(state.options, '<<value[_.code=="' + j.value.code +'"]>>')
            if (k.length === 0 && j.value.code !== 'NONE') {
              state.options.push(j)
            }
          } else {
            if (j.value.code !== 'NONE') {
              state.options.push(j)
            }
          }
          if (state.options.length > 0) {
            const fuse = new Fuse(state.options, {keys: ['label']})
            const result = fuse.search(searchTerm)
            state.options = []
            for (const l in result) {
              state.options.push(result[l].item)
            }
          }
        }
      } catch (e) {
        console.log(e)
        $q.notify({
          message: 'Error connecting to SNOMED CT API.  Please try again later',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const getCondition = async(searchTerm) => {
      const params = {
        sf: 'code,name',
        maxList: 100,
        terms: searchTerm
      }
      const opt = {
        timeout: 500
      }
      try {
        const d = await axios.get('https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search', {params}, {opt})
        state.options = []
        for (const i in d.data[3]) {
          const j = {}
          j.label = d.data[3][i][1] + ' [' + d.data[3][i][0] + ']'
          j.value = {
            code: d.data[3][i][0],
            text: d.data[3][i][1]
          }
          state.options.push(j)
        }
      } catch (e) {
        console.log(e)
        $q.notify({
          message: 'Error connecting to ICD-10 API.  Please try again later',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const getImaging = async(searchTerm) => {
      state.imaging = await fetchJSON('imaging', props.online)
      const fuse = new Fuse(state.imaging, {keys: ['name', 'loinc']})
      const result = fuse.search(searchTerm)
      const shortresult = result.slice(0,10)
      state.options = []
      for (const i in shortresult) {
        const j = {}
        j.label = result[i].item.name
        j.value = {
          code: result[i].item.loinc,
          text: result[i].item.name
        }
        state.options.push(j)
      }
    }
    const getLaboratory = async(searchTerm) => {
      state.laboratory = await fetchJSON('laboratory', props.online)
      const fuse = new Fuse(state.laboratory, {keys: ['LCN', 'LOINC']})
      const result = fuse.search(searchTerm)
      const shortresult = result.slice(0,10)
      state.options = []
      for (const i in shortresult) {
        const j = {}
        j.label = result[i].item.LCN
        j.value = {
          code: result[i].item.LOINC,
          text: result[i].item.LCN,
          unitcode: result[i].item.UCUM[0],
          unitlabel: result[i].item.UCUM[1]
        }
        state.options.push(j)
      }
    }
    const getLOINC = async(searchTerm) => {
      const params = {
        df: 'text,LOINC_NUM',
        sf: 'text,LONG_COMMON_NAME,LOINC_NUM',
        maxList: 100,
        terms: searchTerm
      }
      const opt = {
        timeout: 500
      }
      try {
        const d = await axios.get('https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search', {params}, {opt})
        state.options = []
        for (const i in d.data[3]) {
          const j = {}
          j.label = d.data[3][i][0] + ' [' + d.data[3][i][1] + ']'
          j.value = {
            code: d.data[3][i][1],
            text: d.data[3][i][0],
            system: "http://loinc.org"
          }
          state.options.push(j)
        }
      } catch (e) {
        console.log(e)
        $q.notify({
          message: 'Error connecting to LOINC API.  Please try again later',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const getMedication = async(searchTerm) => {
      const params = {
        ef: 'DISPLAY_NAME,STRENGTHS_AND_FORMS,RXCUIS',
        terms: searchTerm
      }
      const opt = {
        timeout: 500
      }
      try {
        const d = await axios.get('https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search', {params}, {opt})
        state.options = []
        for (const i in d.data[2].DISPLAY_NAME) {
          const j = {}
          j.label = d.data[2].DISPLAY_NAME[i]
          j.value = {
            name: d.data[2].DISPLAY_NAME[i],
            strength: d.data[2].STRENGTHS_AND_FORMS[i],
            rxcui: d.data[2].RXCUIS[i],
            index: i
          }
          state.options.push(j)
        }
      } catch (e) {
        console.log(e)
        $q.notify({
          message: 'Error connecting to RXNorm API.  Please try again later',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const getVaccine = (searchTerm) => {
      const term = String(searchTerm).toLowerCase()
      const fuse = new Fuse(state.cvx, {keys: ['0', '1', '2']})
      const result = fuse.search(term)
      const shortresult = result.slice(0,10)
      state.options = []
      for (const i in shortresult) {
        const j = {}
        j.label = shortresult[i].item[2]
        const json = {
          code: shortresult[i].item[0].trim(),
          text: shortresult[i].item[2].trim(),
          publicationDate: '',
          vis_uri: '',
          vis: '',
          protocol: [],
          shortname: shortresult[i].item[1].trim()
        }
        const a = state.cvx_vis.findIndex(item => item.includes(shortresult[i].item[0]))
        if (a !== -1) {
          const b = state.vis_barcode_lookup.data.findIndex(item => item.includes(state.cvx_vis[a][2]))
          json.publicationDate = state.vis_barcode_lookup.data[b][1]
          if (b !== -1) {
            const c = state.vis_url.data.findIndex(item => item.includes(state.vis_barcode_lookup.data[b][3]))
            json.vis_uri = state.vis_url.data[c][2]
            json.vis = state.vis_url.data[c][0]
            const d = jsqry.query(state.vacSched.immunizations, '<<codes[_.system=="CVX" && _.code==' + json.code +']>>')
            if (d !== null) {
              for (const e in d) {
                const f = {}
                f.series = d[e].total_doses + '-dose'
                f.doseNumberPositiveInt = ''
                f.targetDisease = []
                for (const g in d[e].targetDisease) {
                  const h = {}
                  h.system = 'http://snomed.info/sct'
                  h.code = d[e].targetDisease[g]
                  const k = state.targetDiseases.compose.include[0].concept.find(({ code }) => code === h.code)
                  h.display = k.display
                  f.targetDisease.push(h)
                }
                json.protocol.push(f)
              }
            }
          }
        }
        j.value = json
        state.options.push(j)
      }
    }
    const onLazyLoad = ({ node, key, done }) => {
      const params = {
        apiKey: state.apiKey,
        pageSize: 100
      }
      const c = []
      console.log(key)
      setTimeout(async() => {
        try {
          const a = await axios.get('https://uts-ws.nlm.nih.gov/rest/content/current/source/' + state.pulldown_type + '/' + node.value + '/children', {params})
          if (a.data.result.length > 0) {
            for (const b in a.data.result) {
              c.push({
                label: a.data.result[b].name,
                value: a.data.result[b].ui,
                lazy: true
              })
            }
          }
          c.sort(firstBy('label', {ignoreCase:true, direction:'asc'}))
          const e = state.pulldown_nodes.findIndex(d => d.value == node.value)
          objectPath.set(state, 'pulldown_nodes.' + e + '.children', c)
          done(c)
        } catch (e) {
          done([])
          console.log(e)
          $q.notify({
            message: 'Error connecting to API.  Please try again later',
            color: 'red',
            actions: [
              { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
            ]
          })
        }
        
      }, 1000)
    }
    const openTree = async() => {
      state.disable = true
      state.pulldown_tree = true
      state.pulldown_tree_wait = true
      state.pulldown_tree_final = false
      const params = {
        apiKey: state.apiKey,
        pageSize: 100
      }
      state.pulldown_nodes = []
      state.pulldown_selected = ''
      qSelectRef.value.hidePopup()
      try {
        const a = await axios.get('https://uts-ws.nlm.nih.gov/rest/content/current/source/' + state.pulldown_type + '/' + state.pulldown_start + '/children', {params})
        if (a.data.result.length > 0) {
          for (const b in a.data.result) {
            state.pulldown_nodes.push({
              label: a.data.result[b].name,
              value: a.data.result[b].ui,
              lazy: true
            })
          }
          state.pulldown_nodes.sort(firstBy('label', {ignoreCase:true, direction:'asc'}))
          state.pulldown_bar = 'SNOMED CT - Tree'
          state.pulldown_filter = ''
          state.pulldown_tree_wait = false
          state.pulldown_tree_final = true
          qSelectRef.value.hidePopup()
        }
      } catch (e) {
        console.log(e)
        $q.notify({
          message: 'Error connecting to API.  Please try again later',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const qSelectRef = ref(null)
    const resetFilter = () => {
      state.pulldown_filter = ''
      filterRef.value.focus()
    }
    const selectDosage = async(data) => {
      const json = {}
      json.value = {
        name: data.name + ', ' + data.strength,
        rxcui: data.rxcui,
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        category: 'medication'
      }
      if (props.search == 'searchMedication') {
        try {
          const b = await axios.get('https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/' + data.rxcui + '/allinfo.json')
          if (b.data.rxtermsProperties !== null) {
            const fuse1 = new Fuse(state.drugform.concept, {keys: ['code','display']})
            let result1 = fuse1.search(b.data.rxtermsProperties.rxtermsDoseForm)
            const fuse2 = new Fuse(props.routesArray, {keys: ['value','label']})
            let result2 = fuse2.search(b.data.rxtermsProperties.route)
            if (result1.length > 0) {
              result1 = result1.slice(0,1)
              result2 = result2.slice(0,1)
              objectPath.set(json, 'value.doseUnit', result1[0].item.code)
              objectPath.set(json, 'value.route', result2[0].item.value)
            }
          }
          emit('copy-selected', json, props.search)
        } catch (e) {
          console.log(e)
          $q.notify({
            message: 'Error connecting to SNOMED CT API.  Please try again later',
            color: 'red',
            actions: [
              { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
            ]
          })
        }
        
      } else {
        emit('copy-selected', json, props.search)
      }
      closeDosage()
    }
    const selectTree = () => {
      const json = {}
      const a = findItemNested(state.pulldown_nodes, state.pulldown_selected, 'children')
      objectPath.set(json, 'value.code', a.value)
      objectPath.set(json, 'value.codeText', a.label)
      objectPath.set(json, 'label', a.label)
      if (state.pulldown_type === 'SNOMEDCT_US') {
        objectPath.set(json, 'value.codeSystem', 'http://snomed.info/sct')
      }
      if (state.pulldown_type === 'LNC') {
        objectPath.set(json, 'value.codeSystem', 'http://loinc.org')
      }
      emit('copy-selected', json, props.search)
      state.disable = false
      state.pulldown_tree = false
    }
    const selectVaccine = (data) => {
      const json = {}
      json.value = data
      emit('copy-selected', json, props.search)
      closeVaccine()
    }
    return {
      closeDosage,
      closePopup,
      closeVaccine,
      fetchJSON,
      fetchTXT,
      filterFn,
      filterRef,
      findItemNested,
      getBodySite,
      getConcept,
      getCondition,
      getImaging,
      getLaboratory,
      getLOINC,
      getMedication,
      getVaccine,
      onLazyLoad,
      openTree,
      qSelectRef,
      resetFilter,
      selectDosage,
      selectTree,
      selectVaccine,
      state
    }
  },
})
</script>
