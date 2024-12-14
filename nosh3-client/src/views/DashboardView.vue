<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          @click="state.menuVisible = !state.menuVisible"
          aria-label="Menu"
          icon="menu"
        />
        <q-toolbar-title id="logo">
          Nosh
        </q-toolbar-title>
        <div v-if="state.loading">
          <q-spinner color="white" size="sm" thickness="5"/>
          <q-tooltip :offset="[0, 8]">Loading...</q-tooltip>
        </div>
        <q-btn v-if="state.updateExists" flat dense round icon="update" @click="refreshApp">
          <q-tooltip>Update available, click to refresh</q-tooltip>
        </q-btn>
        <v-offline @detected-condition="checkOnline">
          <template v-if="state.online">
            <q-btn flat dense round icon="cloud_queue">
              <q-tooltip>Online</q-tooltip>
            </q-btn>
          </template>
          <template v-if="!state.online">
            <q-btn flat dense round icon="cloud_off">
              <q-tooltip>Offline</q-tooltip>
            </q-btn>
          </template>
        </v-offline>
        <q-separator vertical inset />
        <q-btn-dropdown v-if="state.type == 'mdnosh'" ref="patientSearchBtn" flat dense rounded no-icon-animation="false" dropdown-icon="search" @show="focusInput">
          <q-tooltip>Patient Search</q-tooltip>
          <q-list>
            <q-item>
              <q-input ref="patientSearch" outlined bottom-slots v-model="state.patientsearch" placeholder="Search Patient" debounce="300">
                <template v-slot:append>
                  <q-icon v-if="state.patientsearch !== ''" name="close" @click="state.patientsearch = ''" class="cursor-pointer" />
                  <q-icon name="search" />
                </template>
              </q-input>
            </q-item>
            <div v-for="item in state.patientListSearch" :key="item.item.id">
              <q-item clickable @click="openLink(item.item.url)">
                {{ item.item.name }}
              </q-item>
            </div>
          </q-list>
        </q-btn-dropdown>
        <q-btn flat dense round icon="person_add" v-if="state.type == 'mdnosh'" @click="addPatient">
          <q-tooltip>Add Patient</q-tooltip>
        </q-btn>
        <q-btn flat dense round icon="chat" @click="openList('communications', 'inbox')">
          <q-badge color="red" floating>{{ state.messages }}</q-badge>
          <q-tooltip>Messages</q-tooltip>
        </q-btn>
        <q-btn flat dense round icon="task" @click="openList('tasks', 'inbox')">
          <q-badge color="red" floating>{{ state.tasks }}</q-badge>
          <q-tooltip>Tasks</q-tooltip>
        </q-btn>
        <q-btn flat dense round icon="more_vert">
          <QMenuTemplate
            v-if="state.showMenu"
            @open-list="openList"
            @open-page="openPage"
            @open-qr-reader="openQRReader"
            @open-schedule="openSchedule"
            @stop-inbox-timer="stopInboxTimer"
            :user="state.user"
            :online="state.online"
          />
        </q-btn>
      </q-toolbar>
      <q-toolbar v-if="state.toolbar" class="bg-grey-2 text-primary" inset>
        <QToolbarTemplate
          @lock-thread="lockThread"
          @open-chat="openChat"
          @open-form="openForm"
          @open-list="openList"
          @open-page="openPage"
          @open-page-form="openPageForm"
          @sort-alpha="sortAlpha"
          @sort-date="sortDate"
          @close-container="closeContainer"
          @open-detail="openDetail"
          :toolbar-object="state.toolbarObject"
          :encounter="state.encounter"
          :id="state.id"
          :user="state.user"
          :provider="state.provider"
        />
      </q-toolbar>
    </q-header>
    <q-drawer
      v-model="state.menuVisible"
      bordered
      :width="250"
      :breakpoint="500"
      class="bg-grey-2"
    >
      <QDrawerTemplate
        v-if="state.showDrawer"
        @open-list="openList"
        @open-page="openPage"
        @reload-drawer-complete="reloadDrawerComplete"
        :care_plan_doc="state.careplanDoc"
        :patient="state.patient"
        :patient-name="state.patientName"
        :patient-nickname="state.patientNickname"
        :patient-age="state.patientAge"
        :patient-gender="state.patientGender"
        :patient-photo="state.patientPhoto"
        :drawer-reload="state.drawerReload"
        :drawer-resource="state.drawerResource"
      />
    </q-drawer>
    <q-page-container>
      <div v-if="state.showDashboard" class="q-pa-md row q-gutter-md">
        <q-card >
          <q-item>
            <q-item-section avatar><q-icon color="primary" name="assignment_ind" /></q-item-section>
            <q-item-section><q-item-label class="text-h6 text-primary">Recently Opened Charts</q-item-label></q-item-section>
          </q-item>
          <q-separator />
          <q-card-section>
            <q-list>
              <div v-for="item in state.recent_charts" :key="item.id">
                <q-item clickable @click="openLink(item.url)">
                  {{ item.name }}
                </q-item>
              </div>
            </q-list>
          </q-card-section>
        </q-card>
        <q-card>
          <q-item>
            <q-item-section avatar><q-icon color="primary" name="edit_note" /></q-item-section>
            <q-item-section><q-item-label class="text-h6 text-primary">Unsigned Encounters</q-item-label></q-item-section>
          </q-item>
          <q-separator />
          <q-card-section>
            <q-list>
              <div v-for="item1 in state.user.unsigned" :key="item1.id">
                <q-item clickable @click="openLink(item1.url)">
                  {{ item1.name }}, {{ item1.date1 }}
                </q-item>
              </div>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
      <QFormTemplate
        v-if="state.showForm"
        @care-plan="setActiveCarePlan"
        @clear-default="clearDefault"
        @close-form="closeForm"
        @loading="loading"
        @reload-drawer="reloadDrawer"
        @composition="setActiveComposition"
        @set-composition-section="setCompositionSection"
        :auth="state.auth"
        :online="state.online"
        :couchdb="state.couchdb"
        :id="state.id"
        :patient="state.patient"
        :provider="state.provider"
        :practitioner="state.practitioner"
        :user="state.user"
        :resource="state.resource"
        :category="state.category"
        :index="state.index"
        :default="state.default"
        :base="state.base"
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
        :default_med_category="state.default_med_category"
        :states="state.states"
      />
      <QListTemplate
        v-if="state.showList"
        @loading="loading"
        @lock-thread="lockThread"
        @open-chat="openChat"
        @open-form="openForm"
        @open-page="openPage"
        @reload-complete="reloadComplete"
        @reload-drawer="reloadDrawer"
        :auth="state.auth"
        :online="state.online"
        :couchdb="state.couchdb"
        :patient="state.patient"
        :user="state.user"
        :provider="state.provider"
        :practitioner="state.practitioner"
        :reload="state.reload"
        :resource="state.resource"
        :category="state.category"
        :sort="state.sort"
        :base="state.base"
        :schema="state.schema"
        :within_page="state.within_page"
        :options="state.options"
        :care_plan_doc="state.careplanDoc"
        :composition_doc="state.compositionDoc"
      />
      <QPageTemplate
        v-if="state.showPage"
        @loading="loading"
        @open-form="openForm"
        @open-page-form-complete="openPageFormComplete"
        @reload-complete="reloadComplete"
        @update-toolbar="updateToolbar"
        @reload-drawer="reloadDrawer"
        @open-list="openList"
        :auth="state.auth"
        :online="state.online"
        :couchdb="state.couchdb"
        :id="state.id"
        :provider="state.provider"
        :practitioner="state.practitioner"
        :user="state.user"
        :reload="state.reload"
        :resource="state.resource"
        :category="state.category"
        :sort="state.sort"
        :open-page-form="state.openPageForm"
        :care_plan_doc="state.careplanDoc"
        :states="state.states"
        :countries="state.countries"
        :language="state.language"
      />
      <QScheduleTemplate
        v-if="state.showSchedule"
        @close-container="closeContainer"
        @loading="loading"
        @open-form="openForm"
        @reload-drawer="reloadDrawer"
        @update-toolbar="updateToolbar"
        :auth="state.auth"
        :online="state.online"
        :couchdb="state.couchdb"
        :resource="state.resource"
        :provider="state.provider"
        :service_types="state.serviceTypes"
        :service_categories="state.serviceCategories"
        :type="state.type"
      />
      <QChatTemplate
        v-if="state.showChat"
        @reload-complete="reloadComplete"
        :auth="state.auth"
        :online="state.online"
        :couchdb="state.couchdb"
        :id="state.id"
        :reload="state.reloadChat"
        :resource="state.resource"
        :category="state.category"
        :user="state.user"
        :base="state.base"
        :schema="state.schema"
        :archive="state.archive"
      />
    </q-page-container>
  </q-layout>
  <q-dialog v-model="state.pulldown_form" persistent position="top" full-width full-height seamless>
    <QFormTemplate
      v-if="state.pulldown_form"
      @close-form="closePulldown"
      @loading="loading"
      :auth="state.auth"
      :online="state.online"
      :couchdb="state.couchdb"
      :id="state.pulldown_id"
      :provider="state.provider"
      :practitioner="state.practitioner"
      :user="state.user"
      :resource="state.pulldown_resource"
      :category="state.pulldown_category"
      :index="state.pulldown_index"
      :default="state.pulldown_defaults"
      :base="state.pulldown_base"
      :schema="state.pulldown_schema"
      :title="state.pulldown_title"
    />
  </q-dialog>
  <q-dialog v-model="state.qr">
    <q-card>
      <div class="q-pa-md q-gutter-md">
        <q-card>
          <VueQrious :value="state.qr_value"></VueQrious>
        </q-card>
      </div>
    </q-card>
  </q-dialog>
  <q-dialog v-model="state.loading">
    <q-spinner color="white" size="md" thickness="5"/>
    <q-tooltip :offset="[0, 8]">Loading...</q-tooltip>
  </q-dialog>
  <q-dialog v-model="state.showQRReader">
    <QRReader
    />
  </q-dialog>
</template>

<script>
import { defineComponent, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { common } from '@/logic/common'
import Case from 'case'
import Fuse from 'fuse.js'
import moment from 'moment-timezone'
import objectPath from 'object-path'
import PouchDB from 'pouchdb-browser'
import QChatTemplate from '@/components/QChatTemplate.vue'
import QDrawerTemplate from '@/components/QDrawerTemplate.vue'
import QFormTemplate from '@/components/QFormTemplate.vue'
import QListTemplate from '@/components/QListTemplate.vue'
import QMenuTemplate from '@/components/QMenuTemplate.vue'
import QPageTemplate from '@/components/QPageTemplate.vue'
import QRReader from '@/components/QRReader.vue'
import QScheduleTemplate from '@/components/QScheduleTemplate.vue'
import QToolbarTemplate from '@/components/QToolbarTemplate.vue'
import { useAuthStore } from '@/stores'
import { useRoute } from 'vue-router'
import { VOffline } from 'v-offline'
import VueQrious from 'vue-qrious'
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'DashboardView',
  components: {
    QChatTemplate,
    QDrawerTemplate,
    QFormTemplate,
    QListTemplate,
    QMenuTemplate,
    QPageTemplate,
    QRReader,
    QScheduleTemplate,
    QToolbarTemplate,
    VOffline,
    VueQrious
  },
  setup () {
    const $q = useQuasar()
    const { addSchemaOptions, fetchJSON, fhirModel, fhirReplace, inbox, loadSchema, loadSelect, patientList, removeTags, sync, syncAll, thread, threadEarlier, threadLater, updateUser, verifyJWT } = common()
    const state = reactive({
      recent_charts: [],
      showDashboard: true,
      menuVisible: false,
      showDrawer: false,
      showMenu: false,
      drawerReload: false,
      drawerResource: '',
      loading: false,
      online: true,
      type: '',
      toolbarObject: {},
      containerLast: '',
      containerArgsLast: [],
      messages: '0',
      tasks: '0',
      patientsearch: '',
      patientList: [],
      patientListSearch: [],
      // pulldown
      pulldown_form: false,
      pulldown_base: {},
      pulldown_schema: {},
      pulldown_resource: '',
      pulldown_category: '',
      pulldown_defaults: {},
      pulldown_index: '',
      pulldown_id: '',
      pulldown_title: '',
      // form and Lists
      showChat: false,
      showForm: false,
      showList: false,
      showPage: false,
      showSchedule: false,
      searchResults: false,
      sort: 'alpha',
      within_page: false,
      openPageForm: false,
      pageType: '',
      // patient defaults
      id: '',
      // patient: '',
      // patientName: '',
      // patientAge: '',
      // patientGender: '',
      // patientPhoto: '',
      // patientDOB: '',
      // patientNickname: '',
      provider: false,
      practitioner: '',
      user: {},
      reload: false,
      resource: '',
      category: '',
      index: '',
      default: {},
      openDetail: false,
      // forms
      base: {},
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
      medication_request_doc: {},
      new_medication_request: false,
      default_med_category: '',
      // contacts
      countries: [],
      states: [],
      cities: [],
      // patients
      language: [],
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
      // care_plans
      options: [],
      careplan: false,
      careplanDoc: {},
      outcomeTypes: [],
      // compositions
      compositionDoc: {},
      // service_requests
      service_request_doc: {},
      // communications
      archive: false,
      // db
      auth: {},
      couchdb: '',
      pin: '',
      // pwa
      updateExists: false,
      refreshing: false,
      registration: null,
      // qr
      qr: false,
      qr_value: '',
      showQRReader: false
    })
    const route = useRoute()
    const auth = useAuthStore()
    const patientSearch = ref(null)
    const patientSearchBtn = ref(null)
    // autoupdate pwa
    window.addEventListener('swUpdated', (event) => {
      state.registration = event.detail
      console.log(state.registration)
      state.updateExists = true
    }, { once: true })
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (state.refreshing) return
      state.refreshing = true
      window.location.reload()
    })
    // state.couchdb = window.location.origin + ':5984/'
    var patientDB = new PouchDB('patients')
    var inboxTimer = null
    var syncTimer = null
    onMounted(async() => {
      try {
        await verifyJWT(state.online)
      } catch(e) {
        return auth.logout()
      }
      state.type = auth.type
      state.auth = {fetch: (url, opts) => {
        opts.headers.set('Authorization', 'Bearer ' + auth.jwt)
        return PouchDB.fetch(url, opts)
      }}
      state.default_med_category = 'outpatient'
      state.couchdb = auth.db
      state.pin = auth.pin
      const userDB = new PouchDB('users')
      const user = await userDB.get(auth.user.id)
      const [ user_type ] = user.reference.split('/')
      if (user_type == 'Practitioner') {
        state.provider = true
      }
      loadDashboard()
      state.showMenu = true
      const user_arr = state.user.reference.split('/')
      if (user_arr[0] == 'Practitioner') {
        state.provider = true
      }
      state.patientList = await patientList(state.user)
      inboxTimer = setInterval(async() => {
        await updateInbox(user)
      }, 5000)
      syncTimer = setInterval(async() => {
        if (state.online) {
          if (!state.sync_on) {
            state.sync_on = true
            await syncAll(true, state.patient, true)
            state.drawerReload = true
            // await syncSome(state.online, state.patient)
            state.sync_on = false
          }
        }
      }, 15000)
    })
    watch(() => state.patientsearch, (newVal) => {
      if (newVal !== '') {
        const keys = ['name', 'id']
        const fuse = new Fuse(state.patientList, {keys: keys, includeScore: true})
        state.patientListSearch = fuse.search(newVal)
      }
    })
    watch(() => auth.user, (newVal) => {
      if (newVal) {
        loadDashboard()
      }
    })
    const addPatient = () => {
      window.open(window.location.origin + '/app/chart/new')
    }
    const checkOnline = (e) => {
      state.online = e
    }
    const clearDefault = () => {
      state.default = {}
    }
    const closeAll = () => {
      state.showChat = false
      state.showForm = false
      state.showForm = false
      state.showList = false
      state.showPage = false
      state.showSchedule = false
      state.showDashboard = false
      state.searchResults = false
      state.toolbar = false
      state.id = ''
      state.divContent = ''
      state.search = []
    }
    const closeContainer = () => {
      if (state.showPage == true) {
        closeAll()
        if (state.resource == 'practitioners' || state.resource == 'related_persons') {
          openList(state.resource, 'all')
        } else {
          state.showDashboard = true
        }
      } else if (state.showList == true) {
        closeAll()
        if (state.resource == 'related_persons') {
          openPage(state.patient, 'patients', 'identity')
        }
        state.showDashboard = true
      } else {
        // coming from a form or file component
        closeAll()
        if (state.containerLast !== '') {
          if (state.containerLast == 'openList') {
            openList(...state.containerArgsLast)
          }
          if (state.containerLast == 'openPage') {
            openPage(...state.containerArgsLast)
          }
          state.containerLast = ''
          state.containerArgsLast = ''
        } else {
          state.showDashboard = true
        }
      }
    }
    const closeForm = async(id = '', doc = {}) => {
      state.showForm = false
      if (state.resource == 'patients' ||
          state.resource == 'encounters' ||
          state.resource == 'practitioners' ||
          state.resource == 'related_persons' ||
          state.resource == 'users') {
        if (id == '') {
          if (state.id == 'add') {
            if (state.resource !== 'patients') {
              if (state.category == 'new') {
                openList(state.resource, 'all')
              } else {
                openList(state.resource, state.category)
              }
            } else {
              id = state.patient
            }
          } else {
            id = state.id
          }
        } else {
          if (state.resource == 'encounters' && state.category == 'new') {
            state.encounter = id
            state.category = 'subjective'
          }
          if (state.resource == 'patients' && state.category == 'new') {
            window.location.href = window.location.origin + '/app/chart/' + id
          }
          if (state.resource == 'users' && doc.id === state.user.id) {
            state.user = doc
          }
          // if (state.resource == 'compositions') {
          //   if (state.user.reference === doc.author[0].reference) {
          //     const encounterDB = new PouchDB('encounters')
          //     const encounter = await encounterDB.get(doc.encounter.reference.split('/').slice(-1).join(''))
          //     const unsigned = {
          //       name: encounter.reasonCode[0].text,
          //       url: location.protocol + '//' + location.host + location.pathname + '?encounter=' + encounter.id,
          //       id: encounter.id,
          //       date: moment().unix()
          //     }
          //     state.user = await updateUser(state.user, 'unsigned', unsigned)
          //   }
          // }
          state.id = id
        }
        if (state.resource == 'patients') {
          await refreshPatient()
        }
        if (id !== '') {
          openPage(id, state.resource, state.category)
        }
      } else if (state.resource == 'medication_statements' && id !== '' && state.new_medication_request === true) {
        const a = await fetchJSON('fhir/medication_requests', state.online)
        const doc1 = a.fhir
        objectPath.set(doc1, 'medicationCodeableConcept.coding.0.display', objectPath.get(doc, 'medicationCodeableConcept.coding.0.display'))
        objectPath.set(doc1, 'medicationCodeableConcept.coding.0.code', objectPath.get(doc, 'medicationCodeableConcept.coding.0.code'))
        objectPath.set(doc1, 'medicationCodeableConcept.coding.0.system', objectPath.get(doc, 'medicationCodeableConcept.coding.0.system'))
        if (objectPath.has(doc, 'dosage.0.doseAndRate.0.doseQuantity.value')) {
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseQuantity.value', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseQuantity.value'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseQuantity.code', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseQuantity.code'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseQuantity.unit', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseQuantity.unit'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseQuantity.system', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseQuantity.system'))
          objectPath.set(doc1, 'dispenseRequest.quantity.code', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseQuantity.code'))
          objectPath.set(doc1, 'dispenseRequest.quantity.unit', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseQuantity.unit'))
          objectPath.set(doc1, 'dispenseRequest.quantity.system', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseQuantity.system'))
        }
        if (objectPath.has(doc, 'dosage.0.doseAndRate.0.doseRange.low.value')) {
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseRange.low.value', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.low.value'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseRange.high.value', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.high.value'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseRange.low.code', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.low.code'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseRange.high.code', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.high.code'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseRange.low.unit', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.low.unit'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseRange.high.unit', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.high.unit'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseRange.low.system', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.low.system'))
          objectPath.set(doc1, 'dosageInstruction.0.doseAndRate.0.doseRange.high.system', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.high.system'))
          objectPath.set(doc1, 'dispenseRequest.quantity.code', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.low.code'))
          objectPath.set(doc1, 'dispenseRequest.quantity.unit', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.low.unit'))
          objectPath.set(doc1, 'dispenseRequest.quantity.system', objectPath.get(doc, 'dosage.0.doseAndRate.0.doseRange.low.system'))
        }
        objectPath.set(doc1, 'dosageInstruction.0.route.coding', objectPath.get(doc, 'dosage.0.route.coding'))
        objectPath.set(doc1, 'dosageInstruction.0.route.display', objectPath.get(doc, 'dosage.0.route.display'))
        objectPath.set(doc1, 'dosageInstruction.0.route.system', objectPath.get(doc, 'dosage.0.route.system'))
        objectPath.set(doc1, 'dosageInstruction.0.timing.code.text', objectPath.get(doc, 'dosage.0.timing.code.text'))
        if (objectPath.has(doc, 'dosage.0.timing.repeat')) {
          objectPath.set(doc1, 'dosageInstruction.0.timing.repeat.frequency', objectPath.get(doc, 'dosage.0.timing.repeat.frequency'))
          objectPath.set(doc1, 'dosageInstruction.0.timing.repeat.period', objectPath.get(doc, 'dosage.0.timing.repeat.period'))
          objectPath.set(doc1, 'dosageInstruction.0.timing.repeat.periodUnit', objectPath.get(doc, 'dosage.0.timing.repeat.periodUnit'))
        }
        objectPath.set(doc1, 'dosageInstruction.0.asNeededBoolean', objectPath.get(doc, 'asNeededBoolean'))
        if (objectPath.has(doc, 'dosage.0.text')) {
          objectPath.set(doc1, 'dosageInstruction.0.text', objectPath.get(doc, 'dosage.0.text'))
        }
        if (objectPath.has(doc, 'additionalInstruction.0.text')) {
          objectPath.set(doc1, 'dosageInstruction.0.additionalInstruction.0.text', objectPath.get(doc, 'additionalInstruction.0.text'))
        }
        objectPath.set(doc1, 'dispenseRequest.expectedSupplyDuration.unit', 'days')
        objectPath.set(doc1, 'dispenseRequest.expectedSupplyDuration.code', 'd')
        objectPath.set(doc1, 'dispenseRequest.expectedSupplyDuration.system', 'http://unitsofmeasure.org')
        const div = removeTags(doc.text.div)
        state.new_medication_request = false
        openForm('add', 'medication_requests', 'all', '', {}, false, doc1, div)
      } else if (state.resource === 'medication_requests' && id !== '') {
        signPrescription(doc)
      } else {
        if (state.resource === 'medication_statements') {
          state.new_medication_request = false
          state.medication_request_doc = {}
        }
        openList(state.resource, 'all')
      }
      state.id = ''
    }
    const closeList = () => {
      state.showList = false
      state.showDashboard = true
    }
    const closePage = () => {
      state.showPage = false
      state.showDashboard = true
    }
    const closePulldown = (id = '') => {
      state.pulldown_title = ''
      state.pulldown_id = id
      state.pulldown_resource = ''
      state.pulldown_category = ''
      state.pulldown_base = {}
      state.pulldown_schema = {}
      state.pulldown_defaults = {}
      state.pulldown_form = false
    }
    const focusInput = async() => {
      await nextTick()
      console.log(patientSearch.value)
      patientSearch.value.focus()
    }
    const loadDashboard = () => {
      state.user = auth.user
      state.recent_charts = state.user.charts.slice(0, 10)
      if (objectPath.has(state, 'user.unsigned')) {
        if (state.user.unsigned.length > 0) {
          for (const b in state.user.unsigned) {
            objectPath.set(state, 'user.unsigned.' + b + '.date1', 'Date Started: ' + moment.unix(state.user.unsigned[b].date).format('YYYY-MM-DD HH:mm'))
          }
        }
      }
    }
    const loading = () => {
      if (state.loading === true) {
        state.loading = false
      } else {
        state.loading = true
      }
    }
    const loadResource = async(resource, category) => {
      state.loading = true
      state.base = await fetchJSON('fhir/' + resource, state.online)
      if (category === 'all') {
        state.schema = state.base.uiSchema
        state.divContent = state.base.divContent
        state.search = state.base.uiSearchBars
      } else {
        if (resource === 'observations' || resource === 'service_requests') {
          const sub = state.base.categories.find(o => o.value === category)
          state.options = state.base.categories
          state.schema = sub.uiSchema
          state.divContent = sub.divContent
          state.search = sub.uiSearchBars
        } else {
          state.schema = state.base[category].uiSchema
          state.divContent = state.base[category].divContent
          state.search = state.base[category].uiSearchBars
        }
      }
      const resource_obj = await loadSchema(resource, category, state.schema, state.online, state.options)
      state.schema = resource_obj.schema
      state.options = resource_obj.options
      state.states = resource_obj.states
      state.countries = resource_obj.countries
      state.select = resource_obj.select
      state.loading = false
    }
    const lockThread = async(id) => {
      const localDB = new PouchDB('communications')
      const a = await localDB.get(id)
      arr = await thread(a, state.online, state.patient)
      for (const b in arr) {
        objectPath.set(arr, b + '.status', 'completed')
        await localDB.put(arr[b])
      }
      await sync('communications', false, state.patient, false)
    }
    const openChart = (id) => {
      state.patientSearch = ''
      patientSearchBtn.value.hide()
      window.open(window.location.origin + '/app/chart/' + id)
    }
    const openChat = async(id, category, status) => {
      closeAll()
      await nextTick()
      state.resource = 'communications'
      state.id = id
      state.category = category
      await loadResource(state.resource, state.category)
      console.log(status)
      updateToolbar({type: 'chat', resource: state.resource, status: status})
      state.toolbar = true
      state.showChat = true
    }
    const openDetail = () => {
      state.openDetail = true
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
        if (index == 'add') {
          updateToolbar({type: 'form', resource: state.resource, category: state.category, action: 'Add'})
        } else {
          updateToolbar({type: 'form', resource: state.resource, category: state.category, action: 'Edit'})
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
      state.toolbar = true
      if ($q.screen.lt.sm) {
        state.menuVisible = false
      }
    }
    const openLink = (url) => {
      state.patientSearch = ''
      patientSearchBtn.value.hide()
      window.open(url)
    }
    const openList = async(resource, category) => {
      closeAll()
      await nextTick()
      state.resource = resource
      state.category = category
      state.containerLast = 'openList',
      state.containerArgsLast = [resource, category]
      updateToolbar({type: 'list', resource: state.resource, category: state.category})
      state.sort = 'alpha'
      await loadResource(resource, category)
      await nextTick()
      state.showList = true
      state.toolbar = true
      if ($q.screen.lt.sm) {
        state.menuVisible = false
      }
    }
    const openPage = async(id, resource, category) => {
      closeAll()
      await nextTick()
      state.resource = resource
      state.category = category
      state.id = id
      state.containerLast = 'openPage',
      state.containerArgsLast = [id, resource, category]
      updateToolbar({type: 'page', resource: state.resource, category: state.category})
      state.toolbar = true
      state.showPage = true
      if ($q.screen.lt.sm) {
        state.menuVisible = false
      }
    }
    const openPageForm = () => {
      state.openPageForm = true
    }
    const openPageFormComplete = () => {
      state.openPageForm = false
    }
    const openQR = (value) => {
      state.qr_value = value
      state.qr = true
    }
    const openQRReader = () => {
      state.showQRReader = true
    }
    const openSchedule = async() => {
      closeAll()
      state.serviceTypes = await fetchJSON('serviceTypes', state.online)
      state.serviceCategories = await fetchJSON('serviceCategories', state.online)
      await nextTick()
      state.resource = 'appointments'
      state.showSchedule = true
    }
    const refreshApp = () => {
      state.updateExists = false
      // Make sure we only send a 'skip waiting' message if the SW is waiting
      if (!state.registration || !state.registration.waiting) return
      // send message to SW to skip the waiting and activate the new SW
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    const refreshPatient = () => {
      patientDB.get(state.patient).then((doc) => {
        state.patientName = doc.name[0].given[0] + ' ' + doc.name[0].family
        state.patientAge = '' + moment().diff(doc.birthDate, 'years')
        state.patientGender = Case.title(doc.gender)
        if (objectPath.has(doc, 'photo.0.data')) {
          state.patientPhoto = 'data:' + doc.photo[0].contentType + ';base64,' + doc.photo[0].data
        } else {
          state.patientPhoto = ''
        }
        const nickname = doc.name.find(name => name.use === 'nickname')
        if (nickname !== undefined) {
          state.patientNickname = nickname.given[0]
        }
        reloadDrawer('patients')
      }).catch(function (err) {
        console.log(err)
      })
    }
    const reloadComplete = () => {
      state.reload = false
    }
    const reloadDrawer = (resource) => {
      state.drawerResource = resource
      state.drawerReload = true
    }
    const reloadDrawerComplete = () => {
      state.drawerResource = ''
      state.drawerReload = false
    }
    const sortAlpha = () => {
      state.sort = 'alpha'
    }
    const sortDate = () => {
      state.sort = 'date'
    }
    const stopInboxTimer = () => {
      clearInterval(inboxTimer)
      clearInterval(syncTimer)
    }
    const updateInbox = async(user) => {
      const a = [
        {state: 'messages', resource: 'communications'},
        {state: 'tasks', resource: 'tasks'}
      ]
      for (const b of a) {
        const c = await inbox(b.resource, user)
        if (objectPath.has(c, 'docs')) {
          objectPath.set(state, b.state, c.docs.length)
        }
      }
    }
    const updateToolbar = (toolbar) => {
      state.toolbarObject = toolbar
    }
    return {
      addSchemaOptions,
      addPatient,
      checkOnline,
      clearDefault,
      closeAll,
      closeContainer,
      closeForm,
      closeList,
      closePage,
      closePulldown,
      fhirModel,
      fhirReplace,
      fetchJSON,
      focusInput,
      inbox,
      loadDashboard,
      loading,
      loadResource,
      loadSchema,
      loadSelect,
      lockThread,
      openChart,
      openChat,
      openDetail,
      openForm,
      openLink,
      openList,
      openPage,
      openPageForm,
      openPageFormComplete,
      openQR,
      openQRReader,
      openSchedule,
      patientList,
      patientSearch,
      patientSearchBtn,
      refreshApp,
      refreshPatient,
      reloadComplete,
      reloadDrawer,
      reloadDrawerComplete,
      removeTags,
      sortAlpha,
      sortDate,
      stopInboxTimer,
      sync,
      syncAll,
      thread,
      threadEarlier,
      threadLater,
      updateInbox,
      updateToolbar,
      updateUser,
      verifyJWT,
      state
    }
  }
})
</script>
<style scoped lang="scss">
#logo{
  font-family: 'Pacifico', arial, serif;
  font-size: 30px;
  text-shadow: 4px 4px 4px #aaa;
  vertical-align: middle;
}
</style>
