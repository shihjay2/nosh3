<template>
  <q-card v-if="state.showForm">
    <div class="text-h6 text-primary q-pa-sm" v-if="state.title !== ''">{{ state.title }}</div>
    <q-card-section v-if="state.search.length > 0">
      <div v-for="searchbar in state.search" class="q-pa-sm" :key="searchbar.bar">
        <QSearch
          :search="searchbar.bar"
          :label="searchbar.label"
          :code="searchbar.code"
          :text="searchbar.text"
          :name="searchbar.name"
          :rxcui="searchbar.rxcui"
          :dose-unit="searchbar.doseUnit"
          :route="searchbar.route"
          :target-disease="searchbar.targetDisease"
          :target-disease-text="searchbar.targetDiseaseText"
          :routes-array="state.routesArray"
          :resource="state.resource"
          @copy-selected="copySelected"
          :online="state.online"
          ref="mySearchInput"
          focus="false"
        />
      </div>
    </q-card-section>
    <q-separator />
    <Form @submit="saveForm">
      <q-card-section>
        <div v-for="field in state.schema" :key="field.id" class="q-pa-sm">
          <div v-if="Array.isArray(field)" class="q-gutter-sm row">
            <div v-for="field1 in field" :key="field1.id" class="col" style="max-width: 300px">
              <QInputWithValidation
                v-if="showForm(field1.hidden,field1.category)"
                ref="myInput"
                :name="field1.id"
                :label="field1.label"
                :type="field1.type"
                :model="state.form[field1.id]"
                @update-model="updateValue"
                :options="field1.options"
                :multiple="field1.multiple"
                :readonly="field1.readonly"
                :mask="field1.mask"
                :rules="field1.rules"
                :placeholder="field1.placeholder"
                :catch="state.catch"
                :template="state.templateSelected"
                focus="false"
                @update-template="updateTemplate"
              />
            </div>
          </div>
          <div v-else class="q-gutter-sm">
            <QInputWithValidation
              v-if="showForm(field.hidden,field.category)"
              ref="myInput"
              :name="field.id"
              :label="field.label"
              :type="field.type"
              :model="state.form[field.id]"
              @update-model="updateValue"
              :options="field.options"
              :multiple="field.multiple"
              :readonly="field.readonly"
              :mask="field.mask"
              :rules="field.rules"
              :placeholder="field.placeholder"
              :catch="state.catch"
              :template="state.templateSelected"
              focus="false"
              @update-template="updateTemplate"
            />
          </div>
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <div class="q-pa-sm q-gutter-sm">
          <q-circular-progress v-if="state.sending" indeterminate size="2em" color="light-blue" class="q-ma-md" />
          <q-btn push icon="visibility" color="primary" @click="showFHIR" label="FHIR" />
          <q-btn v-if="state.details" push icon="details" color="secondary" :label="state.detailsLabel" @click="onDetails" />
          <q-btn push icon="cancel" color="negative" @click="onCancel" label="Cancel" />
          <q-btn push icon="save" color="positive" label="Save" type="submit" />
        </div>
      </q-card-actions>
    </Form>
  </q-card>
  <q-dialog v-model="state.showPreview" persistent position="top" full-width full-height seamless>
    <q-card>
      <q-card-section>
        <textarea v-if="state.preview" id="fhirpreview" v-model="state.fhir1" rows="20" cols="80" class="bg-grey-9 text-white"></textarea>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <div class="q-pa-sm q-gutter-sm">
          <q-btn push icon="cancel" color="red" @click="closeFHIR" label="Close" />
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
  <q-dialog v-model="state.dialogTemplate" persistent>
    <QTemplate
      v-if="state.dialogTemplate"
      @select-template="selectTemplate"
      @close-template="closeTemplate"
      :template="state.template"
      :user="state.user"
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
</template>

<script>
import { ref, defineComponent, nextTick, onMounted, reactive } from 'vue'
import { common } from '@/logic/common'
import axios from 'axios'
import Case from 'case'
import { Form } from 'vee-validate'
import jsum from 'jsum'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb-browser'
import QInputWithValidation from './QInputWithValidation.vue'
import QSearch from './QSearch.vue'
import QTemplate from './QTemplate.vue'
import QVaccine from './QVaccine.vue'
import { SSX, SiweMessage } from '@spruceid/ssx'
import { useQuasar } from 'quasar'
import {v4 as uuidv4} from 'uuid'

export default defineComponent({
  name: 'QFormTemplate',
  components: {
    Form,
    QInputWithValidation,
    QSearch,
    QTemplate,
    QVaccine
  },
  props: {
    auth: Object,
    online: Boolean,
    couchdb: String,
    pin: String,
    id: String,
    patient: String,
    provider: {
      type: Boolean,
      default: false
    },
    practitioner: {
      type: String,
      default: ''
    },
    user: {
      type: Object,
      default: function () { return {}}
    },
    encounter: {
      type: String,
      default: ''
    },
    resource: String,
    category: {
      type: String,
      default: 'all'
    },
    index: {
      type: String,
      default: ''
    },
    default: {
      type: Object,
      default: function () { return {}}
    },
    base: Object,
    schema: Object,
    keys: {
      type: String,
      default: ''
    },
    sub_schema: {
      type: Object,
      default: function () { return {}}
    },
    select: {
      type: Object,
      default: function () { return {}}
    },
    div_content: {
      type: String,
      default: ''
    },
    search: {
      type: Array,
      default: function () { return []}
    },
    care_plan_doc: {
      type: Object,
      default: function () { return {}}
    },
    composition_doc: {
      type: Object,
      default: function () { return {}}
    },
    preview: {
      type: Boolean,
      default: true
    },
    title: {
      type: String,
      default: ''
    },
    medication_request_doc: {
      type: Object,
      default: function () { return {}}
    },
    service_request_doc: {
      type: Object,
      default: function () { return {}}
    },
    default_med_category: {
      type: String,
      default: ''
    },
    states: {
      type: Array,
      default: function () { return []}
    },
    doc: {
      type: Object,
      default: function () { return {}}
    }
  },
  emits: ['care-plan', 'clear-default', 'composition', 'close-form', 'loading', 'reload-drawer', 'set-composition-section'],
  setup (props, { emit }) {
    const $q = useQuasar()
    const { addSchemaOptions, bundleBuild, fetchTXT, getPrefix, removeTags, sync, syncEmailToUser } = common()
    const myInput = ref(null)
    const mySearchInput = ref(null)
    const state = reactive({
      showForm: false,
      resource: '',
      base: {},
      fhir: {},
      fhir1: '',
      preview: true,
      form: {},
      schema: {},
      key: '',
      subSchema: {},
      resourceName: {},
      defaultDate: {},
      index: '',
      fhirProcess: false,
      formSaved: false,
      sending: false,
      submitted: false,
      success: false,
      details: false,
      detailsLabel: '',
      dialogVisible: false,
      divContent: {},
      divMap: true,
      search: [],
      title: '',
      user: {},
      showPreview: false,
      // Templates
      template: {text: '', target: ''},
      templateTarget: null,
      templateProcess: false,
      templateSelected: false,
      // search ICD10
      icd10: [],
      searchICD10: false,
      selectedICD10: null,
      // search Body Site
      bodySite: [],
      searchBodySite: false,
      selectedBodySite: null,
      // search Medication
      searchMedication: false,
      selectedMedication: null,
      // search Vaccine
      searchVaccine: false,
      selectedVaccine: null,
      dialogVaccine: false,
      vaccine: {},
      // template
      dialogTemplate: false,
      selectedTemplate: {},
      catch: false,
      // dosage
      dialogDosage: false,
      // medicationStatement
      rxinfo: {},
      routesArray: [],
      // immunizations
      actSites: {},
      cvx: [],
      cvx_vis: [],
      vis_barcode_lookup: [],
      vis_url: [],
      targetDiseases: {},
      // encounters
      encounterTypes: [],
      online: false
    })
    var prefix = getPrefix()
    var localDB = new PouchDB(prefix + props.resource)
    var localDB1 = new PouchDB(prefix + 'care_plans')
    onMounted(async() => {
      emit('loading')
      state.resource = props.resource
      state.base = props.base
      state.schema = props.schema
      state.index = props.index
      state.key = props.keys
      state.subSchema = props.sub_schema
      state.search = props.search
      state.preview = props.preview
      state.title = props.title
      state.online = props.online
      state.user = props.user
      if (props.category === 'all') {
        state.resourceName = state.base.resourceName
        state.defaultDate = state.base.defaultDate
      } else {
        if (props.resource === 'observations' || props.resource === 'service_requests') {
          const sub = state.base.categories.find(o => o.value === props.category)
          state.resourceName = sub.resourceName
          state.defaultDate = sub.defaultDate
        } else {
          state.resourceName = state.base[props.category].resourceName
          state.defaultDate = state.base[props.category].defaultDate
        }
      }
      // if (props.resource === 'document_references') {
      //   state.preview = false
      // }
      if (props.resource === 'medication_statements') {
        state.routesArray = objectPath.get(state, 'schema.1.2.options')
      }
      if (props.resource === 'immunizations') {
        state.cvx = await fetchTXT('cvx', props.online)
        state.cvx_vis = await fetchTXT('cvx_vis', props.online)
        state.vis_barcode_lookup = await fetchTXT('vis_barcode_lookup', props.online)
        state.vis_url = await fetchTXT('vis_url', props.online)
      }
      // divMap
      if (props.resource === 'patients' || props.resource === 'practitioners' || props.resource === 'related_persons') {
        if (props.category !== 'identity' && props.category !== 'new') {
          state.divMap = false
        }
      }
      if (props.resource === 'compositions') {
        state.divMap = false
      }
      // load form
      clearForm()
      if (props.id == 'add') {
        state.fhir.id = 'nosh_' + uuidv4()
        state.fhir._id = state.fhir.id
        // default patient
        if (props.resource === 'immunizations' ||
            props.resource === 'allergy_intolerances' ||
            props.resource === 'related_persons') {
          state.fhir.patient.reference = 'Patient/' + props.patient
        } else if (props.resource === 'tasks') {
          state.fhir.for.reference = 'Patient/' + props.patient
        } else {
          if (props.resource !== 'practitioners' &&
              props.resource !== 'organizations' &&
              props.resource !== 'appointments' &&
              props.resource !== 'users' &&
              props.resource !== 'patients') {
            state.fhir.subject.reference = 'Patient/' + props.patient
          }
        }
        // default encounter
        if (props.resource === 'observations' ||
            props.resource === 'care_plans' ||
            props.resource === 'clinical_impressions' ||
            props.resource === 'medication_requests'||
            props.resource === 'service_requests' ||
            props.resource === 'immunizations' ||
            props.resource === 'conditions' ||
            props.resource === 'compositions') {
          if (props.encounter !== '') {
            objectPath.set(state, 'fhir.encounter.reference', 'Encounter/' + props.encounter)
          }
        }
        // default author
        if (props.resource === 'compositions' ||
            props.resource === 'document_references' ||
            props.resource === 'care_plans') {
          if (props.provider) {
            state.fhir.author[0].reference = props.user.reference
            state.fhir.author[0].display = props.user.display
            state.form.author = props.user.reference
          }
        }
        if (props.resource === 'conditions' ||
            props.resource === 'allergy_intolerances') {
          objectPath.set(state, 'fhir.recorder.reference', props.user.reference)
          objectPath.set(state, 'fhir.asserter.reference', props.user.reference)
        }
        if (props.resource === 'medication_statements') {
          objectPath.set(state, 'fhir.informationSource.reference', props.user.reference)
          if (props.default_med_category !== '') {
            objectPath.set(state, 'fhir.category.coding.0.code', props.default_med_category)
            objectPath.set(state, 'fhir.category.coding.0.display', Case.title(props.default_med_category))
            objectPath.set(state, 'form.category', props.default_med_category)
          }
        }
        if (props.resource === 'observations') {
          if (props.provider) {
            objectPath.set(state, 'fhir.performer.0.reference', props.user.reference)
            objectPath.set(state, 'form.performer', props.user.reference)
          }
        }
        if (props.resource === 'medication_requests') {
          if (props.provider) {
            objectPath.set(state, 'fhir.requester.reference', 'Practitioner/' + props.user.id)
          }
          if (props.default_med_category !== '') {
            objectPath.set(state, 'fhir.category.coding.0.code', props.default_med_category)
            objectPath.set(state, 'fhir.category.coding.0.display', Case.title(props.default_med_category))
            objectPath.set(state, 'form.category', props.default_med_category)
          }
        }
        if (props.resource === 'service_requests') {
          if (props.provider) {
            objectPath.set(state, 'fhir.requester.0.reference', props.user.reference)
            objectPath.set(state, 'form.requester', props.user.reference)
          }
        }
        if (props.resource === 'encounters') {
          if (props.provider) {
            objectPath.set(state, 'fhir.participant.0.individual.reference', props.user.reference)
            objectPath.set(state, 'form.participant', [props.user.reference])
          }
        }
        if (props.resource === 'appointments') {
          if (props.provider) {
            objectPath.set(state, 'fhir.participant.1.actor', props.user.reference)
            objectPath.set(state, 'form.practitioner', props.user.reference)
          }
        }
        // default status
        state.form.status = 'active'
        if (props.resource === 'immunizations') {
          state.form.status = 'completed'
        }
        if (props.resource === 'document_references') {
          state.form.status = 'current'
        }
        if (props.resource === 'appointments') {
          state.form.status = 'booked'
        }
        if (props.resource === 'compositions' || props.resource === 'observations') {
          state.form.status = 'preliminary'
        }
        if (props.resource === 'practitioners' ||
            props.resource === 'related_persons') {
          state.form.active = true
        }
        if (props.resource === 'encounters') {
          state.form.status = 'in-progress',
          state.form.priority = 'R'
        }
        if (props.resource === 'tasks') {
          state.form.status = 'requested'
        }
        state.form.tags = []
        // default verifications
        if (props.resource === 'conditions' || props.resource === 'allergy_intolerances') {
          state.fhir.verificationStatus.coding[0].code = 'unconfirmed'
          if (props.provider) {
            state.fhir.verificationStatus.coding[0].code = 'confirmed'
          }
        }
        // default dates
        if (typeof state.defaultDate !== 'undefined') {
          for (const c in state.defaultDate) {
            state.form[state.defaultDate[c].id] = moment().format(state.defaultDate[c].format)
          }
        }
        // default category
        if (props.resource === 'observations') {
          state.fhir.category[0].coding[0].code = props.category
          state.fhir.category[0].coding[0].display = Case.title(props.category)
          state.fhir.category[0].text = Case.title(props.category)
        }
        // default confidentiality
        if (props.resource === 'compositions') {
          state.form.confidentiality = 'N'
          state.fhir.confidentiality = 'N'
        }
        // default order
        if (props.resource === 'service_requests') {
          state.form.intent = 'order'
          state.fhir.intent = 'order'
        }
        // load default object
        if (JSON.stringify(props.default) !== '{}') {
          Object.entries(props.default).forEach(entry => {
            objectPath.set(state, 'form.' + entry[0], entry[1])
          })
        }
        fhirMap()
        state.fhir1 = JSON.stringify(state.fhir, null, "  ")
      } else {
        let doc = {}
        if (objectPath.has(props, 'doc._id')) {
          doc = props.doc
        } else {
          // await sync(props.resource, props.online, props.patient, false)
          doc = await localDB.get(props.id)
        }
        objectPath.set(state, 'fhir', doc)
        state.fhir1 = JSON.stringify(state.fhir, null, "  ")
        if (state.index == 'add') {
          state.index = getIndex()
          if (props.resource === 'compositions') {
            objectPath.set(state, 'fhir.section.' + state.index + '.author.0.reference', props.user.reference)
            objectPath.set(state, 'form.section_author', props.user.reference)
          }
        } else {
          getForm(state.index)
        }
        // load default object
        if (JSON.stringify(props.default) !== '{}') {
          Object.entries(props.default).forEach(entry => {
            objectPath.set(state, 'form.' + entry[0], entry[1])
          })
          emit('clear-default')
        }
      }
      // search bars
      for (const i in state.search) {
        const j = state.search[i].bar
        state[j] = true
      }
      state.showForm = true
      nextTick(() => {
        if (state.search.length > 0 && props.id == 'add') {
          mySearchInput.value[0]._.props.focus = true
        } else {
          const k = myInput.value.find(l => l._.props.readonly !== true)
          k._.props.focus = true
        }
      })
      emit('loading')
      window.scrollTo({top: 0, behavior: 'smooth'})
    })
    const catchTemplate = (id, type)  => {
      const str = state.form[id]
      if (state.catch !== true) {
        if(/\.+$/.test(str)) {
          state.catch = true
          fhirMap()
        } else {
          fhirMap()
        }
      } else {
        if(/(\s|&nbsp;)+$/.test(str)) {
          state.catch = false
          const sub = str.split('.').pop().split(' ')[0]
          if (sub !== str) {
            if (sub !== '') {
              state.template.text = sub
              state.template.target = id
              state.template.type = type
              state.dialogTemplate = true
              state.dialogVisible = true
            } else {
              fhirMap()
            }
          } else {
            fhirMap()
          }
        }
      }
    }
    const clearForm = () => {
      state.fhir = state.base.fhir
      if (props.resource == 'medication_requests' && props.id == 'add') {
        state.fhir = props.medication_request_doc
      }
      if (props.resource == 'service_requests' && props.id == 'add') {
        const sub = state.base.categories.find(o => o.value === props.category)
        state.fhir = sub.doc
      }
      state.form = {}
    }
    const closeFHIR = () => {
      state.showPreview = false
    }
    const closeTemplate = () => {
      state.dialogTemplate = false
      state.dialogVisible = false
    }
    const closeVaccine = () => {
      state.dialogVaccine = false
      state.vaccine = {}
    }
    const copySelected = (data, search) => {
      if (data !== null) {
        const a = state.search.find(({ bar }) => bar === search)
        if (a) {
          for (const [key, value] of Object.entries(a)) {
            if (key !== "bar" && key !== "label") {
              if (data.value[key] !== undefined) {
                const b = data.value[key]
                if (typeof data.value[key] == 'string') {
                  String(b.trim())
                }
                objectPath.set(state, 'form.' + [value], b)
              }
            }
          }
        }
        if (search == "searchVaccine") {
          if (data.value.text.includes('oral') || data.value.text.includes('rotavirus')) {
            objectPath.set(state, 'form.route', "PO")
            objectPath.set(state, 'form.doseUnit', "mg")
          } else {
            objectPath.set(state, 'form.route', "IM")
            objectPath.set(state, 'form.doseUnit', "ml")
          }
        }
        fhirMap()
      }
    }
    const divMap = () => {
      if (state.divMap == true) {
        let value = '<div xmlns="http://www.w3.org/1999/xhtml">'
        const uiSchema = state.schema.flat()
        let str = props.div_content
        const found = []
        let rxp = /{([^}]+)}/g
        let curMatch
        let replaceWith = []
        let mapping = {}
        let field = {}
        while((curMatch = rxp.exec(str))) {
          found.push(curMatch[1])
        }
        for (const a in found) {
          field = uiSchema.find(({ id }) => id === found[a])
          if (field !== undefined) {
            if (objectPath.has(state, 'form.' + field.id)) {
              replaceWith[a] = objectPath.get(state, 'form.' + field.id)
              if (typeof field.display !== 'undefined' && typeof field.options !== 'undefined') {
                const b = field.options.find(({ value }) => value === replaceWith[a])
                replaceWith[a] = b.label
              }
            } else {
              replaceWith[a] = ''
            }
          } else {
            replaceWith[a] = ''
          }
        }
        found.forEach((e,i) => mapping[`{${e}}`] = replaceWith[i])
        str = str.replace(/\{\w+\}/ig, n => mapping[n])
        value += str
        if (props.resource === 'compositions' && props.category === 'section') {
          if (objectPath.has(state, 'fhir.section')) {
            let c = ''
            for (const d in objectPath.get(state, 'fhir.section')) {
              c += '<p><b>Title</b>: ' + objectPath.get(state, 'fhir.section.' + d + '.title') + '</p>'
              c += '<p><b>Text</b>: ' + objectPath.get(state, 'fhir.section.' + d + '.text.div') + '</p>'
            }
            value += c
          }
        }
        value += '</div>'
        objectPath.set(state, 'fhir.text.status', 'generated')
        objectPath.set(state, 'fhir.text.div', value)
      }
    }
    const fhirMap = () => {
      if (!state.fhirProcess) {
        for (const i in state.schema) {
          if (Array.isArray(state.schema[i])) {
            for (const j in state.schema[i]) {
              fhirMapItem(state.schema[i][j])
            }
          } else {
            fhirMapItem(state.schema[i])
          }
        }
      }
      divMap()
      state.fhir1 = JSON.stringify(state.fhir, null, "  ")
      if (props.resource == 'immunizations') {
        if (state.form.protocol) {
          state.details = true
          state.detailsLabel = 'Vaccine Details'
        }
      }
    }
    const fhirMapItem = (schema) => {
      const id = schema.id
      if (typeof state.form[id] !== 'undefined') {
        let modelRoot = ''
        if (typeof schema.modelParent !== 'undefined') {
          modelRoot = schema.modelParent + '.' + state.index + '.'
        }
        if (Array.isArray(state.form[id])) {
          if (id == 'protocol') {
            objectPath.set(state, 'fhir.' + modelRoot + schema.model, state.form[id])
          } else {
            if (typeof schema.modelRoot !== 'undefined') {
              modelRoot += schema.modelRoot
              objectPath.del(state, 'fhir.' + modelRoot)
              if (state.form[id].length !== 0) {
                for (const a in state.form[id]) {
                  if (Array.isArray(state.form[id][a])) {
                    for (const b in state.form[id][a]) {
                      objectPath.set(state, 'fhir.' + modelRoot + '.' + b + '.' + schema.model, state.form[id][a][b])
                      if (typeof schema.display !== 'undefined' && typeof schema.options !== 'undefined') {
                        const c = schema.options.find(({ value }) => value === value)
                        objectPath.set(state, 'fhir.' + modelRoot + '.' + b + '.' + schema.display, c.label)
                      }
                      if (typeof schema.system !== 'undefined') {
                        objectPath.set(state, 'fhir.' + modelRoot + '.' + b + '.' + schema.system.model, schema.system.value)
                      }
                    }
                  } else if (schema.model !== '') {
                    objectPath.set(state, 'fhir.' + modelRoot + '.' + a + '.' + schema.model, state.form[id][a])
                    if (typeof schema.display !== 'undefined' && typeof schema.options !== 'undefined') {
                      const d = schema.options.find(({ value }) => value === state.form[id][a])
                      objectPath.set(state, 'fhir.' + modelRoot + '.' + a + '.' + schema.display, d.label)
                    }
                    if (typeof schema.system !== 'undefined') {
                      objectPath.set(state, 'fhir.' + modelRoot + '.' + a + '.' + schema.system.model, schema.system.value)
                    }
                  }
                }
              }
            } else {
              modelRoot += schema.model
              objectPath.del(state, 'fhir.' + modelRoot)
              objectPath.set(state, 'fhir.' + modelRoot, state.form[id])
            }
          }
        } else {
          const val = state.form[id]
          let modelRoot1 = modelRoot
          if (typeof schema.modelRoot !== 'undefined') {
            if (schema.modelArray == false) {
              modelRoot += schema.modelRoot + '.' + schema.model
              modelRoot1 += schema.modelRoot
            } else {
              modelRoot += schema.modelRoot + '.0.' + schema.model
              modelRoot1 += schema.modelRoot + '.0'
            }
          } else {
            modelRoot += schema.model
            if (modelRoot1[modelRoot1.length - 1] === '.') {
              modelRoot1 = modelRoot1.slice(0, -1)
            }
          }
          if (val !== '') {
            if (typeof schema.modelRange !== 'undefined') {
              const matches = val.match(/\d+/g)
              if (matches.length > 1) {
                matches.sort()
                for (const m in matches) {
                  objectPath.set(state, 'fhir.' + modelRoot + '.' + schema.modelRange[m] + '.' + schema.modelEnd, matches[m])
                  if (typeof schema.display !== 'undefined' && typeof schema.options !== 'undefined') {
                    const m1 = schema.options.find(({ value }) => value === val)
                    objectPath.set(state, 'fhir.' + modelRoot + '.' + schema.modelRange[m] + '.' + schema.display, m1.label)
                  }
                  if (typeof schema.system !== 'undefined') {
                    objectPath.set(state, 'fhir.' + modelRoot + '.' + schema.modelRange[m] + '.' + schema.system.model, schema.system.value)
                  }
                }
                if (objectPath.has(state, 'fhir.' + modelRoot + '.' + schema.modelOne + '.' + schema.modelEnd)) {
                  objectPath.del(state, 'fhir.' + modelRoot + '.' + schema.modelOne)
                }
              } else {
                objectPath.set(state, 'fhir.' + modelRoot + '.' + schema.modelOne + '.' + schema.modelEnd, val)
                let modelRange1 = schema.modelRange[0]
                modelRange1 = modelRange1.split('.').slice(0,-1).join('.')
                if (objectPath.has(state, 'fhir.' + modelRoot + '.' + modelRange1)) {
                  objectPath.del(state, 'fhir.' + modelRoot + '.' + modelRange1)
                }
              }
              if (typeof schema.system !== 'undefined') {
                // if (typeof j !== 'undefined') {
                  objectPath.set(state, 'fhir.' + modelRoot + '.' + schema.modelOne + '.' + schema.system.model, schema.system.value)
                //   if (typeof j.system !== 'undefined') {
                //     console.log(j.system)
                //   }
                // }
              }
            } else if (typeof schema.modelChoice !== 'undefined') {
              for (const s in schema.modelChoice) {
                if (objectPath.has(state, 'fhir.' + modelRoot + '.' + schema.modelChoice[s])) {
                  objectPath.set(state, 'fhir.' + modelRoot + '.' + schema.modelChoice[s] + '.' + schema.modelEnd, val)
                  if (typeof schema.display !== 'undefined' && typeof schema.options !== 'undefined') {
                    const t = schema.options.find(({ value }) => value === val)
                    objectPath.set(state, 'fhir.' + modelRoot + '.' + schema.modelChoice[s] + '.' + schema.display, t.label)
                  }
                }
              }
            } else {
              if (typeof schema.text !== 'undefined') {
                objectPath.set(state, 'fhir.' + modelRoot + '.' + schema.text, val)
                if (typeof schema.repeat !== 'undefined') {
                  const repeat = parseSig(val)
                  if (typeof repeat.frequency !== 'undefined') {
                    for (const key in repeat) {
                      objectPath.set(state, 'fhir.' + modelRoot + '.' + schema.repeat + '.' + key, repeat[key])
                    }
                  }
                }
              } else {
                if (typeof schema.datepicker !== 'undefined') {
                  val = moment(val).format(moment.HTML5_FMT.DATE)
                }
                if (typeof schema.div !== 'undefined') {
                  val = '<div xmlns="http://www.w3.org/1999/xhtml">' + val + '</div>'
                  const status = modelRoot.replace('.div', '.status')
                  objectPath.set(state, 'fhir.' + status, 'generated')
                }
                objectPath.set(state, 'fhir.' + modelRoot, val)
                if (typeof schema.display !== 'undefined' && typeof schema.options !== 'undefined') {
                  const j = schema.options.find(({ value }) => value === val)
                  if (typeof j !== 'undefined') {
                    objectPath.set(state, 'fhir.' + modelRoot1 + '.' + schema.display, j.label)
                  } else {
                    objectPath.set(state, 'fhir.' + schema.modelDefault, val)
                    objectPath.del(state, 'fhir.' + schema.modelRoot)
                  }
                }
                if (typeof schema.code !== 'undefined') {
                  const k = schema.options.find(({ label }) => label === val)
                  objectPath.set(state, 'fhir.' + modelRoot1 + '.' + schema.code, k.value)
                }
                if (typeof schema.system !== 'undefined') {
                  if (typeof schema.system.value !== 'undefined') {
                    objectPath.set(state, 'fhir.' + modelRoot1 + '.' + schema.system.model, schema.system.value)
                  }
                }
                if (typeof schema.use !== 'undefined') {
                  objectPath.set(state, 'fhir.' + schema.use.model, schema.use.value)
                }
                if (typeof schema.copy !== 'undefined' && typeof schema.options !== 'undefined') {
                  const l = schema.options.find(({ value }) => value === val)
                  objectPath.set(state, 'form.' + schema.copy.id, l.label)
                  const n = state.schema.flat().find(o => o.id === schema.copy.id)
                  fhirMapItem(n)
                }
              }
            }
          } else {
            if (objectPath.has(state, 'fhir.' + modelRoot)) {
              objectPath.del(state, 'fhir.' + modelRoot)
            }
          }
        }
      }
    }
    const getForm = (index) => {
      state.fhirProcess = true
      for (const i in state.schema) {
        if (Array.isArray(state.schema[i])) {
          for (const j in state.schema[i]) {
            getFormItem(state.schema[i][j], index)
          }
        } else {
          getFormItem(state.schema[i], index)
        }
      }
      state.fhirProcess = false
    }
    const getFormItem = async(schema, index) => {
      const id = schema.id
      let model = ''
      if (typeof schema.modelParent !== 'undefined') {
        model = schema.modelParent + '.' + index + '.'
      }
      if (typeof schema.modelRoot !== 'undefined') {
        if (schema.modelArray == false) {
          model += schema.modelRoot + '.' + schema.model
        } else {
          model += schema.modelRoot + '.0.' + schema.model
        }
      } else {
        model += schema.model
      }
      if (schema.type == 'tags' || schema.multiple == true) {
        const a = []
        if (schema.modelRoot !== undefined) {
          if (schema.modelParent !== undefined) {
            for (const b in objectPath.get(state, 'fhir.' + schema.modelParent + '.' + index + '.' + schema.modelRoot)) {
              a[b] = objectPath.get(state, 'fhir.' + schema.modelParent + '.' + index + '.' + schema.modelRoot + '.' + b  + '.' + schema.model)
            }
          } else {
            for (const b1 in objectPath.get(state, 'fhir.' + schema.modelRoot)) {
              a[b1] = objectPath.get(state, 'fhir.' + schema.modelRoot + '.' + b1  + '.' + schema.model)
            }
          }
          if (a.length > 0) {
            objectPath.set(state, 'form.' + id, a)
          }
        } else {
          objectPath.set(state, 'form.' + id, objectPath.get(state, 'fhir.' + model))
        }
      } else if (schema.modelOne !== undefined) {
        let c = ''
        if (objectPath.has(state, 'fhir.' + model + '.' + schema.modelOne + '.' + schema.modelEnd)) {
          c = objectPath.get(state, 'fhir.' + model + '.' + schema.modelOne + '.' + schema.modelEnd)
        } else {
          if (objectPath.has(state, 'fhir.' + model + '.' + schema.modelRange[0] + '.' + schema.modelEnd)) {
            c = objectPath.get(state, 'fhir.' + model + '.' + schema.modelRange[0] + '.' + schema.modelEnd)
            c += ' to '
            c += objectPath.get(state, 'fhir.' + model + '.' + schema.modelRange[1] + '.' + schema.modelEnd)
          }
        }
        objectPath.set(state, 'form.' + id, c)
      } else if (schema.modelChoice !== undefined) {
        let d = ''
        for (const e in schema.modelChoice) {
          if (objectPath.has(state, 'fhir.' + model + '.' + schema.modelChoice[e] + '.' + schema.modelEnd)) {
            d = objectPath.get(state, 'fhir.' + model + '.' + schema.modelChoice[e] + '.' + schema.modelEnd)
          }
        }
        objectPath.set(state, 'form.' + id, d)
      } else if (schema.text !== undefined) {
        objectPath.set(state, 'form.' + id, objectPath.get(state, 'fhir.' + model + '.' + schema.text))
      } else if (schema.div !== undefined) {
        if (objectPath.has(state, 'fhir.' + model)) {
          objectPath.set(state, 'form.' + id, removeTags1(objectPath.get(state, 'fhir.' + model)))
        }
      } else {
        objectPath.set(state, 'form.' + id, objectPath.get(state, 'fhir.' + model))
      }
      // if (objectPath.get(state, 'fhir.' + model) == undefined) {
      //   if (schema.tags == true || schema.multiple == true) {
      //     objectPath.set(state, 'form.' + id, [])
      //   } else {
      //     objectPath.set(state, 'form.' + id, '')
      //   }
      // }
      if (id == 'country') {
        await updateSelect(id, state.form[id])
      }
    }
    const getIndex = () => {
      let a = ''
      if (Array.isArray(state.schema[0])) {
        a = objectPath.get(state, 'schema.0.0.modelParent')
      } else {
        a = objectPath.get(state, 'schema.0.modelParent')
      }
      const b = objectPath.get(state, 'fhir.' + a)
      if (b == undefined) {
        return 0
      } else {
        return b.length
      }
    }
    const onCancel = () => {
      if (props.resource == 'encounters') {
        emit('close-form', state.fhir.id)
      } else {
        emit('close-form')
      }
    }
    const onDetails = () => {
      if (props.resource == 'immunizations') {
        state.dialogVaccine = true
        const json = {
          code: state.form.immunizationCode,
          text: state.form.immunizationText,
          publicationDate: '',
          vis_url: '',
          vis: '',
          protocol: state.form.protocol,
          shortname: ''
        }
        const a = state.cvx_vis.findIndex(item => item.includes(json.code.padEnd(10)))
        if (a !== -1) {
          const b = state.vis_barcode_lookup.data.findIndex(item => item.includes(state.cvx_vis[a][2]))
          json.publicationDate = state.vis_barcode_lookup.data[b][1]
          if (b !== -1) {
            const c = state.vis_url.data.findIndex(item => item.includes(state.vis_barcode_lookup.data[b][3]))
            json.vis_url = state.vis_url.data[c][2]
            json.vis = state.vis_url.data[c][0]
          }
        }
        const d = state.cvx.findIndex(item => item.includes(json.code.padEnd(10)))
        if (d !== -1) {
          json.shortname = state.cvx[d][1]
        }
        state.vaccine = json
      }
    }
    const parseSig = (str) => {
      const ret = {}
      str = str.toLowerCase()
      if (str.startsWith('qd')) {
        ret.frequency = 1
        ret.period = 1
        ret.periodUnit = 'd'
      }
      if (str.startsWith('qod')) {
        ret.frequency = 1
        ret.period = 2
        ret.periodUnit = 'd'
      }
      if (str.startsWith('bid')) {
        ret.frequency = 2
        ret.period = 1
        ret.periodUnit = 'd'
      }
      if (str.startsWith('tid')) {
        ret.frequency = 3
        ret.period = 1
        ret.periodUnit = 'd'
      }
      if (str.startsWith('qid')) {
        ret.frequency = 4
        ret.period = 1
        ret.periodUnit = 'd'
      }
      if (str.startsWith('am')) {
        ret.frequency = 1,
        ret.period = 1
        ret.periodUnit = 'd'
        ret.when = 'MORN'
      }
      if (str.startsWith('pm')) {
        ret.frequency = 1
        ret.period = 1
        ret.periodUnit = 'd'
        ret.when = 'EVE'
      }
      if (str.startsWith('qhs')) {
        ret.frequency = 1
        ret.period = 1
        ret.periodUnit = 'd'
        ret.when = 'HS'
      }
      if (str.startsWith('at bedtime')) {
        ret.frequency = 1
        ret.period = 1
        ret.periodUnit = 'd'
        ret.when = 'HS'
      }
      if (typeof ret.frequency == 'undefined') {
        if (/^\d/.test(str)) {
          const matches = str.match(/^\d/)
          ret.frequency = matches[0]
          ret.period = 1
          str = str.replace(matches[0],'').trim()
          str = str.replace('times','').trim()
          str = str.replace('a','').trim()
        } else {
          if (str.startsWith('every')) {
            ret.frequency = 1
            str = str.replace('every','').trim()
            if (/^\d/.test(str)) {
              const matches1 = str.match(/^\d/)
              ret.period = matches1[0]
              str = str.replace(matches1[0],'').trim()
              if (str.startsWith('to')) {
                str = str.replace('to','').trim()
                const matches1a = str.match(/^\d/)
                ret['periodMax'] = matches1a[0]
              }
              if (str.startsWith('-')) {
                str = str.replace('-','').trim()
                const matches1b = str.match(/^\d/)
                ret['periodMax'] = matches1b[0]
              }
            } else {
              if (str.startsWith('other')) {
                ret.period = 2
                str = str.replace('other','').trim()
              }
            }
          }
          if (str.startsWith('q')) {
            ret.frequency = 1
            str = str.replace('q','').trim()
            if (/^\d/.test(str)) {
              const matches2 = str.match(/^\d/)
              ret.period = matches2[0]
              str = str.replace(matches2[0],'').trim()
              if (str.startsWith('to')) {
                str = str.replace('to','').trim()
                const matches2a = str.match(/^\d/)
                ret['periodMax'] = matches2a[0]
              }
              if (str.startsWith('-')) {
                str = str.replace('-','').trim()
                const matches2b = str.match(/^\d/)
                ret['periodMax'] = matches2b[0]
              }
            } else {
              if (str.startsWith('other')) {
                ret.period = 2
                str = str.replace('other','').trim()
              }
            }
          }
          if (str.startsWith('once')) {
            ret.frequency = 1
            ret.period = 1
            str = str.replace('once','').trim()
          }
        }
        if (str.startsWith('hour')) {
          ret.periodUnit = 'h'
          str = str.replace('hour','').trim()
        }
        if (str.startsWith('day')) {
          ret.periodUnit = 'd'
          str = str.replace('day','').trim()
        }
        if (str.startsWith('daily')) {
          ret.periodUnit = 'd'
          str = str.replace('daily','').trim()
        }
        if (str.startsWith('week')) {
          ret.periodUnit = 'wk'
          str = str.replace('week','').trim()
        }
        if (str.startsWith('h')) {
          ret.periodUnit = 'h'
          str = str.replace('h','').trim()
        }
        if (str.startsWith('d')) {
          ret.periodUnit = 'd'
          str = str.replace('d','').trim()
        }
        str = str.replace('at','').trim()
        str = str.replace('in the','').trim()
        if (str.startsWith('am')) {
          ret.when = 'MORN'
        }
        if (str.startsWith('pm')) {
          ret.when = 'EVE'
        }
        if (str.startsWith('bedtime')) {
          ret.when = 'HS'
        }
      }
      return ret
    }
    const removeTags1 = (str) => {
      if ((str===null) || (str==='')) {
        return false
      } else {
        str = str.toString()
        return str.replace('<div xmlns="http://www.w3.org/1999/xhtml">', '').replace('</div>', '')
      }
    }
    const showFHIR = () => {
      state.showPreview = true
    }
    const saveForm = async() => {
      state.sending = true
      await sync(props.resource, false, props.patient, true, state.fhir)
      if (props.resource === 'compositions') {
        const doc0 = await localDB.get(state.fhir.id)
        emit('composition', doc0)
        $q.notify({
          message: 'The ' + Case.lower(pluralize.singular(props.resource)) + ' is now acknowledged in the encounter.',
          color: 'primary',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
      $q.notify({
        message: 'The ' + Case.lower(pluralize.singular(props.resource)) + ' was saved with success!',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
      if (props.resource === 'medication_requests' || props.resource === 'service_requests') {
        const entries = []
        const references = []
        const composition = await import('@/assets/fhir/compositions.json')
        const composition_doc = composition.fhir
        const composition_id = 'nosh_' + uuidv4()
        objectPath.set(composition_doc, 'id', composition_id)
        objectPath.set(composition_doc, '_id', composition_id)
        if (props.resource === 'service_requests') {
          objectPath.set(composition_doc, 'category.0.coding.0.code', state.fhir.category[0].coding.code)
          objectPath.set(composition_doc, 'category.0.coding.0.display', state.fhir.category[0].coding.display)
          objectPath.set(composition_doc, 'title', state.fhir.category[0].coding.display)
        } else {
          objectPath.set(composition_doc, 'category.0.coding.0.code', '57833-6')
          objectPath.set(composition_doc, 'category.0.coding.0.display', 'Prescription For Medication')
          objectPath.set(composition_doc, 'title', 'Prescription For Medication')
        }
        composition_doc.subject.reference = 'Patient/' + state.patient
        composition_doc.author[0].reference = state.user.reference
        composition_doc.author[0].display = state.user.display
        objectPath.del(composition_doc, 'encounter.reference')
        composition_doc.date = moment().format('YYYY-MM-DD HH:mm')
        composition_doc.confidentiality = 'N'
        composition_doc.status = 'final'
        objectPath.set(composition_doc, 'text', state.fhir.text)
        await sync('compositions', false, state.patient, true, composition_doc)
        const composition_entry = {}
        objectPath.set(composition_entry, 'resource', composition_doc)
        entries.push(composition_entry)
        const subject = {}
        objectPath.set(subject, 'resource', Case.snake(pluralize(composition_doc.subject.reference.split('/').slice(0,-1).join(''))))
        objectPath.set(subject, 'id', composition_doc.subject.reference.split('/').slice(-1).join(''))
        references.push(subject)
        for (const a in composition_doc.author) {
          const author = {}
          objectPath.set(author, 'resource', Case.snake(pluralize(composition_doc.author[a].reference.split('/').slice(0,-1).join(''))))
          objectPath.set(author, 'id', composition_doc.author[a].reference.split('/').slice(-1).join(''))
          references.push(author)
        }
        const entry = {}
        objectPath.set(entry, 'resource', state.fhir)
        entries.push(entry)
        for (const reference of references) {
          const db1 = new PouchDB(prefix + reference.resource)
          const results1 = await db1.get(reference.id)
          entries.push({resource: results1})
        }
        const signature_data = await ssxService(props.resource, state.fhir)
        const bundle_doc = bundleBuild(entries, Case.pascal(pluralize.singular(props.resource)) + '/' + state.fhir._id, signature_data, state.patient)
        $q.notify({
          message: 'The ' + Case.lower(pluralize.singular(props.resource)) + ' is signed!',
          color: 'primary',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
        if (objectPath.has(props, 'care_plan_doc.id')) {
          const doc = props.care_plan_doc
          if (objectPath.has(doc, 'activity')) {
            const a = doc.activity.length
            objectPath.set(doc, 'activity.' + a + '.reference', Case.pascal(pluralize.singular(props.resource)) + '/' + state.fhir.id)
          } else {
            objectPath.set(doc, 'activity.0.reference', Case.pascal(pluralize.singular(props.resource)) + '/' + state.fhir.id)
          }
          await sync('care_plans', false, props.patient, true, doc)
          const doc1 = await localDB1.get(doc.id)
          emit('care-plan', doc1)
          $q.notify({
            message: 'The ' + Case.lower(pluralize.singular(props.resource)) + ' is now associated with the active care plan.',
            color: 'primary',
            actions: [
              { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
            ]
          })
        }
      }
      if (props.resource === 'conditions' ||
          props.resource === 'medication_statements' ||
          props.resource === 'allergy_intolerances' ||
          props.resource === 'immunizations') {
        if (objectPath.has(props, 'composition_doc.id')) {
          emit('set-composition-section', props.resource)
        }
      }
      await syncEmailToUser(props.resource, props.category, state.fhir, props.patient)
      state.formSaved = true
      state.sending = false
      emit('reload-drawer', props.resource)
      emit('close-form', state.fhir.id, state.fhir)
    }
    const selectTemplate = (template) => {
      if (!template.clear) {
        const text = state.form[template.target]
        const n = text.lastIndexOf('.' + state.template.text)
        if (template.type === 'textarea') {
          state.form[template.target] = text.slice(0, n) + text.slice(n).replace('.' + state.template.text, template.text)
        } else {
          state.form[template.target] = text.slice(0, n) + text.slice(n).replace('.' + state.template.text, template.text.replace(/\n/g, "<br />"))
        }
        state.templateSelected = true
        fhirMap()
      }
      state.template.text = ''
      state.template.target = ''
      closeTemplate()
    }
    const selectVaccine = (data) => {
      const json = {}
      json.value = data
      copySelected(json, "searchVaccine")
      closeVaccine()
    }
    const showForm = (hidden, category) => {
      if (props.category === 'all' || props.category === category) {
        if (hidden === false || typeof hidden == 'undefined') {
          return true
        } else {
          return false
        }
      } else {
        return false
      }
    }
    const ssxService = async(resource, doc) => {
      const ssx = new SSX()
      await ssx.signIn()
      const address = ssx.userAuthorization.address()
      const chainId = ssx.userAuthorization.chainId()
      const domain = window.location.host
      const origin = window.location.origin
      const statement = 'Sign this ' + Case.pascal(pluralize.singular(resource))
      const resource_url = origin + '/fhir/api/' + state.patient + '/' + Case.pascal(pluralize.singular(resource)) + '/' + doc._id
      const resource_arr = []
      resource_arr.push(resource_url)
      const siwemessage = new SiweMessage({
        domain,
        address,
        statement,
        uri: origin,
        version: '1',
        chainId,
        resources: resource_arr
      })
      const siwemessage_prep = siwemessage.prepareMessage()
      const signature = await ssx.userAuthorization.signMessage(siwemessage_prep)
      const message = siwemessage_prep.replace(/(?:\r\n|\r|\n)/g, '\n')
      const hash = jsum.digest(doc, 'SHA256', 'hex')
      const siwe = {signature, message, hash}
      const return_data = {
        time: moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
        reference: Case.pascal(pluralize.singular(resource)) + '/' + doc._id,
        data: Buffer.from(JSON.stringify(siwe)).toString("base64")
      }
      return return_data
    }
    const updateSelect = async(field, val) => {
      if (field == 'country') {
        const f = props.states.find(e => e.iso2 == val)
        state.schema = addSchemaOptions('state', f.states, 'state_code', 'name', state.schema)
      }
      if (props.resource == 'observations' && props.category == 'vital-signs') {
        if (props.category == 'vital-signs') {
          if (field == 'code') {
            state.form.unit = (val == '9279-1') ? "/min"
              : (val == '8867-4') ? "/min"
              : (val == '8310-5') ? "degF"
              : (val == '8302-2') ? "[in_i]"
              : (val == '9843-4') ? "cm"
              : (val == '29463-7') ? "[lb_av]"
              : (val == '39156-5') ? "kg/m2"
              : (val == '8480-6') ? "mm[Hg]"
              : (val == '8462-4') ? "mm[Hg]"
              : ""
          }
        }
        if (props.category == 'activity') {
          if (field == 'code') {
            const a = objectPath.get(props, 'select.' + props.activity)
            const b = a.filter((a) => {return a.CF_CODE10 == val})
            objectPath.set(state, 'fhir.valueQuantity.unit', b[0].Vendor_UOM)
            const params = {
              sf: 'cs_code',
              maxList: 1,
              terms: b[0].Vendor_UOM
            }
            const opt = {
              timeout: 500
            }
            try {
              const d = await axios.get('https://clinicaltables.nlm.nih.gov/api/ucum/v3/search', {params}, {opt})
              if (d.data[3].length == 1) {
                objectPath.set(state, 'fhir.valueQuantity.code', d.data[3][0][0])
                objectPath.set(state, 'fhir.valueQuantity.system', 'http://unitsofmeasure.org')
              }
            } catch (e) {
              console.log(e)
              $q.notify({
                message: 'Error connecting to UCUM API.  Please try again later',
                color: 'red',
                actions: [
                  { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
                ]
              })
            }
          }
        }
      }
      if (props.resource == 'appointments') {
        if (field == 'practitioner') {
          const userDB = new PouchDB(prefix + 'users')
          const result = await userDB.find({selector: {'reference': {$eq: val }, _id: {"$gte": null}}})
          if (result.docs.length > 0) {
            objectPath.set(state, 'form.serviceType', objectPath.get(result, 'docs.0.defaults.serviceType'))
            objectPath.set(state, 'form.appointmentType', objectPath.get(result, 'docs.0.defaults.appointmentType'))
            objectPath.set(state, 'form.serviceCategory', objectPath.get(result, 'docs.0.defaults.serviceCategory'))
            fhirMap()
          }
        }
      }
      if (props.resource == 'document_references') {
        if (field === 'category') {
          const schema = state.schema.flat().find(row => row.id == field)
          const val_obj = schema.options.find(row1 => row1.value == val)
          let model = schema.modelRoot
          if (schema.multiple) {
            console.log(objectPath.get(state, 'form.' + field))
            console.log(val)
            const index = objectPath.get(state, 'form.' + field).findIndex(form_val => form_val == val)
            model += '.' + index + '.' + schema.system.model
          } else {
            model += '.' + schema.system.model
          }
          console.log(model)
          objectPath.set(state, 'fhir.' + model, val_obj.system)
          fhirMap()
        }
      }
    }
    const updateTemplate = () => {
      state.templateSelected = false
    }
    const updateValue = async(val, field, type) => {
      state.form[field] = val
      if (type == 'textarea' || type == 'editor') {
        catchTemplate(field, type)
      } else {
        if (field == 'systemTelcom') {
          if (val === 'email') {
            objectPath.set(state, 'schema.1.0.type', 'email')
            objectPath.set(state, 'schema.1.0.rules', 'required|email')
            if (objectPath.has(state, 'schema.1.0.mask')) {
              objectPath.del(state, 'schema.1.0.mask')
            }
          } else if (val === 'phone' || val === 'fax' || val === 'SMS' || val === 'pager') {
            objectPath.set(state, 'schema.1.0.type', 'tel')
            objectPath.set(state, 'schema.1.0.rules', 'required')
            objectPath.set(state, 'schema.1.0.mask', 'phone')
          } else if (val === 'url') {
            objectPath.set(state, 'schema.1.0.type', 'url')
            objectPath.set(state, 'schema.1.0.rules', 'required|url')
            if (objectPath.has(state, 'schema.1.0.mask')) {
              objectPath.del(state, 'schema.1.0.mask')
            }
          } else {
            objectPath.set(state, 'schema.1.0.type', 'text')
            objectPath.set(state, 'schema.1.0.rules', 'required')
            if (objectPath.has(state, 'schema.1.0.mask')) {
              objectPath.del(state, 'schema.1.0.mask')
            }
          }
        }
        if (field == 'id_system') {
          if (val == 'http://hl7.org/fhir/sid/us-npi') {
            objectPath.set(state, 'schema.0.1.mask', '##########')
          } else {
            objectPath.del(state, 'schema.0.1.mask')
          }
        }
        fhirMap()
        await updateSelect(field, val)
      }
    }
    return {
      addSchemaOptions,
      catchTemplate,
      clearForm,
      closeFHIR,
      closeTemplate,
      closeVaccine,
      copySelected,
      divMap,
      fetchTXT,
      fhirMap,
      fhirMapItem,
      getForm,
      getFormItem,
      getIndex,
      onCancel,
      onDetails,
      parseSig,
      removeTags,
      removeTags1,
      showFHIR,
      saveForm,
      selectTemplate,
      selectVaccine,
      showForm,
      ssxService,
      sync,
      syncEmailToUser,
      updateSelect,
      updateTemplate,
      updateValue,
      myInput,
      mySearchInput,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
#fhirpreview {
  font-family:Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace;
}
</style>
