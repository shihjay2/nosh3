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
        <div class="q-pa-md q-gutter-xs">
          <div class="q-gutter-md row justify-center">
            <q-spinner-radio v-if="state.sync_on" color="white" size="1em"/>
            <q-tooltip>Syncing...</q-tooltip>
          </div>
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
        <q-btn-dropdown v-if="state.type == 'mdnosh' && state.user.role !== 'patient'" ref="patientSearchBtn" flat dense rounded no-icon-animation="false" dropdown-icon="search" @show="focusInput">
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
              <q-item clickable @click="openChart(item.item.id)">
                {{ item.item.name }}
              </q-item>
            </div>
          </q-list>
        </q-btn-dropdown>
        <q-btn flat dense round icon="person_add" v-if="state.type == 'mdnosh'" @click="addPatient">
          <q-tooltip>Add Patient</q-tooltip>
        </q-btn>
        <q-btn flat dense round icon="sync" v-if="state.type !== 'mdnosh'" @click="openOIDC('','')">
          <q-badge color="red" floating>{{ state.oidc_count }}</q-badge>
          <q-tooltip>Sync from EPIC or CMS Bluebutton</q-tooltip>
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
            @open-activities="openActivities"
            @open-list="openList"
            @open-page="openPage"
            @open-qr="openQR"
            @open-qr-reader="openQRReader"
            @open-schedule="openSchedule"
            @open-share="openShare"
            @stop-inbox-timer="stopInboxTimer"
            :user="state.user"
            :online="state.online"
            :patient="state.patient"
            :type="state.type"
          />
        </q-btn>
      </q-toolbar>
      <q-toolbar v-if="state.toolbar" class="bg-grey-2 text-primary" inset>
        <QToolbarTemplate
          @addendum-encounter="addendumEncounter"
          @new-prescription="newPrescription"
          @lock-thread="lockThread"
          @open-chat="openChat"
          @open-form="openForm"
          @open-file="openFile"
          @open-immunizationschedule="openImmunizationSchedule"
          @open-list="openList"
          @open-page="openPage"
          @open-page-form="openPageForm"
          @set-composition-section="setCompositionSection"
          @sign-encounter="signEncounter"
          @sort-alpha="sortAlpha"
          @sort-date="sortDate"
          @close-container="closeContainer"
          @clear-sync="clearSync"
          @dump-sync="dumpSync"
          @open-detail="openDetail"
          @clear-all="clearAll"
          @import-all="importAll"
          :toolbar-object="state.toolbarObject"
          :encounter="state.encounter"
          :id="state.id"
          :user="state.user"
          :provider="state.provider"
          :online="state.online"
        />
      </q-toolbar>
    </q-header>
    <q-drawer
      v-model="state.menuVisible"
      show-if-above
      bordered
      :width="250"
      :breakpoint="500"
      class="bg-grey-2"
    >
      <QDrawerTemplate
        v-if="state.showDrawer"
        @open-care-opportunities="openCareOpportunities"
        @open-list="openList"
        @open-page="openPage"
        @open-pulldown="openPulldown"
        @reload-drawer-complete="reloadDrawerComplete"
        @unset="unset"
        :encounter="state.encounter"
        :care_plan_doc="state.careplanDoc"
        :patient="state.patient"
        :patient-doc="state.patientDoc"
        :patient-name="state.patientName"
        :patient-nickname="state.patientNickname"
        :patient-age="state.patientAge"
        :patient-gender="state.patientGender"
        :patient-photo="state.patientPhoto"
        :drawer-reload="state.drawerReload"
        :drawer-resource="state.drawerResource"
        :oidc="state.oidc"
      />
    </q-drawer>
    <q-page-container>
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
        @complete-task="completeTask"
        @loading="loading"
        @lock-thread="lockThread"
        @open-bundle="openBundle"
        @open-bundle-qr="openBundleQR"
        @open-chat="openChat"
        @open-form="openForm"
        @open-file="openFile"
        @open-page="openPage"
        @open-qr="openQR"
        @reload-complete="reloadComplete"
        @remove-oidc="removeOIDC"
        @care-plan="setActiveCarePlan"
        @composition="setActiveComposition"
        @set-composition-section="setCompositionSection"
        :auth="state.auth"
        :online="state.online"
        :couchdb="state.couchdb"
        :pin="state.pin"
        :encounter="state.encounter"
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
        :oidc="state.oidc"
      />
      <QPageTemplate
        v-if="state.showPage"
        @loading="loading"
        @open-graph="openGraph"
        @open-form="openForm"
        @open-page-form-complete="openPageFormComplete"
        @reload-complete="reloadComplete"
        @update-toolbar="updateToolbar"
        @reload-drawer="reloadDrawer"
        @open-list="openList"
        @remove-oidc="removeOIDC"
        @care-plan="setActiveCarePlan"
        @composition="setActiveComposition"
        @new-prescription="newPrescription"
        :auth="state.auth"
        :online="state.online"
        :couchdb="state.couchdb"
        :pin="state.pin"
        :id="state.id"
        :encounter="state.encounter"
        :patient="state.patient"
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
        :oidc="state.oidc"
      />
      <QFileTemplate
        v-if="state.showFile"
        @update-toolbar="updateToolbar"
        @reload-drawer="reloadDrawer"
        @open-detail-complete="openDetailComplete"
        @close-container="closeContainer"
        @loading="loading"
        :auth="state.auth"
        :online="state.online"
        :couchdb="state.couchdb"
        :pin="state.pin"
        :encounter="state.encounter"
        :patient="state.patient"
        :resource="state.resource"
        :category="state.category"
        :id="state.id"
        :open-detail="state.openDetail"
        :doc_class_codes="state.docClassCodes"
        :doc_type_codes="state.docTypeCodes"
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
        :pin="state.pin"
        :encounter="state.encounter"
        :patient="state.patient"
        :resource="state.resource"
        :provider="state.provider"
        :service_types="state.serviceTypes"
        :service_categories="state.serviceCategories"
        :type="state.type"
      />
      <QBundleTemplate
        v-if="state.showBundle"
        @open-bundle="openBundle"
        :doc="state.bundleDoc"
        :resource="state.resource"
        :category="state.category"
        :options="state.bundleOptions"
        :history="state.bundleHistory"
        :online="state.online"
      />
      <QChatTemplate
        v-if="state.showChat"
        @reload-complete="reloadComplete"
        @set-chat-id="setChatID"
        :auth="state.auth"
        :online="state.online"
        :couchdb="state.couchdb"
        :pin="state.pin"
        :id="state.id"
        :patient="state.patient"
        :reload="state.reloadChat"
        :resource="state.resource"
        :category="state.category"
        :user="state.user"
        :base="state.base"
        :schema="state.schema"
        :archive="state.archive"
      />
      <OIDC
        v-if="state.showOIDC"
        @save-oidc="saveOIDC"
        @loading="loading"
        :type="state.oidc_type"
        :name="state.oidc_name"
        :online="state.online"
        :oidc-complete="state.oidc_complete"
        :patient="state.patient"
      />
      <div v-if="state.showTimelineParent" class="q-pa-md">
        <q-input
          ref="qTimeline"
          v-model="state.searchTerm"
          debounce="500"
          label="Search Timeline"
          dense="dense"
        >
          <template v-slot:append>
            <q-icon v-if="state.searchTerm !== ''" name="close" @click="state.searchTerm = ''" class="cursor-pointer" />
            <q-icon name="search" />
          </template>
        </q-input>
        <div v-if="state.searchResults" class="q-pa-md q-gutter-md">
          <q-card v-for="row in state.timeline_filter" :key="row.id" :class="{'bg-negative': row.status == 'inactive'}">
            <q-item>
              <q-item-section top avatar>
                <q-icon color="secondary" :name="row.icon" />
              </q-item-section>
              <q-card-section clickable @click="openTimelineEntry(row.id)">
                <div class="text-subtitle2">{{ row.subtitle }} {{ row.id }}</div>
                <div class="text-h6 text-primary">{{ row.title }}</div>
              </q-card-section>
            </q-item>
            <q-card-section clickable @click="openTimelineEntry(row.id)">
              <q-item v-if="row.style == 'span_no_label'">
                <span v-for="data in row.content" :key="data.key">
                  <QInfoTemplate
                    :data="data"
                    :style="row.style"
                  />
                </span>
              </q-item>
              <div v-else>
                <span v-for="data in row.content" :key="data.key">
                  <QInfoTemplate
                    :data="data"
                    :style="row.style"
                  />
                </span>
              </div>
            </q-card-section>
          </q-card>
        </div>
        <q-card v-if="state.showTimeline" class="q-px-lg q-pb-md">
          <q-timeline color="secondary" layout="dense">
            <q-timeline-entry 
              v-for="row in state.timeline" 
              :key="row.id" 
              :title="row.title" 
              :subtitle="row.subtitle" 
              :icon="row.icon" 
              @click="openTimelineEntry(row.id)">
              <q-item v-if="row.style == 'span_no_label'">
                <span v-for="data in row.content" :key="data.key">
                  <QInfoTemplate
                    :data="data"
                    :style="row.style"
                  />
                </span>
              </q-item>
              <div v-else>
                <span v-for="data in row.content" :key="data.key">
                  <QInfoTemplate
                    :data="data"
                    :style="row.style"
                  />
                </span>
              </div>
            </q-timeline-entry>
          </q-timeline>
        </q-card>
      </div>
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
      :pin="state.pin"
      :id="state.pulldown_id"
      :patient="state.patient"
      :provider="state.provider"
      :practitioner="state.practitioner"
      :user="state.user"
      :encounter="state.encounter"
      :resource="state.pulldown_resource"
      :category="state.pulldown_category"
      :index="state.pulldown_index"
      :default="state.pulldown_defaults"
      :base="state.pulldown_base"
      :schema="state.pulldown_schema"
      :div_content="state.pulldown_divContent"
      :title="state.pulldown_title"
      :doc="state.pulldown_doc"
    />
  </q-dialog>
  <q-dialog v-model="state.showGraph" persistent position="top" full-width full-height seamless>
    <QGraphTemplate
      v-if="state.showGraph"
      @close-graph="closeGraph"
      :patient-name="state.patientName"
      :patient-DOB="state.patientDOB"
      :patient-gender="state.patientGender"
      :type="state.graphType"
      :observation="state.graphObservation"
      :online="state.online"
    />
  </q-dialog>
  <q-dialog v-model="state.showImmunizationSchedule" persistent position="top" full-width full-height seamless>
    <ImmunizationSchedule
      v-if="state.showImmunizationSchedule"
      @close-immunizationschedule="closeImmunizationSchedule"
      :patient="state.patient"
      :patient-DOB="state.patientDOB"
      :online="state.online"
    />
  </q-dialog>
  <q-dialog v-model="state.showCareOpportunities" persistent position="top" full-width full-height seamless>
    <CareOpportunities
      v-if="state.showCareOpportunities"
      @close-care-opportunties="closeCareOpportunities"
      :patient="state.patient"
      :patient-DOB="state.patientDOB"
      :patient-age="state.patientAge"
      :patient-gender="state.patientGender"
      :online="state.online"
    />
  </q-dialog>
  <q-dialog v-model="state.showActivity" persistent position="top" full-width full-height seamless>
    <ActivitiesDialog
      v-if="state.showActivity"
      @close-activities="closeActivities"
    />
  </q-dialog>
  <q-dialog v-model="state.qr">
    <q-card>
      <div class="q-pa-md q-gutter-md">
        <q-card>
          <VueQrious :value="state.qr_value" size="200"></VueQrious>
        </q-card>
      </div>
    </q-card>
  </q-dialog>
  <q-dialog v-model="state.loading">
    <q-spinner color="white" size="md" thickness="5"/>
    <q-tooltip :offset="[0, 8]">Loading...</q-tooltip>
  </q-dialog>
  <q-dialog v-model="state.showPIN">
    <q-card>
      <q-card-section>
        <div class="text-h6 text-center">Enter PIN</div>
      </q-card-section>
      <q-separator />
      <Form @submit="onSubmitPIN">
        <q-card-section>
          <div v-for="field1 in state.schemaPin" :key="field1.id" class="q-pa-sm">
            <QInputWithValidation
              ref="myInput"
              :name="field1.id"
              :label="field1.label"
              :type="field1.type"
              :model="state.formPin[field1.id]"
              @update-model="updateValue"
              :placeholder="field1.placeholder"
              :rules="field1.rules"
              focus="false"
            />
          </div>
        </q-card-section>
        <q-card-section>
          <q-list>
            <q-item>
              <q-item-section avatar>
                <q-avatar color="red" text-color="white" icon="safety_check" />
              </q-item-section>
              <q-item-section>
                The database requires a 4-digit PIN (only known by the patient) for encryption/decryption.
              </q-item-section>
            </q-item>
            <q-item>
              <q-item-section>
                If you are not the patient, please come back later until the login prompt appears.
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn push icon="pin" color="primary" label="Enter PIN" type="submit" />
        </q-card-actions>
      </Form>
    </q-card>
  </q-dialog>
  <q-dialog v-model="state.showTrustee">
    <QTrusteeTemplate 
      @loading="loading"
      :user="state.user"
    />
  </q-dialog>
  <q-dialog v-model="state.showQRReader">
    <QRReader
    />
  </q-dialog>
  <q-dialog v-model="state.showShare">
    <q-card>
      <q-card-section>
        <q-list>
          <q-item clickable @click="openList('bundles', 'MedicationRequest')">
            <q-item-section>
              <q-item-label>Prescriptions to Share</q-item-label>
            </q-item-section>
            <q-item-section avatar>
              <q-icon color="primary" style="font-size: 1.5em" name="medication" />
            </q-item-section>
          </q-item>
          <q-item clickable @click="openList('bundles', 'ServiceRequest')">
            <q-item-section>
              <q-item-label>Orders to Share</q-item-label>
            </q-item-section>
            <q-item-section avatar>
              <q-icon color="primary" style="font-size: 1.5em" name="medical_services" />
            </q-item-section>
          </q-item>
          <q-item clickable @click="openTrustee()">
            <q-item-section>
              <q-item-label>Trustee<q-icon name="fas fa-registered" style="font-size: 0.6em; vertical-align: super;"/> Policies</q-item-label>
            </q-item-section>
            <q-item-section avatar>
              <q-icon color="primary" style="font-size: 1.5em" name="policy" />
            </q-item-section>
          </q-item>
          <q-item clickable @click="openDump()">
            <q-item-section>
              <q-item-label>FHIR Dump</q-item-label>
            </q-item-section>
            <q-item-section avatar>
              <q-icon color="primary" style="font-size: 1.5em" name="local_fire_department" />
            </q-item-section>
          </q-item>
          <q-item clickable @click="loadMarkdown()">
            <q-item-section>
              <q-item-label>Markdown</q-item-label>
            </q-item-section>
            <q-item-section avatar>
              <q-icon color="primary" style="font-size: 1.5em" name="format_indent_decrease" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { common } from '@/logic/common'
import axios from 'axios'
import Case from 'case'
import ActivitiesDialog from '@/components/ActivitiesDialog.vue'
import CareOpportunities from '@/components/CareOpportunities.vue'
import { Form } from 'vee-validate'
import Fuse from 'fuse.js'
import ImmunizationSchedule from '@/components/ImmunizationSchedule.vue'
import json2md from 'json2md'
import moment from 'moment'
import objectPath from 'object-path'
import OIDC from '@/components/OIDC.vue'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb-browser'
import QBundleTemplate from '@/components/QBundleTemplate.vue'
import QChatTemplate from '@/components/QChatTemplate.vue'
import QDrawerTemplate from '@/components/QDrawerTemplate.vue'
import QFileTemplate from '@/components/QFileTemplate.vue'
import QFormTemplate from '@/components/QFormTemplate.vue'
import QGraphTemplate from '@/components/QGraphTemplate.vue'
import QInfoTemplate from '@/components/QInfoTemplate.vue'
import QInputWithValidation from '@/components/QInputWithValidation.vue'
import QListTemplate from '@/components/QListTemplate.vue'
import QMenuTemplate from '@/components/QMenuTemplate.vue'
import QPageTemplate from '@/components/QPageTemplate.vue'
import QRReader from '@/components/QRReader.vue'
import QScheduleTemplate from '@/components/QScheduleTemplate.vue'
import QTrusteeTemplate from '@/components/QTrusteeTemplate.vue'
import QToolbarTemplate from '@/components/QToolbarTemplate.vue'
import { useAuthStore } from '@/stores'
import { useRoute } from 'vue-router'
import {v4 as uuidv4} from 'uuid'
import { VOffline } from 'v-offline'
import VueQrious from 'vue-qrious'
import * as PouchDBFind from 'pouchdb-find'
import download from 'downloadjs'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'HomeView',
  components: {
    ActivitiesDialog,
    CareOpportunities,
    Form,
    ImmunizationSchedule,
    OIDC,
    QBundleTemplate,
    QChatTemplate,
    QDrawerTemplate,
    QFormTemplate,
    QFileTemplate,
    QGraphTemplate,
    QInfoTemplate,
    QInputWithValidation,
    QListTemplate,
    QMenuTemplate,
    QPageTemplate,
    QRReader,
    QScheduleTemplate,
    QToolbarTemplate,
    QTrusteeTemplate,
    VOffline,
    VueQrious
},
  setup () {
    const $q = useQuasar()
    const { addSchemaOptions, bundleBuild, divBuild, fetchJSON, fhirModel, fhirReplace, inbox, loadSchema, loadSelect, observationStatusRaw, patientList, referenceSearch, removeTags, sync, syncAll, syncSome, thread, threadEarlier, threadLater, updateUser, verifyJWT } = common()
    const state = reactive({
      menuVisible: false,
      showDrawer: false,
      showMenu: false,
      drawerReload: false,
      drawerResource: '',
      toolbar: false,
      loading: false,
      online: true,
      type: '',
      toolbarObject: {},
      timeline: [],
      subresource: '',
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
      pulldown_divContent: '',
      pulldown_index: '',
      pulldown_id: '',
      pulldown_title: '',
      pulldown_doc: {},
      // form and Lists
      showChat: false,
      showForm: false,
      showList: false,
      showPage: false,
      showFile: false,
      showSchedule: false,
      showBundle: false,
      showGraph: false,
      showTimeline: false,
      showTimelineParent: false,
      showTrustee: false,
      showCareOpportunities:false,
      showActivity: false,
      searchResults: false,
      searchTerm: '',
      timeline_filter: [],
      sort: 'alpha',
      within_page: false,
      openPageForm: false,
      pageType: '',
      // patient defaults
      encounter: '',
      id: '',
      patient: '',
      patientDoc: {},
      patientName: '',
      patientAge: '',
      patientGender: '',
      patientPhoto: '',
      patientDOB: '',
      patientNickname: '',
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
      showImmunizationSchedule: false,
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
      // care_plans
      options: [],
      careplan: false,
      careplanDoc: {},
      outcomeTypes: [],
      // compositions
      compositionDoc: {},
      // bundles
      bundleDoc: {},
      bundleHistory: [],
      bundleOptions: [],
      // service_requests
      service_request_doc: {},
      // communications
      archive: false,
      // graph
      graphObservation: '',
      graphType: '',
      // oidc
      showOIDC: false,
      oidc: [],
      oidc_type: '',
      oidc_name: '',
      oidc_complete: false,
      oidc_count: 0,
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
      showQRReader: false,
      // share
      showShare: false,
      // sync
      sync_on: false,
      showPIN: false,
      formPin: {},
      schemaPin: [
        {
          "id": "pin",
          "label": "4-digit PIN",
          "model": "pin",
          "type": "password",
          "mask": "####",
          "rules": "required"
        }
      ]
    })
    const route = useRoute()
    const auth = useAuthStore()
    const patientSearch = ref(null)
    const patientSearchBtn = ref(null)
    const qTimeline = ref(null)
    // autoupdate pwa
    window.addEventListener('swUpdated', (event) => {
      state.registration = event.detail
      console.log(state.registration)
      state.updateExists = true
    }, { once: true })
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (state.refreshing) return
      state.refreshing = true
      // Here the actual reload of the page occurs
      // const user1 = JSON.parse(localStorage.getItem('user'))
      // const jwt = localStorage.getItem('jwt')
      // const type = localStorage.getItem('type')
      // const auth = localStorage.getItem('auth')
      // const couchdb = localStorage.getItem('couchdb')
      // const api = JSON.parse(localStorage.getItem('api'))
      // const pin = localStorage.getItem('pin')
      // const instance = localStorage.getItem('instance')
      // const trustee = localStorage.getItem('trustee')
      // const gnap_jwt = localStorage.getItem('gnap_jwt')
      // const prefix1 = localStorage.getItem('prefix')
      window.localStorage.clear()
      // localStorage.setItem('user', JSON.stringify(user1))
      // localStorage.setItem('jwt', jwt)
      // localStorage.setItem('type', type)
      // localStorage.setItem('auth', auth)
      // localStorage.setItem('couchdb', couchdb)
      // localStorage.setItem('api', JSON.stringify(api))
      // localStorage.setItem('pin', pin)
      // localStorage.setItem('instance', instance)
      // localStorage.setItem('trustee', trustee)
      // localStorage.setItem('gnap_jwt', gnap_jwt)
      // localStorage.setItem('prefix', prefix1)
      window.location.reload()
    })
    var prefix = auth.prefix
    var patientDB = new PouchDB(prefix + 'patients')
    var inboxTimer = null
    var syncTimer = null
    var syncallTimer = null
    var pinTimer = null
    onMounted(async() => {
      try {
        await verifyJWT(state.online)
      } catch(e) {
        auth.setMessage('jwt not valid')
        auth.returnUrl = route.fullPath
        return auth.logout()
      }
      state.type = auth.type
      state.auth = {fetch: (url, opts) => {
        opts.headers.set('Authorization', 'Bearer ' + auth.jwt)
        return PouchDB.fetch(url, opts)
      }}
      state.default_med_category = 'outpatient'
      state.couchdb = auth.couchdb
      state.pin = auth.pin
      const userDB = new PouchDB(prefix + 'users')
      try {
        var user = await userDB.get(auth.user.id)
      } catch (e) {
        auth.setMessage('user not found; prefix: ' + prefix + '; userid: ' + auth.user.id)
        auth.returnUrl = route.fullPath
        return auth.logout()
      }
      var user_arr = user.reference.split('/')
      if (user_arr[0] == 'Practitioner') {
        state.provider = true
      }
      state.patientList = await patientList(user)
      if (route.params.id !== 'new') {
        try {
          const result = await patientDB.find({selector: {_id: {$eq: route.params.id}}})
          if (result.docs.length > 0) {
            state.patient = result.docs[0].id
            auth.setPatient(state.patient)
            await refreshPatient(false)
            state.showDrawer = true
            state.showMenu = true
            var chart = {
              name: removeTags(result.docs[0].text.div),
              url: location.protocol + '//' + location.host + location.pathname,
              id: result.docs[0].id,
              date: moment().unix()
            }
            state.user = await updateUser(user, 'charts', chart)
            if (route.query.encounter !== undefined) {
              openPage(route.query.encounter, 'encounters', 'subjective')
            } else if (route.query.oidc !== undefined) {
              openOIDC(route.query.oidc, localStorage.getItem('oidc_name'))
            } else {
              state.showTimelineParent = true
              state.showTimeline = true
              if (auth.oidc !== null) {
                state.oidc = auth.oidc
              }
            }
          } else {
            if (prefix === '') {
              state.menuVisible = false
              openForm('add', 'patients', 'new')
            } else {
              auth.setMessage('wrong patient')
              auth.returnUrl = route.fullPath
              return auth.logout()
            }
          }
        } catch (e) {
          auth.setMessage('no patient')
          auth.returnUrl = route.fullPath
          return auth.logout()
        }
      } else {
        state.menuVisible = false
        openForm('add', 'patients', 'new')
      }
      nextTick(() => {
        qTimeline.value.focus()
      })
      await syncProcess()
      inboxTimer = setInterval(async() => {
        await updateInbox(user)
        console.log('Inbox updated')
      }, 5000)
      syncTimer = setInterval(async() => {
        if (state.online) {
          if (!state.sync_on) {
            state.sync_on = true
            await syncSome(state.online, state.patient)
            state.drawerReload = true
            state.sync_on = false
            if (state.showTimeline) {
              await loadTimeline()
              nextTick(() => {
                qTimeline.value.focus()
              })
            }
          }
        }
      }, 15000)
      syncallTimer = setInterval(async() => {
        await syncProcess()
      }, 600000)
      if (auth.instance === 'digitalocean' && auth.type === 'pnosh') {
        pinTimer = setInterval(async() => {
          await pinCheck()
          console.log('PIN Checked')
        }, 10000)
      }
    })
    watch(() => state.showTimeline, async(newVal) => {
      if (newVal) {
        await loadTimeline()
        nextTick(() => {
          qTimeline.value.focus()
        })
      }
    })
    watch(() => state.searchTerm, async(newVal) => {
      if (newVal !== '') {
        searchTimeline(newVal)
      } else {
        state.searchResults = false
        state.showTimeline = true
        await loadTimeline()
      }
    })
    watch(() => state.patientsearch, async(newVal) => {
      if (newVal !== '') {
        state.patientList = await patientList(state.user)
        const keys = ['name', 'id']
        const fuse = new Fuse(state.patientList, {keys: keys, includeScore: true})
        state.patientListSearch = fuse.search(newVal)
      }
    })
    watch(() => state.user, async(newVal) => {
      if (newVal) {
        await sync('users', false, state.patient, true, newVal)
      }
    })
    const addendumEncounter = async() => {
      var id = state.bundleDoc.entry[0].resource.encounter.reference.split('/').slice(-1).join('')
      closeAll()
      await nextTick()
      state.resource = 'encounters'
      state.category = 'subjective'
      state.id = id
      state.encounter = id
      $q.notify({
        message: 'The Encounter with ID ' + id + ' is now active in the workspace!',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
      state.containerLast = 'openPage',
      state.containerArgsLast = [id, state.resource, state.category]
      updateToolbar({type: 'page', resource: state.resource, category: state.category})
      state.toolbar = true
      state.showPage = true
      if ($q.screen.lt.sm) {
        state.menuVisible = false
      }
    }
    const addPatient = () => {
      window.open(window.location.origin + '/app/chart/new')
    }
    const checkOnline = (e) => {
      state.online = e
    }
    const clearAll = async() => {
      state.loading = true
      var resources = await fetchJSON('resources', state.online)
      for (var a of resources.rows) {
        if (a.resource !== 'patients' && a.resource !== 'users') {
          await sync(a.resource, true, state.patient, false, {}, true)
          reloadDrawer(a.resource)
        }
      }
      clearSync()
      state.loading = false
      $q.notify({
        message: 'Entire chart is cleared!',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const clearDefault = () => {
      state.default = {}
    }
    const clearSync = () => {
      state.oidc = []
      auth.clearOIDC()
    }
    const closeActivities = () => {
      state.showActivity = false
    }
    const closeAll = () => {
      state.showBundle = false
      state.showChat = false
      state.showForm = false
      state.showFile = false
      state.showForm = false
      state.showList = false
      state.showPage = false
      state.showSchedule = false
      state.showTimelineParent = false
      state.showTimeline = false
      state.showOIDC = false
      state.searchResults = false
      state.toolbar = false
      state.id = ''
      state.divContent = ''
      state.search = []
      state.bundleDoc = {}
      state.bundleHistory = []
      state.bundleOptions = []
    }
    const closeCareOpportunities = () => {
      state.showCareOpportunities = false
    }
    const closeContainer = async() => {
      if (state.showPage == true) {
        closeAll()
        if (state.resource == 'practitioners' || state.resource == 'related_persons') {
          openList(state.resource, 'all')
        } else if (state.resource == 'patients') {
          await refreshPatient()
          state.showTimelineParent = true
          state.showTimeline = true
        } else {
          state.showTimelineParent = true
          state.showTimeline = true
        }
      } else if (state.showList == true) {
        closeAll()
        if (state.resource == 'related_persons') {
          openPage(state.patient, 'patients', 'identity')
        }
        state.showTimelineParent = true
        state.showTimeline = true
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
          state.showTimelineParent = true
          state.showTimeline = true
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
          if (state.resource == 'compositions') {
            if (state.user.reference === doc.author[0].reference) {
              const encounterDB = new PouchDB(prefix + 'encounters')
              var encounter = await encounterDB.get(doc.encounter.reference.split('/').slice(-1).join(''))
              var unsigned = {
                name: encounter.reasonCode[0].text,
                url: location.protocol + '//' + location.host + location.pathname + '?encounter=' + encounter.id,
                id: encounter.id,
                date: moment().unix()
              }
              state.user = await updateUser(state.user, 'unsigned', unsigned)
            }
          }
          state.id = id
        }
        if (state.resource == 'patients') {
          await refreshPatient()
        }
        if (id !== '') {
          openPage(id, state.resource, state.category)
        }
      } else if (state.resource == 'medication_statements' && id !== '' && state.new_medication_request === true) {
        var a = await import('@/assets/fhir/medication_requests.json')
        var doc1 = a.fhir
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
        var div = removeTags(doc.text.div)
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
    const closeGraph = () => {
      state.showGraph = false
    }
    const closeImmunizationSchedule = () => {
      state.showImmunizationSchedule = false
    }
    const closeList = () => {
      state.showList = false
      state.showTimelineParent = true
      state.showTimeline = true
    }
    const closePage = () => {
      state.showPage = false
      state.showTimelineParent = true
      state.showTimeline = true
    }
    const closePulldown = async(id = '') => {
      state.pulldown_title = ''
      state.pulldown_id = id
      state.pulldown_resource = ''
      state.pulldown_category = ''
      state.pulldown_divContent = ''
      state.pulldown_base = {}
      state.pulldown_schema = {}
      state.pulldown_defaults = {}
      state.pulldown_doc = {}
      await refreshPatient(true)
      state.pulldown_form = false
    }
    const completeTask = async(id) => {
      const localDB = new PouchDB(prefix + 'tasks')
      var a = await localDB.get(id)
      objectPath.set(a, 'status', 'completed')
      await sync('tasks', false, state.patient, true, a)
      $q.notify({
        message: 'Task marked as completed!',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const dumpSync = () => {
      const bundleDoc = {}
      const id = 'nosh_' + uuidv4()
      const time = moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      var entries = []
      objectPath.set(bundleDoc, 'resourceType', 'Bundle')
      objectPath.set(bundleDoc, 'id', id)
      objectPath.set(bundleDoc, '_id', id)
      objectPath.set(bundleDoc, 'type', 'collection')
      objectPath.set(bundleDoc, 'timestamp', time)
      for (var a in state.oidc) {
        if (objectPath.has(state, 'oidc.' + a + '.docs')) {
          for (var b of state.oidc[a].docs) {
            for (var c of b.rows) {
              var entry = {}
              objectPath.set(entry, 'resource', c)
              entries.push(entry)
            }
          }
        }
      }
      objectPath.set(bundleDoc, 'entry', entries)
      download(JSON.stringify(bundleDoc, null, 2), 'fhir_bundle.json', 'application/json')
    }
    const focusInput = async() => {
      await nextTick()
      patientSearch.value.focus()
    }
    const importAll = async() => {
      for (var a in state.oidc) {
        if (objectPath.has(state, 'oidc.' + a + '.docs')) {
          for (var row of state.oidc[a].docs) {
            if (objectPath.has(row, 'rows')) {
              for (var doc of row.rows) {
                if (row.resource !== 'practitioners' && row.resource !== 'related_persons') {
                  const id = 'nosh_' + uuidv4()
                  objectPath.set(doc, 'sync_id', objectPath.get(doc, 'id'))
                  objectPath.set(doc, 'id', id)
                  objectPath.set(doc, '_id', id)
                  if (row.resource === 'observations') {
                    if (!objectPath.has(doc, 'effectivePeriod.start')) {
                      objectPath.set(doc, 'effectivePeriod.start', objectPath.get(doc, 'effectiveDateTime'))
                    }
                    if (objectPath.has(doc, 'performer.0.reference')) {
                      if (objectPath.get(doc, 'performer.0.reference').search('Practitioner') === 0) {
                        const nosh_id = await referenceSearch('practitioners', objectPath.get(doc, 'performer.0.reference').split('/').slice(-1).join(''))
                        if (nosh_id === null) {
                          const reference_new_id = await importReference('practitioners', objectPath.get(doc, 'performer.0.reference').split('/').slice(-1).join(''), state.oidc[a].origin)
                          objectPath.set(doc, 'performer.0.reference', 'Practitioner/' + reference_new_id)
                        } else {
                          objectPath.set(doc, 'performer.0.reference', 'Practitioner/' + nosh_id)
                        }
                      }
                    }
                  }
                  if (row.resource === 'encounters') {
                    if (objectPath.has(doc, 'participant')) {
                      for (var a in objectPath.get(doc, 'participant')) {
                        if (objectPath.get(doc, 'participant.' + a + '.individual.reference').search('Practitioner') === 0) {
                          const nosh_id1 = await referenceSearch('practitioners', objectPath.get(doc, 'participant.' + a + '.individual.reference').split('/').slice(-1).join(''))
                          if (nosh_id1 === null) {
                            const reference_new_id1 = await importReference('practitioners', objectPath.get(doc, 'participant.' + a + '.individual.reference').split('/').slice(-1).join(''), state.oidc[a].origin)
                            objectPath.set(doc, 'participant.' + a + '.individual.reference', 'Practitioner/' + reference_new_id1)
                          } else {
                            objectPath.set(doc, 'participant.' + a + '.individual.reference', 'Practitioner/' + nosh_id1)
                          }
                        }
                      }
                    }
                  }
                  if (row.resource === 'immunizations' ||
                      row.resource === 'allergy_intolerances' ||
                      row.resource === 'related_persons') {
                    objectPath.set(doc, 'patient.reference', 'Patient/' + state.patient)
                  } else if (row.resource === 'tasks') {
                    objectPath.set(doc, 'for.reference', 'Patient/' + state.patient)
                  } else {
                    if (row.resource !== 'practitioners' &&
                        row.resource !== 'organizations' &&
                        row.resource !== 'appointments' &&
                        row.resource !== 'users' &&
                        row.resource !== 'patients') {
                      objectPath.set(doc, 'subject.reference', 'Patient/' + state.patient)
                    }
                  }
                  await sync(row.resource, false, state.patient, true, doc)
                  reloadDrawer(row.resource)
                }
              }
            }
          }
        }
      }
      clearSync()
      $q.notify({
        message: 'All synced external resources have been imported!',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const importReference = async(resource, reference_id, origin) => {
      const a = state.oidc.findIndex(b => b.origin == origin)
      const c = state.oidc[a].docs.findIndex(d => d.resource == resource)
      const e = state.oidc[a].docs[c].rows.findIndex(f => f.id == reference_id)
      if (e !== -1) {
        var reference_doc = objectPath.get(state, 'oidc.' + a + '.docs.' + c + '.rows.' + e)
        const reference_new_id = 'nosh_' + uuidv4()
        objectPath.set(reference_doc, 'sync_id', objectPath.get(reference_doc, 'id'))
        objectPath.set(reference_doc, 'id', reference_new_id)
        objectPath.set(reference_doc, '_id', reference_new_id)
        if (!objectPath.has(reference_doc, 'text.div')) {
          reference_doc = await divBuild(resource, reference_doc)
        }
        await sync(resource, false, state.patient, true, reference_doc)
        removeOIDC(e, resource, origin)
        return reference_new_id
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
      state.base = await import('@/assets/fhir/' + resource + '.json')
      if (category === 'all') {
        state.schema = state.base.uiSchema
        state.divContent = state.base.divContent
        state.search = state.base.uiSearchBars
      } else {
        if (resource === 'observations' || resource === 'service_requests') {
          var sub = state.base.categories.find(o => o.value === category)
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
      var resource_obj = await loadSchema(resource, category, state.schema, state.online, state.options)
      state.schema = resource_obj.schema
      state.options = resource_obj.options
      state.states = resource_obj.states
      state.countries = resource_obj.countries
      state.select = resource_obj.select
      state.loading = false
    }
    const loadMarkdown = () => {
      const mdjs = []
      for (var row of state.timeline) {
        const ul_arr = []
        if (row.id !== 'intro') {
          mdjs.push({h3: Case.title(pluralize.singular(row.resource)) + ' Details'})
          ul_arr.push('**Date**: ' + moment(row.date).format('MMMM DD, YYYY'))
          ul_arr.push('**' + Case.title(pluralize.singular(row.resource)) + '**: ' + row.title)
        } else {
          mdjs.push({h3: 'Patient Information'})
        }
        for (var data of row.content) {
          if (row.style === 'p') {
            ul_arr.push('**' + data.key + '**: ' + data.value)
          }
          if (row.style === 'list') {
            ul_arr.push('**Display**: ' + data)
          }
        }
        mdjs.push({ul: ul_arr})
      }
      download(json2md(mdjs), 'nosh_timeline_' + Date.now() + '.md', 'text/markdown')
    }
    const loadTimeline = async() => {
      state.loading = true
      state.timeline = []
      var resources = ['encounters', 'conditions', 'medication_statements', 'immunizations', 'allergy_intolerances', 'document_references']
      var drawer = []
      var json = await import('@/assets/ui/drawer.json')
      drawer = json.rows
      var timeline = []
      for (var resource of resources) {
        var base = await import('@/assets/fhir/' + resource + '.json')
        var resource1 = drawer.find(item => item.resource === resource)
        var title = 'New ' + Case.title(pluralize.singular(resource))
        if (resource !== 'encounters') {
          var schema = base.uiSchema.flat()
        } else {
          var schema = base.new.uiSchema.flat()
        }
        if (resource === 'immunizations') {
          state.actSites = await fetchJSON('actSites', state.online)
          schema = addSchemaOptions('site', state.actSites.concept[0].concept[0].concept, 'code', 'display', schema)
        }
        if (resource === 'medication_statements') {
          state.doseform = await fetchJSON('doseform', state.online)
          state.routes = await fetchJSON('routes', state.online)
          schema = addSchemaOptions('doseUnit', state.doseform.concept, 'code', 'display', schema)
          schema = addSchemaOptions('route', state.routes, 'code', 'desc', schema)
        }
        if (resource === 'encounters') {
          state.serviceTypes = await fetchJSON('serviceTypes', state.online)
          schema = addSchemaOptions('serviceType', state.serviceTypes, 'Code', 'Display', schema)
          state.encounterTypes = await fetchJSON('encounterTypes', state.online)
          schema = addSchemaOptions('type', state.encounterTypes, 'Code', 'Display', schema)
          schema = await loadSelect('practitioners', 'participant', schema)
        }
        if (resource === 'document_references') {
          state.docTypeCodes = await fetchJSON('docTypeCodes', state.online)
          state.docClassCodes = await fetchJSON('docClassCodes', state.online)
          schema = addSchemaOptions('type', state.docTypeCodes, 'Code', 'Display', schema)
          schema = addSchemaOptions('category', state.docClassCodes, 'Code', 'Display', schema)
        }
        const db = new PouchDB(prefix + resource)
        try {
          const result = await db.find({selector: {[base.patientField]: {$eq: 'Patient/' + state.patient }, _id: {"$gte": null}}})
          for (var a in result.docs) {
            var timelineItem = {}
            objectPath.set(timelineItem, 'id', objectPath.get(result, 'docs.' + a + '.id'))
            objectPath.set(timelineItem, 'title', fhirReplace('title', base, result.docs[a], schema))
            objectPath.set(timelineItem, 'subtitle', objectPath.get(result, 'docs.' + a + '.' + base.timelineDate) + ', ' + title)
            objectPath.set(timelineItem, 'content', fhirReplace('content', base, result.docs[a], schema))
            objectPath.set(timelineItem, 'extended', fhirReplace('extended', base, result.docs[a], schema))
            objectPath.set(timelineItem, 'status', fhirReplace('status', base, result.docs[a], schema))
            objectPath.set(timelineItem, 'date', new Date(objectPath.get(result, 'docs.' + a + '.' + base.timelineDate)))
            objectPath.set(timelineItem, 'icon', resource1.icon)
            objectPath.set(timelineItem, 'resource', resource)
            objectPath.set(timelineItem, 'doc', objectPath.get(result, 'docs.' + a))
            objectPath.set(timelineItem, 'keys', base.fuse)
            objectPath.set(timelineItem, 'style', base.uiListContent.contentStyle)
            if (resource === 'encounters') {
              const bundle_db = new PouchDB(prefix + 'bundles')
              const bundle_result = await bundle_db.find({selector: {'entry': {"$elemMatch": {"resource.encounter.reference": 'Encounter/' + objectPath.get(result, 'docs.' + a + '.doc.id')}}, _id: {"$gte": null}}})
              if (bundle_result.docs.length > 0) {
                bundle_result.docs.sort((a1, b1) => moment(b1.timestamp) - moment(a1.timestamp))
                var history = []
                for (var b in bundle_result.docs) {
                  if (!objectPath.has(timelineItem, 'bundle')) {
                    objectPath.set(timelineItem, 'bundle', objectPath.get(bundle_result, 'docs.' + b))
                    history.push(objectPath.get(bundle_result, 'docs.' + b))
                  } else {
                    history.push(objectPath.get(bundle_result, 'docs.' + b))
                  }
                }
                objectPath.set(timelineItem, 'bundle_history', history)
              }
            }
            timeline.push(timelineItem)
          }
        } catch (err) {
          console.log(err)
        }
      }
      const activitiesDb = new PouchDB(prefix + 'activities')
      const activitiesResult = await activitiesDb.find({selector: {event: {$eq: 'Chart Created' }, _id: {"$gte": null}}})
      const timelineIntro = {
        id: 'intro',
        title: 'New Chart Created',
        subtitle: 'Timeline Starts Here',
        icon: 'celebration',
        date: null,
        content: [
          {key: 'Name', value: state.patientName},
          {key: 'Date of Birth', value: state.patientDOB},
          {key: 'Gender', value: state.patientGender}
        ],
        style: 'p'
      }
      if (activitiesResult.docs.length > 0) {
        objectPath.set(timelineIntro, 'subtitle', moment(activitiesResult.docs[0].datetime).format("YYYY-MM-DD"))
        objectPath.set(timelineIntro, 'date', new Date(activitiesResult.docs[0].datetime))
        timeline.push(timelineIntro)
      }
      timeline.sort((c, d) => d.date - c.date)
      if (activitiesResult.docs.length == 0) {
        timeline.push(timelineIntro)
      }
      state.timeline = timeline
      state.loading = false
    }
    const lockThread = async(id) => {
      const localDB = new PouchDB(prefix + 'communications')
      var a = await localDB.get(id)
      arr = await thread(a, state.online, state.patient)
      for (var b in arr) {
        objectPath.set(arr, b + '.status', 'completed')
        await localDB.put(arr[b])
      }
      await sync('communications', false, state.patient, false)
      $q.notify({
        message: 'Message thread is now locked!',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const newPrescription = () => {
      state.new_medication_request = true
      openForm('add', 'medication_statements', 'all')
    }
    const onSubmitPIN = async(values) => {
      const { pin } = values
      const result = await axios.post(window.location.origin + '/auth/pinSet', {pin: pin, patient: state.patient})
      if (result.data.response === 'OK') {
        state.showPIN = false
        state.login = true
      } else {
        $q.notify({
          message: result.data.response,
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const openActivities = async() => {
      state.showActivity = true
    }
    const openBundle = async(resource, doc, history) => {
      closeAll()
      await nextTick()
      state.resource = resource
      state.bundleDoc = doc
      state.bundleHistory = history
      for (var a in history) {
        var b = {
          value: a,
          label: history[a].timestamp
        }
        if (doc.timestamp === history[a].timestamp) {
          b.label += ' - Current'
        }
        state.bundleOptions.push(b)
      }
      state.category = 'all'
      updateToolbar({type: 'bundle', resource: state.resource, category: state.category})
      state.toolbar = true
      state.showBundle = true
    }
    const openBundleQR = async(id) => {
      const location = window.location.origin + '/fhir/api/' + state.patient + '/Bundle/' + id
      const body = {type: 'Bundles', location: location, patient: state.patient, token: auth.gnap_jwt}
      const doc_id = 'nosh_' + uuidv4()
      try {
        const token = await axios.post(window.location.origin + '/auth/gnapProxy', body)
        const doc = {token, location, _id: doc_id}
        await sync('presentations', false, state.patient, true, doc)
        const value = window.location.origin + '/presentation/' + state.patient + '/' + doc_id
        state.qr_value = value
        state.qr = true
      } catch (e) {
        console.log(e)
      }
    }
    const openCareOpportunities = () => {
      state.showCareOpportunities = true
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
      updateToolbar({type: 'chat', resource: state.resource, status: status})
      state.toolbar = true
      state.showChat = true
    }
    const openDetail = () => {
      state.openDetail = true
    }
    const openDetailComplete = () => {
      state.openDetail = false
    }
    const openDump = async() => {
      const resources = await fetchJSON('resources', state.online)
      const bundleDoc = {}
      const id = 'nosh_' + uuidv4()
      const time = moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      var entries = []
      objectPath.set(bundleDoc, 'resourceType', 'Bundle')
      objectPath.set(bundleDoc, 'id', id)
      objectPath.set(bundleDoc, '_id', id)
      objectPath.set(bundleDoc, 'type', 'collection')
      objectPath.set(bundleDoc, 'timestamp', time)
      for (var resource of resources.rows) {
        const db = new PouchDB(prefix + resource.resource)
        const result = await db.allDocs({
          include_docs: true,
          attachments: true,
          startkey: 'nosh_'
        })
        if (result.rows.length > 0) {
          for (var a of result.rows) {
            var entry = {}
            objectPath.set(entry, 'resource', a.doc)
            entries.push(entry)
          }
        }
      }
      console.log(entries)
      objectPath.set(bundleDoc, 'entry', entries)
      download(JSON.stringify(bundleDoc, null, 2), 'fhir_bundle.json', 'application/json')
    }
    const openFile = async(id, resource, category = 'all', index = '') => {
      closeAll()
      state.docTypeCodes = await fetchJSON('docTypeCodes', state.online)
      state.docClassCodes = await fetchJSON('docClassCodes', state.online)
      await nextTick()
      state.id = id
      state.resource = resource
      state.category = category
      if (id == 'add') {
        updateToolbar({type: 'file', resource: state.resource, category: state.category, action: 'Add'})
      } else {
        updateToolbar({type: 'file', resource: state.resource, category: state.category, action: 'Edit'})
      }
      state.toolbar = true
      state.index = index
      state.showFile = true
      if ($q.screen.lt.sm) {
        state.menuVisible = false
      }
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
      if (resource === 'document_references') {
        state.showFile = true
      } else {
        state.showForm = true
      }
      state.toolbar = true
      if ($q.screen.lt.sm) {
        state.menuVisible = false
      }
    }
    const openGraph = (type, observation) => {
      state.graphType = type
      state.graphObservation = observation
      state.showGraph = true
    }
    const openImmunizationSchedule = () => {
      state.showImmunizationSchedule = true
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
    const openOIDC = (type, name) => {
      closeAll()
      state.oidc_type = type
      state.oidc_name = name
      updateToolbar({type: 'oidc'})
      state.toolbar = true
      state.showOIDC = true
    }
    const openPage = async(id, resource, category) => {
      closeAll()
      await nextTick()
      state.resource = resource
      state.category = category
      state.id = id
      if (state.resource == 'encounters') {
        const a = new PouchDB(prefix + 'bundles')
        const results = await a.find({selector: {'entry.0.resource.encounter.reference': {$eq: 'Encounter/' + id}, _id: {"$gte": null}}})
        if (results.length > 0) {
          results.docs.sort((b, c) => moment(c.timestamp) - moment(b.timestamp))
          state.bundleDoc = objectPath.get(results, '0.docs.0')
          state.showBundle = true
          state.resource = 'bundles'
          state.category = 'all'
          state.id = objectPath.get(results, '0.docs.0.id')
          state.containerLast = 'openPage',
          state.containerArgsLast = [state.id, state.resource, state.category]
          updateToolbar({type: 'page', resource: state.resource, category: state.category})
          state.toolbar = true
          state.showBundle = true
          if ($q.screen.lt.sm) {
            state.menuVisible = false
          }
        } else {
          // unsigned encounter
          state.encounter = id
          $q.notify({
            message: 'The Encounter with ID ' + id + ' is now active in the workspace!',
            color: 'primary',
            actions: [
              { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
            ]
          })
          state.containerLast = 'openPage',
          state.containerArgsLast = [id, resource, category]
          updateToolbar({type: 'page', resource: state.resource, category: state.category})
          state.toolbar = true
          state.showPage = true
          if ($q.screen.lt.sm) {
            state.menuVisible = false
          }
        }
      } else {
        state.containerLast = 'openPage',
        state.containerArgsLast = [id, resource, category]
        updateToolbar({type: 'page', resource: state.resource, category: state.category})
        state.toolbar = true
        state.showPage = true
        if ($q.screen.lt.sm) {
          state.menuVisible = false
        }
      }
    }
    const openPageForm = () => {
      state.openPageForm = true
    }
    const openPageFormComplete = () => {
      state.openPageForm = false
    }
    const openPulldown = async(type) => {
      state.pulldown_id = 'nosh_' + uuidv4()
      if (type === 'pregnancy' || type === 'tobacco') {
        state.pulldown_doc = {
          "_id": state.pulldown_id,
          "resourceType": "Observation",
          "id": state.pulldown_id,
          "status": "final",
          "category": [
            {
              "coding": [
                {
                  "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                  "code": "social-history",
                  "display": "Social History"
                }
              ],
              "text": "Social History"
            }
          ],
          "subject": {
            "reference": "Patient/" + state.patient
          },
          "performer": [
            {
              "reference": state.user.reference
            }
          ],
          "effectivePeriod": {
            "start": moment().format("YYYY-MM-DD HH:mm")
          },
          "text": {
            "status": "generated",
            "div": ""
          },
          "code": {
            "coding": [
              {
                "code": "",
                "display": "",
                "system": "http://loinc.org"
              }
            ]
          }
        }
        state.pulldown_resource = 'observations'
        state.pulldown_base = await import('@/assets/fhir/observations.json')
        if (type === 'pregnancy') {
          objectPath.set(state, 'pulldown_doc.code.coding.0.code', '82810-3')
          objectPath.set(state, 'pulldown_doc.code.coding.0.display', 'Pregnancy Status')
          state.pulldown_category = 'pregnancy'
          state.pulldown_title = 'Set Pregnancy Status'
        }
        if (type === 'tobacco') {
          objectPath.set(state, 'pulldown_doc.code.coding.0.code', '72166-2')
          objectPath.set(state, 'pulldown_doc.code.coding.0.display', 'Tobacco Smoking Status')
          state.pulldown_category = 'tobacco'
          state.pulldown_title = 'Set Smoking Status'
        }
        var sub = state.pulldown_base.categories.find(o => o.value === state.pulldown_category)
        state.pulldown_schema = sub.uiSchema
        var old_val = await observationStatusRaw(type, state.patient)
        if (objectPath.has(old_val, 'code')) {
          state.pulldown_defaults = {
            value: old_val.code
          }
        }
      }
      state.pulldown_form = true
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
    const openShare = () => {
      state.showShare = true
    }
    const openTimelineEntry = async(id) => {
      if (id !== 'intro') {
        var b = state.timeline.find(a => a.id == id)
        if (b.resource === 'encounters') {
          if (objectPath.has(b, 'bundle')) {
            openBundle('bundles', b.bundle, b.bundle_history)
          } else {
            await loadResource(b.resource, 'all')
            openPage(id, b.resource, 'subjective')
          }
        }
      }
    }
    const openTrustee = async() => {
      state.showTrustee = true
    }
    const pinCheck = async() => {
      var check = await axios.post(window.location.origin + '/auth/pinCheck', {patient: state.patient})
      if (check.data.response === 'Error') {
        state.loading = false
        state.showPIN = true
      }
      if (check.data.response === 'Forbidden') {
        state.login = false
        $q.notify({
          message: 'Invalid URL - forbidden',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const refreshApp = () => {
      state.updateExists = false
      // Make sure we only send a 'skip waiting' message if the SW is waiting
      if (!state.registration || !state.registration.waiting) return
      // send message to SW to skip the waiting and activate the new SW
      state.registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    const refreshPatient = async(drawer = true) => {
      var doc = await patientDB.get(state.patient)
      state.patientDoc = doc
      state.patientName = doc.name[0].given[0] + ' ' + doc.name[0].family
      state.patientAge = '' + moment().diff(doc.birthDate, 'years')
      state.patientGender = Case.title(doc.gender)
      state.patientDOB = doc.birthDate
      if (objectPath.has(doc, 'photo.0.data')) {
        state.patientPhoto = 'data:' + doc.photo[0].contentType + ';base64,' + doc.photo[0].data
      } else {
        state.patientPhoto = ''
      }
      var nickname = doc.name.find(name => name.use === 'nickname')
      if (nickname !== undefined) {
        state.patientNickname = nickname.given[0]
      }
      if (drawer === true) {
        reloadDrawer('patients')
      }
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
    const saveOIDC = (doc) => {
      if (!Array.isArray(state.oidc)) {
        state.oidc = []
        auth.clearOIDC()
      }
      state.oidc.push(doc)
      auth.setOIDC(state.oidc)
      var complete = false
      if (localStorage.getItem("oidc_access_token") !== null) {
        complete = true
      }
      localStorage.removeItem('oidc')
      localStorage.removeItem('oidc_url')
      localStorage.removeItem('oidc_state')
      localStorage.removeItem('oidc_name')
      localStorage.removeItem('oidc_response')
      localStorage.removeItem('oidc_access_token')
      localStorage.removeItem('oidc_refresh_token')
      localStorage.removeItem('oidc_patient_token')
      localStorage.removeItem('oidc_patient')
      if (complete) {
        state.oidc_complete = true
      } else {
        $q.notify({
        message: 'Synthetic Records Synced - ready for import',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
      }
    }
    const setActiveCarePlan = (doc) => {
      state.careplanDoc = doc
      $q.notify({
        message: 'The Care Plan for ' + doc.contained[0].code.coding[0].display + ' is now active in the workspace!',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const removeOIDC = (index, resource, origin) => {
      var a = state.oidc.findIndex(b => b.origin == origin)
      var c = state.oidc[a].docs.findIndex(d => d.resource == resource)
      objectPath.del(state, 'oidc.' + a + '.docs.' + c + '.rows.' + index)
      auth.setOIDC(state.oidc)
    }
    const setActiveComposition = (doc) => {
      state.compositionDoc = doc
    }
    const setCompositionSection = async(resource) => {
      if (objectPath.has(state, 'compositionDoc.id')) {
        var doc = state.compositionDoc
        var section = {}
        var text = ''
        var sections_arr = []
        const a = new PouchDB(prefix + resource)
        var b = await import('@/assets/fhir/' + resource + '.json')
        const result = await a.find({selector: {[b.activeField]: {$ne: 'inactive'}, _id: {"$gte": null}}})
        text = '<ul>'
        for (var c in result.docs) {
          text += '<li>' + removeTags(result.docs[c].text.div) + '</li>'
        }
        text += '</ul>'
        text = '<div xmlns="http://www.w3.org/1999/xhtml">' + text + '</div>'
        objectPath.set(section, 'text.div', text)
        objectPath.set(section, 'coding.coding.0.system', 'http://loinc.org')
        objectPath.set(section, 'text.status', 'generated')
        var sections = await fetchJSON('compSection', state.online)
        for (var d in sections) {
          if (sections[d].Code !== undefined) {
            sections_arr.push(sections[d])
          }
        }
        var f = sections_arr.find(e => e.resource === resource)
        objectPath.set(section, 'coding.coding.0.code', f.Code)
        objectPath.set(section, 'coding.coding.0.display', f.Display)
        objectPath.set(section, 'title', f.Display)
        objectPath.set(section, 'author.0.reference', state.user.reference)
        objectPath.set(section, 'author.0.display', state.user.display)
        var g = doc.section.findIndex((h) => h.title === f.Display)
        if (g !== -1) {
          doc.section.splice(g,1)
        }
        doc.section.push(section)
        await sync('compositions', false, state.patient, true, doc)
        const h = new PouchDB(prefix + 'compositions')
        var doc1 = await h.get(doc.id)
        state.compositionDoc = doc1
        $q.notify({
          message: 'The ' + Case.capital(resource) + ' are now acknowledged in the encounter.',
          color: 'primary',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const searchTimeline = (searchTerm) => {
      var resources = ['encounters', 'conditions', 'medication_statements', 'immunizations', 'allergy_intolerances', 'document_references']
      var arr2 = []
      var arr3 = []
      state.timeline_filter = []
      for (var resource of resources) {
        var arr = state.timeline.filter(a => a.resource === resource)
        if (arr.length > 0) {
          var all_keys = require('all-object-keys')
          var keys = all_keys(arr[0])
          var arr1 = []
          var keys1 = []
          for (var b in arr) {
            if (resource === 'encounters') {
              if (objectPath.has(arr[b], 'bundle')) {
                arr3.push({encounter_id: arr[b].id, doc: arr[b].bundle, keys: all_keys(arr[b].bundle)})
                keys1.push(all_keys(arr[b].bundle))
              } else {
                arr1.push(arr[b])
              }
            } else {
              arr1.push(arr[b])
            }
          }
          const fuse = new Fuse(arr1, {keys: keys, includeScore: true})
          const result = fuse.search(searchTerm)
          const shortresult = result.slice(0,20)
          for (var i in shortresult) {
            var j = {}
            j.id = result[i].item.id
            j.score = result[i].score
            arr2.push(j)
          }
          var keys2 = [...new Set(keys1)]
          const fuse1 = new Fuse(arr3, {keys: keys2, includeScore: true})
          const result1 = fuse1.search(searchTerm)
          const shortresult1 = result1.slice(0,20)
          for (var k in shortresult1) {
            var l = {}
            l.id = result1[k].item.id
            l.score = result1[k].score
            arr2.push(j)
          }
        }
      }
      arr2.sort((k, l) => l.score - k.score)
      for (var m in arr2) {
        state.timeline_filter.push(state.timeline.find(n => n.id === arr2[m].id))
      }
      state.searchResults = true
      state.showTimeline = false
    }
    const setChatID = (id) => {
      state.id = id
    }
    const signEncounter = async() => {
      var resources = ['compositions', 'observations', 'care_plans']
      var entries = []
      var references = []
      var bundleDoc = {}
      var id = 'nosh_' + uuidv4()
      var time = moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      objectPath.set(bundleDoc, 'resourceType', 'Bundle')
      objectPath.set(bundleDoc, 'id', id)
      objectPath.set(bundleDoc, '_id', id)
      objectPath.set(bundleDoc, 'type', 'document')
      objectPath.set(bundleDoc, 'timestamp', time)
      objectPath.set(bundleDoc, 'signature.when', time)
      objectPath.set(bundleDoc, 'signature.type.0.system', 'urn:iso-astm:E1762-95:2013')
      objectPath.set(bundleDoc, 'signature.type.0.code', '1.2.840.10065.1.12.1.1')
      objectPath.set(bundleDoc, 'signature.type.0.display', "Author's Signature")
      // objectPath.set(bundleDoc, 'sigFormat', 'image/jpg')
      objectPath.set(bundleDoc, 'sigFormat', 'application/jws')
      objectPath.set(bundleDoc, 'data', 'ewogICJhbGciOiAiUlMyNTYiLAogICJraWQiOiAiMTMzNzQ3MTQxMjU1IiwKICAiaWF0IjogMCwKICAiaXNzIjogIkM9R0IsIEw9TG9uZG9uLCBPVT1OdWFwYXkgQVBJLCBPPU51YXBheSwgQ049eWJvcXlheTkycSIsCiAgImI2NCI6IGZhbHNlLAogICJjcml0IjogWwogICAgImlhdCIsCiAgICAiaXNzIiwKICAgICJiNjQiCiAgXQp9..d_cZ46lwNiaFHAu_saC-Zz4rSzNbevWirO94EmBlbOwkB1L78vGbAnNjUsmFSU7t_HhL-cyMiQUDyRWswsEnlDljJsRi8s8ft48ipy2SMuZrjPpyYYMgink8nZZK7l-eFJcTiS9ZWezAAXF_IJFXSTO5ax9z6xty3zTNPNMV9W7aH8fEAvbUIiueOhH5xNHcsuqlOGygKdFz2rbjTGffoE_6zS4Dry-uX5mts2duLorobUimGsdlUcSM6P6vZEtcXaJCdjrT9tuFMh4CkX9nqk19Bq2z3i-SX4JCPvhD2r3ghRmX0gG08UcvyFVbrnVZJnpl4MU8V4Nr3-2M5URZOg')
      var base = ''
      for (var resource of resources) {
        base = await import('@/assets/fhir/' + resource + '.json')
        const db = new PouchDB(prefix + resource)
        const results = await db.find({selector: {[base.indexField]: {$eq: [base.indexRoot] + '/' + state.encounter}, _id: {"$gte": null}}})
        for (var a in results.docs) {
          var resource1 = Case.snake(pluralize(results.docs[a].resourceType))
          var item = {}
          var entry = {}
          if (resource1 !== 'observations') {
            item = base.uiSchema.flat().find((b) => b.id === base.activeField)
          } else {
            item = base.categories[0].uiSchema.flat().find((b) => b.id === base.activeField)
          }
          if (resource1 === 'compositions') {
            var subject = {}
            objectPath.set(subject, 'resource', Case.snake(pluralize(results.docs[a].subject.reference.split('/').slice(0,-1).join(''))))
            objectPath.set(subject, 'id', results.docs[a].subject.reference.split('/').slice(-1).join(''))
            references.push(subject)
            for (var c in results.docs[a].author) {
              var author = {}
              objectPath.set(author, 'resource', Case.snake(pluralize(results.docs[a].author[c].reference.split('/').slice(0,-1).join(''))))
              objectPath.set(author, 'id', results.docs[a].author[c].reference.split('/').slice(-1).join(''))
              references.push(author)
            }
            var encounter = {}
            objectPath.set(encounter, 'resource', Case.snake(pluralize(results.docs[a].encounter.reference.split('/').slice(0,-1).join(''))))
            objectPath.set(encounter, 'id', results.docs[a].encounter.reference.split('/').slice(-1).join(''))
            references.push(encounter)
          }
          if (resource1 === 'care_plans') {
            for (var d in results.docs[a].activity) {
              var activity = {}
              objectPath.set(activity, 'resource', Case.snake(pluralize(results.docs[a].activity[d].reference.split('/').slice(0,-1).join(''))))
              objectPath.set(activity, 'id', results.docs[a].activity[d].reference.split('/').slice(-1).join(''))
              references.push(activity)
            }
            for (var d1 in results.docs[a].addresses) {
              var addresses = {}
              objectPath.set(addresses, 'resource', Case.snake(pluralize(results.docs[a].addresses[d1].reference.split('/').slice(0,-1).join(''))))
              objectPath.set(addresses, 'id', results.docs[a].addresses[d1].reference.split('/').slice(-1).join(''))
              references.push(addresses)
            }
            for (var e in results.docs[a].author) {
              var author1 = {}
              objectPath.set(author1, 'resource', Case.snake(pluralize(results.docs[a].author[e].reference.split('/').slice(0,-1).join(''))))
              objectPath.set(author1, 'id', results.docs[a].author[e].reference.split('/').slice(-1).join(''))
              var e2 = references.findIndex(e1 => {return e1.id == author1.id && e1.resource == author1.resource})
              if (e2 == -1) {
                references.push(author1)
              }
            }
          }
          if (resource1 === 'observations') {
            for (var f in results.docs[a].performer) {
              var performer = {}
              objectPath.set(performer, 'resource', Case.snake(pluralize(results.docs[a].performer[f].reference.split('/').slice(0,-1).join(''))))
              objectPath.set(performer, 'id', results.docs[a].performer[f].reference.split('/').slice(-1).join(''))
              var f2 = references.findIndex(f1 => {return f1.id == performer.id && f1.resource == performer.resource})
              if (f2 == -1) {
                references.push(performer)
              }
            }
          }
          var doc = results.docs[a]
          objectPath.set(doc, item.model, base.finalStatus)
          await sync(resource1, false, state.patient, true, doc)
          objectPath.set(entry, 'resource', doc)
          entries.push(entry)
        }
      }
      for (var reference of references) {
        const db1 = new PouchDB(prefix + reference.resource)
        var results1 = await db1.get(reference.id)
        entries.push({resource: results1})
      }
      objectPath.set(bundleDoc, 'entry', entries)
      await sync('bundles', false, state.couchdb, state.auth, state.pin, state.patient, true, bundleDoc)
      // remove from unsigned
      var h = state.user.unsigned.map(g => g.id).indexOf(state.encounter)
      if (h !== -1) {
        state.user.unsigned.splice(h, 1)
        // await sync('users', state.online, state.couchdb, state.auth, state.pin, true, state.user)
        auth.update(state.user)
      }
      $q.notify({
        message: 'Encounter signed!',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
      openList('encounters', 'new')
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
      clearInterval(pinTimer)
      clearInterval(syncallTimer)
    }
    const syncProcess = async() => {
      if (state.online) {
        if (!state.sync_on) {
          state.sync_on = true
          await syncAll(true, state.patient, true)
          state.drawerReload = true
          state.sync_on = false
          if (state.showTimeline) {
            await loadTimeline()
            nextTick(() => {
              qTimeline.value.focus()
            })
          }
        }
      }
    }
    const unset = (type) => {
      if (type == 'encounters') {
        var a = state.encounter
        state.encounter = ''
        state.careplanDoc = {}
        state.compositionDoc = {}
        if (state.showPage == true && state.resource == 'encounters') {
          closeAll()
        }
        $q.notify({
          message: 'The Encounter with ID ' + a + ' is now unset from the workspace!',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      } else {
        var b = state.careplanDoc
        state.careplanDoc = {}
        $q.notify({
          message: 'The Care Plan for ' + b.contained[0].code.coding[0].display + ' is now unset from the workspace!',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const updateInbox = async(user) => {
      var a = [
        {state: 'messages', resource: 'communications'},
        {state: 'tasks', resource: 'tasks'}
      ]
      for (var b of a) {
        var c = await inbox(b.resource, user)
        if (objectPath.has(c, 'docs')) {
          objectPath.set(state, b.state, c.docs.length)
        }
      }
      var oidc = 0
      if (Array.isArray(state.oidc)) {
        if (state.oidc.length > 0) {
          for (var d of state.oidc) {
            if (d.docs.length > 0) {
              for (var e of d.docs) {
                if (objectPath.has(e, 'rows')) {
                  if (e.rows.length > 0) {
                    oidc = oidc + e.rows.length
                  }
                }
              }
            }
          }
        }
      }
      state.oidc_count = oidc
    }
    const updateToolbar = (toolbar) => {
      state.toolbarObject = toolbar
    }
    const updateValue = (val, field, type) => {
      state.formPin[field] = val
    }
    return {
      addendumEncounter,
      addPatient,
      addSchemaOptions,
      checkOnline,
      clearAll,
      clearDefault,
      clearSync,
      closeActivities,
      closeAll,
      closeCareOpportunities,
      closeContainer,
      closeForm,
      closeGraph,
      closeImmunizationSchedule,
      closeList,
      closePage,
      closePulldown,
      completeTask,
      dumpSync,
      fhirModel,
      fhirReplace,
      fetchJSON,
      focusInput,
      importAll,
      importReference,
      inbox,
      loading,
      loadResource,
      loadSchema,
      loadSelect,
      loadMarkdown,
      loadTimeline,
      lockThread,
      newPrescription,
      onSubmitPIN,
      openActivities,
      openBundle,
      openBundleQR,
      openCareOpportunities,
      openChart,
      openChat,
      openDetail,
      openDetailComplete,
      openDump,
      openFile,
      openForm,
      openGraph,
      openImmunizationSchedule,
      openLink,
      openList,
      openOIDC,
      openPage,
      openPageForm,
      openPageFormComplete,
      openPulldown,
      openQR,
      openQRReader,
      openSchedule,
      openShare,
      openTimelineEntry,
      openTrustee,
      patientList,
      patientSearch,
      patientSearchBtn,
      pinCheck,
      qTimeline,
      refreshApp,
      refreshPatient,
      reloadComplete,
      reloadDrawer,
      reloadDrawerComplete,
      removeOIDC,
      removeTags,
      saveOIDC,
      setActiveCarePlan,
      setActiveComposition,
      setCompositionSection,
      searchTimeline,
      setChatID,
      signEncounter,
      sortAlpha,
      sortDate,
      stopInboxTimer,
      sync,
      syncAll,
      syncProcess,
      thread,
      threadEarlier,
      threadLater,
      unset,
      updateInbox,
      updateToolbar,
      updateUser,
      updateValue,
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
