<template>
  <div class="q-pa-md">
    <q-card>
      <q-tabs
        v-model="state.tab"
        dense
        class="text-grey"
        active-color="primary"
        indicator-color="primary"
        align="justify"
        narrow-indicator
      >
        <div v-for="tab1 in state.base.tabs" :key="tab1.category">
          <q-tab :name="tab1.category" :label="tab1.label" />
        </div>
      </q-tabs>
      <q-separator />
      <q-tab-panels
        v-model="state.tab"
        animated
        v-for="tab2 in state.base.tabs"
        :key="tab2.category"
        @before-transition="updateTab"
      >
        <q-tab-panel :name="tab2.category">
          <q-card-section v-if="tab2.template == 'info'" clickable @click="onFormOpen(state.id, tab2.category)">
            <q-list v-for="(data, index) in state.data[tab2.category]" :key="data.key">
              <q-separator v-if="index !== 0" spaced inset />
              <QInfoTemplate
                :data="data"
                :style="state.base[tab2.category].uiPageContent.contentStyle"
              />
            </q-list>
          </q-card-section>
          <q-card-section v-if="tab2.template == 'card'">
            <QCardTemplate
              v-if="state.showList"
              @open-form="openForm"
              @reload-complete="reloadComplete"
              :auth="state.auth"
              :online="state.online"
              :couchdb="state.couchdb"
              :pin="state.pin"
              :patient="state.patient"
              :data="state.data[tab2.category]"
              :result="state.fhir"
              :sort="state.sort"
              :reload="state.tabReload"
              :countries="state.countries"
              :states="state.states"
              :language="state.language"
              :schema="state.schema"
            />
            <QFormTemplate
              v-if="state.showForm"
              @care-plan="setActiveCarePlan"
              @close-form="closeForm"
              @loading="loading"
              @reload-drawer="reloadDrawer"
              :auth="state.auth"
              :online="state.online"
              :couchdb="state.couchdb"
              :pin="state.pin"
              :id="state.id"
              :patient="state.patient"
              :provider="state.provider"
              :practitioner="state.practitioner"
              :user="state.user"
              :encounter="state.encounter"
              :resource="tab2.resource"
              :category="state.category"
              :index="state.index"
              :default="state.default"
              :base="state.formbase"
              :schema="state.schema"
              :keys="state.key"
              :sub_schema="state.sub_schema"
              :select="state.select"
              :div_content="state.divContent"
              :search="state.search"
              :care_plan_doc="state.careplanDoc"
              :composition_doc="state.compositionDoc"
              :medication_request_doc="state.medication_request_doc"
              :service_request_doc="state.service_request_doc"
              :states="state.states"
            />
          </q-card-section>
          <q-card-section v-if="tab2.template == 'table'">
            <QTableTemplate
              :data="state.data[tab2.category]"
            />
          </q-card-section>
          <q-card-section v-if="tab2.template == 'form'">
            <QFormTemplate
              v-if="state.showForm"
              @care-plan="setActiveCarePlan"
              @close-form="closeForm"
              @loading="loading"
              @reload-drawer="reloadDrawer"
              :auth="state.auth"
              :online="state.online"
              :couchdb="state.couchdb"
              :pin="state.pin"
              :id="state.id"
              :patient="state.patient"
              :provider="state.provider"
              :practitioner="state.practitioner"
              :user="state.user"
              :encounter="state.encounter"
              :resource="state.resource"
              :category="state.category"
              :index="state.index"
              :default="state.default"
              :base="state.formbase"
              :schema="state.schema"
              :keys="state.key"
              :sub_schema="state.sub_schema"
              :select="state.select"
              :div_content="state.divContent"
              :search="state.search"
              :care_plan_doc="state.careplanDoc"
              :composition_doc="state.compositionDoc"
              :medication_request_doc="state.medication_request_doc"
              :service_request_doc="state.service_request_doc"
            />
          </q-card-section>
          <q-card-section v-if="tab2.template == 'list'">
            <QListTemplate
              v-if="state.showList"
              @loading="loading"
              @lock-thread="lockThread"
              @open-form="openForm"
              @reload-complete="reloadComplete"
              @remove-oidc="removeOIDC"
              @care-plan="setActiveCarePlan"
              @composition="setActiveComposition"
              @new-prescription="newPrescription"
              :auth="state.auth"
              :online="state.online"
              :couchdb="state.couchdb"
              :pin="state.pin"
              :encounter="state.encounter"
              :patient="state.patient"
              :provider="state.provider"
              :practitioner="state.practitioner"
              :user="state.user"
              :reload="state.tabReload"
              :resource="tab2.resource"
              :category="state.category"
              :sort="state.sort"
              :base="state.formbase"
              :schema="state.schema"
              :within_page="state.within_page"
              :options="state.options"
              :care_plan_doc="state.careplanDoc"
              :composition_doc="state.compositionDoc"
              :oidc="state.oidc"
            />
            <QFormTemplate
              v-if="state.showForm"
              @care-plan="setActiveCarePlan"
              @close-form="closeForm"
              @loading="loading"
              @reload-drawer="reloadDrawer"
              :auth="state.auth"
              :online="state.online"
              :couchdb="state.couchdb"
              :pin="state.pin"
              :id="state.id"
              :patient="state.patient"
              :provider="state.provider"
              :practitioner="state.practitioner"
              :user="state.user"
              :encounter="state.encounter"
              :resource="state.resource"
              :category="state.category"
              :index="state.index"
              :default="state.default"
              :base="state.formbase"
              :schema="state.schema"
              :keys="state.key"
              :sub_schema="state.sub_schema"
              :select="state.select"
              :div_content="state.divContent"
              :search="state.search"
              :care_plan_doc="state.careplanDoc"
              :composition_doc="state.compositionDoc"
              :medication_request_doc="state.medication_request_doc"
              :service_request_doc="state.service_request_doc"
            />
          </q-card-section>
          <q-card-section v-if="tab2.template == 'mixed'">
            <QMixedTemplate
              v-if="state.showList"
              @open-form="openForm"
              @open-graph="openGraph"
              @reload-complete="reloadComplete"
              :encounter="state.encounter"
              :patient="state.patient"
              :category="state.category"
              :reload="state.tabReload"
              :resource="tab2.resource"
              :base="state.formbase"
              :schema="state.schema"
              :online="state.online"
              :options="state.options"
            />
            <QFormTemplate
              v-if="state.showForm"
              @care-plan="setActiveCarePlan"
              @close-form="closeForm"
              @loading="loading"
              @reload-drawer="reloadDrawer"
              :auth="state.auth"
              :online="state.online"
              :couchdb="state.couchdb"
              :pin="state.pin"
              :id="state.id"
              :patient="state.patient"
              :provider="state.provider"
              :practitioner="state.practitioner"
              :user="state.user"
              :encounter="state.encounter"
              :resource="state.resource"
              :category="state.category"
              :index="state.index"
              :default="state.default"
              :base="state.formbase"
              :schema="state.schema"
              :keys="state.key"
              :sub_schema="state.sub_schema"
              :select="state.select"
              :div_content="state.divContent"
              :search="state.search"
              :care_plan_doc="state.careplanDoc"
              :composition_doc="state.compositionDoc"
              :medication_request_doc="state.medication_request_doc"
              :service_request_doc="state.service_request_doc"
            />
          </q-card-section>
          <q-card-section v-if="tab2.template == 'file'">
            <QFileTemplate
              v-if="state.showFile"
              @update-toolbar="updateToolbar"
              @reload-drawer="reloadDrawer"
              :auth="state.auth"
              :online="state.online"
              :couchdb="state.couchdb"
              :pin="state.pin"
              :encounter="state.encounter"
              :patient="state.patient"
              :resource="tab2.resource"
              :category="tab2.category"
              :id="state.id"
              :doc_class_codes="state.docClassCodes"
              :doc_type_codes="state.docTypeCodes"
            />
          </q-card-section>
          <q-card-section v-if="tab2.template == 'graph'">
            <q-card>
              <q-list bordered separator>
                <q-item clickable v-ripple @click="openGraph('wfa', '')">
                  Weight for Age
                </q-item>
                <q-item clickable v-ripple @click="openGraph('lhfa', '')">
                  Length/Height for Age
                </q-item>
                <q-item clickable v-ripple @click="openGraph('bfa', '')">
                  BMI for Age
                </q-item>
                <q-item clickable v-ripple @click="openGraph('hcfa', '')">
                  Head Circumference for Age
                </q-item>
                <q-item clickable v-ripple @click="openGraph('wfh', '')">
                  Weight for Height
                </q-item>
                <q-item clickable v-ripple @click="openGraph('wfl', '')">
                  Weight for Length
                </q-item>
              </q-list>
            </q-card>
          </q-card-section>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </div>
</template>

<script>
import { defineComponent, nextTick, reactive, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores'
import { useQuasar } from 'quasar'
import { common } from '@/logic/common'
import convert from 'convert'
import moment from 'moment'
import objectPath from 'object-path'
import PouchDB from 'pouchdb-browser'
import QCardTemplate from './QCardTemplate.vue'
import QFileTemplate from './QFileTemplate.vue'
import QFormTemplate from './QFormTemplate.vue'
import QInfoTemplate from './QInfoTemplate.vue'
import QListTemplate from './QListTemplate.vue'
import QMixedTemplate from './QMixedTemplate.vue'
import QTableTemplate from './QTableTemplate.vue'
import {v4 as uuidv4} from 'uuid'

export default defineComponent({
  name: 'QPageTemplate',
  components: {
    QCardTemplate,
    QFileTemplate,
    QFormTemplate,
    QInfoTemplate,
    QListTemplate,
    QMixedTemplate,
    QTableTemplate
  },
  props: {
    auth: Object,
    online: Boolean,
    couchdb: String,
    pin: String,
    id: String,
    encounter: String,
    patient: String,
    provider: Boolean,
    practitioner: String,
    user: Object,
    resource: String,
    reload: Boolean,
    category: String,
    sort: String,
    openPageForm: Boolean,
    care_plan_doc: Object,
    invoke: Array,
    states: Array,
    countries: Array,
    language: Array,
    oidc: {
      type: Array,
      default: function () { return []}
    }
  },
  emits: ['care-plan', 'composition', 'loading', 'lock-thread', 'new-prescription', 'open-form', 'open-graph', 'open-page-form-complete', 'reload-complete', 'reload-drawer', 'remove-oidc', 'open-list', 'update-toolbar'],
  setup (props, { emit }) {
    const $q = useQuasar()
    const { addSchemaOptions, loadSchema, fetchJSON, sync, updateUser } = common()
    const state = reactive({
      auth: {},
      online: false,
      couchdb: '',
      pin: '',
      base: {},
      fhir: {},
      data: [],
      id: '',
      tab: '',
      template: '',
      tabReload: false,
      patient: '',
      encounter: '',
      provider: true,
      practitioner: '',
      user: {},
      resource: '',
      category: '',
      index: '',
      default: {},
      showForm: false,
      showList: false,
      showFile: false,
      sort: 'alpha',
      within_page: true,
      // forms
      formbase: {},
      schema: {},
      key: '',
      sub_schema: {},
      select: {},
      divContent: '',
      search: [],
      // immunizations
      actSites: {},
      // medicationStatement
      doseform: {},
      routes: {},
      routesArray: [],
      medication_request_doc: {},
      // contacts
      countries: [],
      states: [],
      cities: [],
      // patients
      language: [],
      // enounters
      serviceTypes: [],
      encounterTypes: [],
      // practitioners
      degrees: [],
      // document_references
      docTypeCodes: [],
      docClassCodes: [],
      // appointments
      serviceCategories: [],
      // observations
      activity: [],
      imaging: [],
      laboratory: [],
      procedure: [],
      survey: [],
      socialHistory: [],
      therapy: [],
      // care_plans and observations
      options: [],
      updateTabLock: false,
      careplan: false,
      careplanDoc: {},
      outcomeTypes: [],
      // compositions
      compositionDoc: {},
      // service_requests
      service_request_doc: {},
      oidc: []
    })
    const auth = useAuthStore()
    var prefix = ''
    if (auth.instance === 'digitalocean' && auth.type === 'pnosh') {
      prefix = auth.patient + '_'
    }
    var localDB = new PouchDB(prefix + props.resource)
    var conditionsDB = new PouchDB(prefix + 'conditions')
    onMounted(async() => {
      state.auth = props.auth
      state.online = props.online
      state.couchdb = props.couchdb
      state.pin = props.pin
      state.careplanDoc = props.care_plan_doc
      state.countries = props.countries
      state.states = props.states
      state.language = props.language
      state.id = props.id
      state.patient = props.patient
      state.provider = props.provider
      state.practitioner = props.practitioner
      state.user = props.user
      state.oidc = props.oidc
      state.base = await import('@/assets/fhir/' + props.resource + '.json')
      if (props.resource !== 'encounters' && props.resource !== 'service_requests' && props.resource !== 'observations') {
        var doc = await localDB.get(props.id)
        objectPath.set(state, 'fhir', doc)
        await fhirMap()
        if (typeof props.category !== 'undefined' && props.category == '') {
          state.tab = props.category
        } else {
          state.tab = state.base.tabs[0].category
        }
        updateTab(state.tab)
      } else {
        state.encounter = props.id
        if (typeof props.category !== 'undefined' && props.category !== '') {
          state.tab = props.category
        } else {
          state.tab = state.base.tabs[0].category
        }
        updateTab(state.tab)
      }
    })
    watch(() => props.reload, async(newVal) => {
      if (newVal) {
        var doc = await localDB.get(props.id)
        objectPath.set(state, 'fhir', doc)
        await fhirMap()
        emit('reload-complete')
      }
    })
    watch(() => props.sort, (newVal) => {
      if (newVal) {
        state.sort = newVal
      }
    })
    watch(() => props.openPageForm, (newVal) => {
      var category = state.category
      if (state.resource == 'compositions') {
        category = 'all'
      }
      if (newVal) {
        if (state.template == 'card') {
          openForm(state.id, state.resource, category, 'add')
        } else {
          openForm('add', state.resource, category)
        }
        emit('open-page-form-complete')
      }
    })
    const closeAll = () => {
      if (props.resource !== 'service_requests' && props.resource !== 'observations') {
        state.id = props.id
      }
      state.showForm = false
      state.showList = false
      state.showFile = false
      state.default = {}
      state.options = []
    }
    const closeForm = async(id = '', doc = {}) => {
      closeAll()
      if (state.careplan == true) {
        var defaults = {}
        state.careplan = false
        if (id !== '') {
          var doc = await conditionsDB.get(id)
          objectPath.set(defaults, 'contained', doc)
          objectPath.set(defaults, 'addresses', 'Condition/' + id)
          objectPath.set(defaults, 'conditionICD10', doc.code.coding[0].code)
          objectPath.set(defaults, 'conditionText', doc.code.coding[0].display)
          openForm('add', 'care_plans', 'all', '', defaults)
        }
      } else {
        if (state.resource == 'compositions') {
          if (id !== '') {
            if (state.user.reference === doc.author[0].reference) {
              const encounterDB = new PouchDB(prefix + 'encounters')
              var encounter = await encounterDB.get(doc.encounter.reference.split('/').slice(-1).join(''))
              var unsigned = {
                name: encounter.reasonCode[0].text,
                url: location.protocol + '//' + location.host + location.pathname + '?encounter=' + encounter.id,
                id: encounter.id,
                date: moment().unix()
              }
              state.user = await updateUser(state.user, 'unsigned', unsigned, state.online, state.couchdb, state.auth)
            }
          }
        }
        if (state.resource == 'observations') {
          // BMI calc
          if (id !== '') {
            if (doc.code.coding[0].code === '29463-7' || doc.code.coding[0].code === '8302-2') {
              const checkDB = new PouchDB(prefix + state.resource)
              var weight = 0
              var height = 0
              if (doc.code.coding[0].code === '29463-7') {
                if (doc.valueQuantity.unit === 'lbs') {
                  weight = convert(parseFloat(doc.valueQuantity.value), 'lb').to('kg')
                } else {
                  weight = parseFloat(doc.valueQuantity.value)
                }
                var check = await checkDB.find({
                  selector: {'encounter.reference': {$eq: 'Encounter/' + props.encounter}, 'code.coding.0.code': {$eq: '8302-2'}, _id: {"$gte": null}}
                })
                if (check.docs.length > 0) {
                  if (check.docs[0].valueQuantity.unit === 'inch') {
                    height = convert(parseFloat(check.docs[0].valueQuantity.value), 'in').to('cm')
                  } else {
                    height = parseFloat(check.docs[0].valueQuantity.value)
                  }
                }
              } else {
                if (doc.valueQuantity.unit === 'inch') {
                  height = convert(parseFloat(doc.valueQuantity.value), 'in').to('cm')
                } else {
                  height = parseFloat(doc.valueQuantity.value)
                }
                var check = await checkDB.find({
                  selector: {'encounter.reference': {$eq:  'Encounter/' + props.encounter}, 'code.coding.0.code': {$eq: '29463-7'}, _id: {"$gte": null}}
                })
                if (check.docs.length > 0) {
                  if (check.docs[0].valueQuantity.unit === 'lbs') {
                    weight = convert(parseFloat(check.docs[0].valueQuantity.value), 'lb').to('kg')
                  } else {
                    weight = parseFloat(check.docs[0].valueQuantity.value)
                  }
                }
              }
              if (weight !== 0 && height !== 0) {
                var bmi = (weight / Math.pow( (height/100), 2 )).toFixed(1)
                var check1 = await checkDB.find({
                  selector: {'encounter.reference': {$eq: 'Encounter/' + props.encounter}, 'code.coding.0.code': {$eq: '39156-5'}, _id: {"$gte": null}}
                })
                if (check1.docs.length > 0) {
                  var bmi_doc = check1.docs[0]
                } else {
                  var bmi_id = 'nosh_' + uuidv4()
                  var observation_base = await import('@/assets/fhir/observations.json')
                  var bmi_doc = JSON.parse(JSON.stringify(observation_base.fhir))
                  objectPath.set(bmi_doc, 'id', bmi_id)
                  objectPath.set(bmi_doc, '_id', bmi_id)
                  objectPath.set(bmi_doc, 'subject.reference', 'Patient/' + props.patient)
                  objectPath.set(bmi_doc, 'encounter.reference', 'Encounter/' + props.encounter)
                  objectPath.set(bmi_doc, 'performer.0.reference', props.user.reference)
                  objectPath.set(bmi_doc, 'status', 'preliminary')
                  objectPath.set(bmi_doc, 'category.0.coding.0.code', 'vital-signs')
                  objectPath.set(bmi_doc, 'category.0.coding.0.display', 'Vital Signs')
                  objectPath.set(bmi_doc, 'category.0.text', 'Vital Signs')
                  objectPath.set(bmi_doc, 'effectivePeriod.start', moment().format('YYYY-MM-DD HH:mm'))
                  objectPath.set(bmi_doc, 'text.status', 'generated')
                  objectPath.set(bmi_doc, 'text.div', '<div xmlns=\"http://www.w3.org/1999/xhtml\">Body Mass Index, ' + bmi + ' /min [Vital Signs] (Date of Service: ' + objectPath.get(bmi_doc, 'effectivePeriod.start') + ')</div>')
                  objectPath.set(bmi_doc, 'code.coding.0.code', '39156-5')
                  objectPath.set(bmi_doc, 'code.coding.0.display', 'Body Mass Index')
                  objectPath.set(bmi_doc, 'code.coding.0.system', 'http://loinc.org')
                  objectPath.set(bmi_doc, 'valueQuantity.code','kg/m2')
                  objectPath.set(bmi_doc, 'valueQuantity.unit', 'kg/m2')
                  objectPath.set(bmi_doc, 'interpretation.0.coding.system', 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation')
                }
                objectPath.set(bmi_doc, 'valueQuantity.value', bmi)
                if (bmi < 18.5) {
                  objectPath.set(bmi_doc, 'interpretation.0.coding.0.status', 'L')
                  objectPath.set(bmi_doc, 'interpretation.0.coding.0.display', 'Low')
                }
                if (bmi >= 18.5 && bmi <= 24.9) {
                  objectPath.set(bmi_doc, 'interpretation.0.coding.0.status', 'N')
                  objectPath.set(bmi_doc, 'interpretation.0.coding.0.display', 'Normal')
                }
                if (bmi >= 25 && bmi <= 29.9) {
                  objectPath.set(bmi_doc, 'interpretation.0.coding.0.status', 'H')
                  objectPath.set(bmi_doc, 'interpretation.0.coding.0.display', 'High')
                }
                if (bmi >= 30) {
                  objectPath.set(bmi_doc, 'interpretation.0.coding.0.status', 'HU')
                  objectPath.set(bmi_doc, 'interpretation.0.coding.0.display', 'Significantly High')
                }
                await sync(state.resource, false, props.patient, true, bmi_doc)
                $q.notify({
                  message: 'BMI calculated and saved!',
                  color: 'primary',
                  actions: [
                    { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
                  ]
                })
              }
            }
          }
        }
        if (state.resource == 'service_requests') {
          // create task
          if (id !== '') {
            const taskDB = new PouchDB(prefix + 'tasks')
            var task = await taskDB.find({
              selector: {'basedOn.0.reference': {$eq: 'ServiceRequest/' + id}, _id: {"$gte": null}}
            })
            if (task.docs.length === 0) {
              var task_id = 'nosh_' + uuidv4()
              var task_doc = JSON.parse(JSON.stringify(state.formbase.fhir))
              objectPath.set(task_doc, '_id', task_id)
              objectPath.set(task_doc, 'id', task_id)
              objectPath.set(task_doc, 'basedOn.0.reference', 'ServiceRequest/' + id)
              objectPath.set(task_doc, 'status', 'requested')
              objectPath.set(task_doc, 'priority', doc.priority)
              objectPath.set(task_doc, 'for.reference', 'Patient/' + props.patient)
              objectPath.set(task_doc, 'owner.reference', props.user.reference)
              objectPath.set(task_doc, 'description', 'requested')
              objectPath.set(task_doc, 'authoredOn', moment().format('YYYY-MM-DD HH:mm'))
              objectPath.set(task_doc, 'lastModified', moment().format('YYYY-MM-DD HH:mm'))
              await sync(state.resource, false, props.patient, true, task_doc)
              $q.notify({
                message: 'Task created.',
                color: 'primary',
                actions: [
                  { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
                ]
              })
            }
          }
        }
        updateTab(state.tab)
        if (state.template == 'mixed' || state.template == 'list') {
          state.tabReload = true
        } else {
          var doc = await localDB.get(props.id)
          objectPath.set(state, 'fhir', doc)
          await fhirMap()
          state.tabReload = true
        }
      }
    }
    const closeList = () => {
      state.showList = false
    }
    const fhirMap = async() => {
      state.data = []
      if (props.resource !== 'encounters') {
        for (var a in state.base.tabs) {
          var category = state.base.tabs[a].category
          var resource_obj = await loadSchema(props.resource, category, state.base[category].uiSchema, props.online, [])
          state.base[category].uiSchema = resource_obj.schema
          if (!objectPath.has(state, 'data.' + category)) {
            objectPath.set(state, 'data.' + category, [])
          }
          if (state.base.tabs[a].template == 'table') {
            if (!objectPath.has(state, 'data.' + category + '.columns')) {
              objectPath.set(state, 'data.' + category + '.columns', state.base.tabs[a].columns)
            }
            if (!objectPath.has(state, 'data.' + category + '.rows')) {
              objectPath.set(state, 'data.' + category + '.rows', [])
            }
          }
          if (state.base.tabs[a].template == 'table' || state.base.tabs[a].template == 'card') {
            objectPath.set(state, 'data.' + category + '.category', category)
            objectPath.set(state, 'data.' + category + '.resource', props.resource)
            objectPath.set(state, 'data.' + category + '.resourceName', state.base.resourceName)
            objectPath.set(state, 'data.' + category + '.id', state.id)
          }
          var uiSchema = state.base[category].uiSchema.flat()
          for (var b in uiSchema) {
            var model = uiSchema[b].model
            if (typeof uiSchema[b].modelRoot !== 'undefined') {
              if (uiSchema[b].modelArray == false) {
                model = uiSchema[b].modelRoot + '.' + uiSchema[b].model
              } else {
                if (uiSchema[b].multiple == true) {
                  model = uiSchema[b].modelRoot
                } else {
                  model = uiSchema[b].modelRoot + '.0.' + uiSchema[b].model
                }
              }
            }
            var obj = {}
            if (typeof uiSchema[b].modelRoot !== 'undefined' && uiSchema[b].modelArray !== false) {
              if (objectPath.has(state, 'fhir.' + uiSchema[b].modelRoot)) {
                var c = objectPath.get(state, 'fhir.' + uiSchema[b].modelRoot)
                obj['key'] = uiSchema[b].label
                obj['value'] = ''
                for (var d in c) {
                  if (objectPath.has(state, 'fhir.' + uiSchema[b].modelRoot + '.' + d + '.' + uiSchema[b].display)) {
                    if (d > 0) {
                      obj['value'] += '<br/>'
                    }
                    obj['value'] += objectPath.get(state, 'fhir.' + uiSchema[b].modelRoot + '.' + d + '.' + uiSchema[b].display)
                    state.data[uiSchema[b].category].push(obj)
                    // if (!objectPath.has(state, 'data.' + uiSchema[b].category + '.rows.' + d)) {
                    //   var e = objectPath.get(state, 'fhir.' + uiSchema[b].modelRoot + '.' + d)
                    //   e.id = d
                    //   objectPath.set(state, 'data.' + uiSchema[b].category + '.rows.' + d, e)
                    // }
                  } else {
                    obj['value'] = objectPath.get(state, 'fhir.' + uiSchema[b].modelRoot + '.' + d + '.' + uiSchema[b].model)
                    state.data[uiSchema[b].category].push(obj)
                  }
                }
              }
            } else {
              obj['key'] = uiSchema[b].label
              obj['value'] = objectPath.get(state, 'fhir.' + model)
              if (typeof uiSchema[b].modelOne !== 'undefined') {
                if (objectPath.has(state, 'fhir.' + model + '.' + uiSchema[b].modelOne + '.' + uiSchema[b].modelEnd)) {
                  obj['value'] = objectPath.get(state, 'fhir.' + model + '.' + uiSchema[b].modelOne + '.' + uiSchema[b].modelEnd)
                }
                if (objectPath.has(state, 'fhir.' + model + '.' + uiSchema[b].modelRange[0] + '.' + uiSchema[b].modelEnd)) {
                  obj['value'] = objectPath.get(state, 'fhir.' + model + '.' + uiSchema[b].modelRange[0] + '.' + uiSchema[b].modelEnd)
                  obj['value'] += ' to '
                  obj['value'] += objectPath.get(state, 'fhir.' + model + '.' + uiSchema[b].modelRange[1] + '.' + uiSchema[b].modelEnd)
                }
              }
              if (typeof uiSchema[b].modelChoice !== 'undefined') {
                for (var f in uiSchema[b].modelChoice) {
                  if (objectPath.has(state, 'fhir.' + model + '.' + uiSchema[b].modelChoice[f] + '.' + uiSchema[b].modelEnd)) {
                    obj['value'] = objectPath.get(state, 'fhir.' + model + '.' + uiSchema[b].modelChoice[f] + '.' + uiSchema[b].modelEnd)
                  }
                }
              }
              if (typeof uiSchema[b].text !== 'undefined') {
                if (objectPath.has(state, 'fhir.' + model + '.' + uiSchema[b].text)) {
                  obj['value'] = objectPath.get(state, 'fhir.' + model + '.' + uiSchema[b].text)
                }
              }
              if (obj['value'] !== undefined && obj['value'] !== null) {
                if (typeof uiSchema[b].options !== 'undefined') {
                  if (uiSchema[b].multiple === true) {
                    var value = ''
                    for (var g in obj['value']) {
                      var h = uiSchema[b].options.find(({ value }) => value === obj['value'][c][uiSchema[b].model])
                      if (g !== '0') {
                        value += '; '
                      }
                      value += h.label
                    }
                    obj['value'] = value
                  } else {
                    var i = uiSchema[b].options.find(({ value }) => value === obj['value'])
                    obj['value'] = i.label
                  }
                }
                state.data[uiSchema[b].category].push(obj)
              }
            }
          }
        }
      }
    }
    const loading = () => {
      emit('loading')
    }
    const loadResource = async(resource, category) => {
      emit('loading')
      state.formbase = await import('@/assets/fhir/' + resource + '.json')
      if (category === 'all') {
        state.schema = state.formbase.uiSchema
        state.divContent = state.formbase.divContent
        state.search = state.formbase.uiSearchBars
      } else {
        if (resource === 'observations' || resource === 'service_requests') {
          if (category == 'objective') {
            category = 'vital-signs'
          }
          var sub = state.formbase.categories.find(o => o.value === category)
          state.options = state.formbase.categories
          state.schema = sub.uiSchema
          state.divContent = sub.divContent
          state.search = sub.uiSearchBars
        } else {
          state.schema = state.formbase[category].uiSchema
          state.divContent = state.formbase[category].divContent
          state.search = state.formbase[category].uiSearchBars
        }
      }
      var resource_obj = await loadSchema(resource, category, state.schema, state.online, state.options)
      state.schema = resource_obj.schema
      state.options = resource_obj.options
      state.states = resource_obj.states
      state.countries = resource_obj.countries
      state.select = resource_obj.select
      emit('loading')
    }
    const lockThread = (id) => {
      emit('lock-thread', id)
    }
    const newPrescription = () => {
      emit('new-prescription')
    }
    const onFormOpen = (id, category = 'all', index = '') => {
      emit('open-form', id, props.resource, category, index)
    }
    const openForm = async(id, resource, category = 'all', index = '', defaults = {}, careplan = false, doc = {}, medication_request_div = '') => {
      closeAll()
      await nextTick()
      state.id = id
      state.resource = resource
      state.category = category
      state.index = index
      state.default = defaults
      if (category == 'all') {
        if (id == 'add') {
          updateToolbar({type: 'form', resource: state.resource, action: 'Add'})
        } else {
          updateToolbar({type: 'form', resource: state.resource, action: 'Edit'})
        }
      } else {
        if (id == 'add') {
          updateToolbar({type: 'form', resource: state.resource, category: state.category, action: 'Add'})
        } else {
          if (index == 'add') {
            updateToolbar({type: 'form', resource: state.resource, category: state.category, action: 'Add'})
          } else {
            updateToolbar({type: 'form', resource: state.resource, category: state.category, action: 'Edit'})
          }
        }
      }
      if (careplan == true) {
        state.careplan = true
      }
      if (objectPath.has(doc, 'resourceType')) {
        if (state.resource === 'medication_requests') {
          state.medication_request_doc = doc
        }
        if (state.resource === 'service_requests') {
          state.service_request_doc = doc
        }
      }
      await loadResource(resource, category)
      if (medication_request_div !== '') {
        state.divContent = medication_request_div + state.divContent
      }
      await nextTick()
      state.showForm = true
      if ($q.screen.lt.sm) {
        state.menuVisible = false
      }
    }
    const openGraph = (type, observation) => {
      emit('open-graph', type, observation)
    }
    const openList = async(resource) => {
      closeAll()
      await nextTick()
      state.resource = resource
      state.showList = true
      if ($q.screen.lt.sm) {
        state.menuVisible = false
      }
    }
    const reloadComplete = () => {
      state.tabReload = false
      state.showList = true
    }
    const reloadDrawer = (resource) => {
      emit('reload-drawer', resource)
    }
    const removeOIDC = (index, resource, origin) => {
      emit('remove-oidc', index, resource, origin)
    }
    const setActiveCarePlan = (doc) => {
      state.careplanDoc = doc
      emit('care-plan', doc)
    }
    const setActiveComposition = (doc) => {
      state.compositionDoc = doc
      emit('composition', doc)
    }
    const updateTab = async(val) => {
      if (state.updateTabLock == false) {
        state.updateTabLock = true
        closeAll()
        var sub = state.base.tabs.find(o => o.category === val)
        if (typeof sub.resource !== 'undefined') {
          if (sub.template !== 'graph') {
            state.resource = sub.resource
            state.category = val
            if (state.resource === 'compositions' || state.resource === 'care_plans') {
              await loadResource(state.resource, 'all')
            } else {
              await loadResource(state.resource, state.category)
            }
            if (sub.template === 'file') {
              state.docTypeCodes = await fetchJSON('docTypeCodes', state.online)
              state.docClassCodes = await fetchJSON('docClassCodes', state.online)
            }
            await nextTick()
            if (sub.template === 'form') {
              state.showForm = true
            } else if (sub.template === 'file') {
              state.showFile = true
            } else {
              state.showList = true
            }
            if ($q.screen.lt.sm) {
              state.menuVisible = false
            }
            state.template = sub.template
            if (sub.resource !== props.resource) {
              updateToolbar({type: sub.template, resource: props.resource, category: state.category, subresource: sub.resource})
            } else {
              updateToolbar({type: sub.template, resource: props.resource, category: state.category})
            }
            state.updateTabLock = false
          } else {
            updateToolbar({type: sub.template, resource: props.resource, category: state.category, subresource: sub.resource})
            state.updateTabLock = false
          }
        }
      }
    }
    const updateToolbar = (toolbar) => {
      emit('update-toolbar', toolbar)
    }
    return {
      addSchemaOptions,
      closeAll,
      closeForm,
      closeList,
      fetchJSON,
      fhirMap,
      loading,
      loadResource,
      loadSchema,
      lockThread,
      newPrescription,
      onFormOpen,
      openForm,
      openGraph,
      openList,
      reloadComplete,
      reloadDrawer,
      removeOIDC,
      setActiveCarePlan,
      setActiveComposition,
      sync,
      updateTab,
      updateToolbar,
      updateUser,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
