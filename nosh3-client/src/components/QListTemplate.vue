<template>
  <div :class="state.within_page">
    <q-select
      v-if="state.select"
      v-model="state.selected"
      :label="state.selectLabel"
      name="selected"
      ref="qRefSelect"
      :options="qOptions"
      @filter="filterFn"
      use-input
      outlined
      dense="dense"
    >
      <template v-slot:no-option>
        <q-item>
          <q-item-section class="text-grey">
            No results
          </q-item-section>
        </q-item>
      </template>
    </q-select>
    <q-card v-for="(row, index) in state.rows" :key="row.id" :class="{'bg-negative': row.status == 'inactive'}">
      <q-item v-if="row.oidc">
        <q-card-section>
          <div class="text-h6 text-primary">{{ row.title }}</div>
          <div class="text-subtitle2">{{ row.subhead }}</div>
          <q-chip icon="local_fire_department" color="red" text-color="white">Import from {{ row.oidc }}</q-chip>
        </q-card-section>
      </q-item>
      <q-item v-else clickable @click="onFormOpen(row.id)">
        <q-card-section>
          <div class="text-h6 text-primary">{{ row.title }}</div>
          <div class="text-subtitle2">{{ row.subhead }}</div>
          <q-chip v-if="row.author === 'patients'" icon="face" color="teal" text-color="white">Patient Submitted</q-chip>
        </q-card-section>
        <q-item-section v-if="row.lock" avatar>
          <q-icon :color="row.lock_color" :name="row.lock_icon" />
        </q-item-section>
      </q-item>
      <q-card-section v-if="row.oidc">
        <q-item v-if="state.base.uiListContent.contentStyle == 'span_no_label'">
          <span v-for="data in row.content" :key="data.key">
            <QInfoTemplate
              :data="data"
              :style="state.base.uiListContent.contentStyle"
            />
          </span>
        </q-item>
        <div v-else>
          <span v-for="data in row.content" :key="data.key">
            <QInfoTemplate
              :data="data"
              :style="state.base.uiListContent.contentStyle"
            />
          </span>
        </div>
      </q-card-section>
      <q-card-section v-else clickable @click="onFormOpen(row.id)">
        <q-item v-if="state.base.uiListContent.contentStyle == 'span_no_label'">
          <span v-for="data in row.content" :key="data.key">
            <QInfoTemplate
              :data="data"
              :style="state.base.uiListContent.contentStyle"
            />
          </span>
        </q-item>
        <div v-else>
          <span v-for="data in row.content" :key="data.key">
            <QInfoTemplate
              :data="data"
              :style="state.base.uiListContent.contentStyle"
            />
          </span>
        </div>
      </q-card-section>
      <div v-if="row.section">
        <q-list v-for="(row0, index0) in row.section" :key="row0.id">
          <q-item clickable>
            <q-item-section avatar>
              <q-icon color="primary" :name="row0.icon" />
            </q-item-section>
            <q-item-section @click="openSection(index0)">
              <q-item-label>{{ row0.title }}</q-item-label>
              <q-item-label caption><span v-html="row0.text"></span></q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-icon color="red" name="delete" @click="removeSection(row.doc, index0, index)"/>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
      <div v-if="row.activity">
        <q-list v-for="(row1, index1) in row.activity" :key="row1.id">
          <q-item clickable>
            <q-item-section avatar>
              <q-icon color="primary" :name="row1.icon" />
            </q-item-section>
            <q-item-section @click="openActivity(row.id, index1)">
              <q-item-label>{{ row1.label }}</q-item-label>
              <q-item-label caption>{{ row1.progress }}{{ row1.outcome }}</q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-icon color="red" name="delete" @click="removeActivity(row.doc, index1, index)"/>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
      <q-card-section v-if="row.careplan">
        <q-item>
          <div class="text-h6 text-teal">Recent Care Plan</div>
        </q-item>
        <q-list>
          <q-item>
            <q-item-section>
              <q-item-label>Description</q-item-label>
              <q-item-label caption>{{ row.careplan.description }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-item-label>Date</q-item-label>
              <q-item-label caption>{{ row.careplan.created }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <q-list v-for="row2 in row.careplan.activity" :key="row2.id">
          <q-item>
            <q-item-section avatar>
              <q-icon color="primary" :name="row2.icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ row2.label }}</q-item-label>
              <q-item-label caption>{{ row2.progress }}{{ row2.outcome }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-expansion-item v-if="row.extended !== '' && row.extended !== undefined && row.extended !== 'undefined'">
        <q-card>
          <q-card-section>{{ row.extended }}</q-card-section>
        </q-card>
      </q-expansion-item>
      <q-separator />
      <q-card-actions align="right">
        <q-btn v-if="state.resource === 'care_plans'" flat round color="red" icon="star" clickable @click="setActiveCarePlan(row.doc)">
          <q-tooltip>Set as Active Care Plan</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'care_plans'" flat round color="primary" icon="medication" clickable @click="newPrescription(row.doc)">
          <q-tooltip>Medication Request</q-tooltip>
        </q-btn>
        <div v-if="state.resource === 'service_requests'">
          <q-btn-dropdown flat round color="primary" icon="subscriptions">
            <q-list>
              <q-item clickable v-close-popup @click="setNew(row.doc, 'service_requests', '108252007')">
                <q-item-section>
                  <q-item-label>Laboratory</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="setNew(row.doc, 'service_requests', '363679005')">
                <q-item-section>
                  <q-item-label>Imaging</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="setNew(row.doc, 'service_requests', '409063005')">
                <q-item-section>
                  <q-item-label>Counseling</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="setNew(row.doc, 'service_requests', '409073007')">
                <q-item-section>
                  <q-item-label>Education</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="setNew(row.doc, 'service_requests', '387713003')">
                <q-item-section>
                  <q-item-label>Surgical Procedure</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
          <q-tooltip>Add New Service Request</q-tooltip>
        </div>
        <q-btn v-if="state.resource === 'conditions' && state.encounter !== '' && state.provider" flat round color="teal" icon="shortcut" clickable @click="setDiagnosis(row.doc)">
          <q-tooltip>Set as Encounter Diagnosis</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'conditions' && row.history" flat round color="teal" icon="history" clickable @click="openHistory(row.history)">
          <q-tooltip>Care Plan History</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'conditions' && row.status == 'Active'" flat round color="red" icon="cancel" clickable @click="inactivateRow(row.doc)">
          <q-tooltip>Inactivate Condition</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'conditions' && row.status == 'Inactive'" flat round color="teal" icon="replay" clickable @click="reactivateRow(row.doc)">
          <q-tooltip>Reactivate Condition</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'medication_statements' && state.encounter !== '' && state.provider" flat round color="teal" icon="shortcut" clickable @click="setActivity(row.doc)">
          <q-tooltip>Add to Care Plan (Continue Medication)</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'medication_statements' && state.encounter !== '' && state.provider" flat round color="teal" icon="medication" clickable @click="setPrescription(row.doc)">
          <q-tooltip>Medication Refill</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'medication_statements' && row.history" flat round color="teal" icon="history" clickable @click="openHistory(row.history)">
          <q-tooltip>Medication Refill History</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'medication_statements' && row.status == 'Active'" flat round color="red" icon="cancel" clickable @click="inactivateRow(row.doc)">
          <q-tooltip>Discontinue Medication</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'medication_statements' && row.status !== 'Active'" flat round color="teal" icon="replay" clickable @click="reactivateRow(row.doc)">
          <q-tooltip>Reactivate Medication</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'allergy_intolerances' && row.status == 'Active'" flat round color="red" icon="cancel" clickable @click="inactivateRow(row.doc)">
          <q-tooltip>Inactivate Allergy</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'allergy_intolerances' && row.status == 'Inactive'" flat round color="teal" icon="replay" clickable @click="reactivateRow(row.doc)">
          <q-tooltip>Reactivate Allergy</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'service_requests' && state.careplan_active && state.provider" flat round color="teal" icon="shortcut" clickable @click="setActivity(row.doc)">
          <q-tooltip>Add to Care Plan (Service Pending)</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'document_references' && state.provider" flat round color="teal" icon="shortcut" clickable @click="setEncounter(row.doc)">
          <q-tooltip>Add to Encounter</q-tooltip>
        </q-btn>
        <q-btn v-if="state.add_user && row.magic_link" flat round color="teal" icon="qr_code_2" clickable @click="openQR()">
          <q-tooltip>Share QR Code</q-tooltip>
        </q-btn>
        <q-btn v-if="state.add_user && row.add_user" flat round color="teal" icon="person_add" clickable @click="setUser(row.doc)">
          <q-tooltip>Create User</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'communications' && row.doc.status === 'in-progress'" flat round color="teal" icon="approval" clickable @click="lockThread(row.id)">
          <q-tooltip>Lock Thread</q-tooltip>
        </q-btn>
        <q-btn v-if="state.resource === 'tasks' && row.doc.status === 'in-progress'" flat round color="teal" icon="approval" clickable @click="completeTask(row.id)">
          <q-tooltip>Lock Thread</q-tooltip>
        </q-btn>
        <q-btn v-if="row.author === 'patients' && state.provider" flat round color="teal" icon="thumb_up_alt" clickable @click="attestRow(row.doc)">
          <q-tooltip>Attest</q-tooltip>
        </q-btn>
        <q-btn v-if="row.oidc" flat round color="teal" icon="import_export" clickable @click="importRow(row.doc, row.id, row.oidc)">
          <q-tooltip>Import</q-tooltip>
        </q-btn>
        <q-btn v-if="row.oidc" flat round color="red" icon="delete" clickable @click="deleteOIDCRow(row.id, row.oidc)">
          <q-tooltip>Delete</q-tooltip>
        </q-btn>
        <q-btn v-if="row.delete === 'y'" flat round color="red" icon="delete" clickable @click="deleteRow(row.doc, index)">
          <q-tooltip>Delete</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>
  </div>
  <img v-scroll-fire="setCompositionSection"/>
  <q-dialog v-model="state.dialogActivity" persistent>
    <QFormTemplate
      v-if="state.dialogActivity"
      @care-plan="setActiveCarePlan"
      @close-form="closeActivity"
      @loading="loading"
      :auth="state.auth"
      :online="state.online"
      :couchdb="state.couchdb"
      :pin="state.pin"
      :id="state.activity_id"
      :patient="state.patient"
      :provider="state.provider"
      :practitioner="state.practitioner"
      :user="state.user"
      :encounter="state.encounter"
      :resource="state.activity_resource"
      :category="state.activity_category"
      :index="state.activity_index"
      :base="state.base"
      :schema="state.activity_schema"
      :div_content="state.activity_divContent"
      :search="state.activity_search"
      :care_plan_doc="state.careplanDoc"
      :preview="state.preview"
    />
  </q-dialog>
  <q-dialog v-model="state.dialogSection" persistent>
    <QFormTemplate
      v-if="state.dialogSection"
      @composition="setActiveComposition"
      @close-form="closeSection"
      @loading="loading"
      :auth="state.auth"
      :id="state.section_id"
      :patient="state.patient"
      :provider="state.provider"
      :practitioner="state.practitioner"
      :user="state.user"
      :encounter="state.encounter"
      :resource="state.section_resource"
      :category="state.section_category"
      :index="state.section_index"
      :base="state.base"
      :schema="state.section_schema"
      :div_content="state.section_divContent"
      :search="state.section_search"
      :preview="state.preview"
      :default="state.section_default"
    />
  </q-dialog>
  <q-dialog v-model="state.dialogHistory" full-width>
    <div>
      <q-card v-for="row3 in state.history" :key="row3.id">
        <q-expansion-item :label="row3.created">
          <q-list>
            <q-item>
              <q-item-section>
                <q-item-label>Description</q-item-label>
                <q-item-label caption>{{ row3.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <q-list v-for="row4 in row3.activity" :key="row4.id">
            <q-item>
              <q-item-section avatar>
                <q-icon color="primary" :name="row4.icon" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ row4.label }}</q-item-label>
                <q-item-label caption>{{ row4.progress }}{{ row4.outcome }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
      </q-card>
    </div>
  </q-dialog>
</template>

<script>
import { defineComponent, reactive, ref, nextTick, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import { firstBy } from 'thenby'
import Case from 'case'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb-browser'
import QFormTemplate from './QFormTemplate.vue'
import QInfoTemplate from './QInfoTemplate.vue'
import { useAuthStore } from '@/stores'
import { useQuasar } from 'quasar'
import {v4 as uuidv4} from 'uuid'
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'QListTemplate',
  components: {
    QFormTemplate,
    QInfoTemplate
  },
  props: {
    auth: Object,
    online: Boolean,
    couchdb: String,
    pin: String,
    encounter: String,
    patient: String,
    provider: Boolean,
    practitioner: String,
    user: Object,
    resource: String,
    category: String,
    reload: Boolean,
    sort: String,
    base: Object,
    schema: Object,
    within_page: Boolean,
    options: Array,
    care_plan_doc: Object,
    composition_doc: Object,
    oidc: {
      type: Array,
      default: function () { return []}
    }
  },
  emits: ['care-plan', 'complete-task', 'composition', 'loading', 'lock-thread', 'new-prescription', 'open-bundle', 'open-chat', 'open-form', 'open-file', 'open-page', 'open-qr', 'reload-complete', 'remove-oidc', 'set-composition-section'],
  setup (props, { emit }) {
    const $q = useQuasar()
    const { addSchemaOptions, eventAdd, fetchJSON, fhirModel, fhirReplace, groupItems, inbox, loadSelect, removeTags, sync } = common()
    const state = reactive({
      auth: {},
      online: false,
      couchdb: '',
      pin: '',
      base: {},
      pageOpen: false,
      title: '',
      schema: {},
      rows: [],
      result: [],
      patient: '',
      encounter: '',
      resource: '',
      careplan_active: false,
      provider: false,
      user: {},
      within_page: 'q-pa-md q-gutter-md',
      select: false,
      selectLabel: '',
      selected: '',
      dialogHistory: false,
      history: [],
      // care_plans
      dialogActivity: false,
      careplanDoc: {},
      resources: [],
      activity_id: '',
      activity_index: '',
      activity_schema: {},
      activity_search: [],
      activity_resource: '',
      activity_category: '',
      activity_divContent: '',
      // compositions
      dialogSection: false,
      compositionDoc: {},
      section_id: '',
      section_index: '',
      section_schema: {},
      section_search: [],
      section_resource: '',
      section_category: '',
      section_divContent: '',
      section_default: {},
    })
    const auth = useAuthStore()
    var prefix = ''
    if (auth.instance === 'digitalocean' && auth.type === 'pnosh') {
      prefix = auth.patient + '_'
    }
    var localDB = new PouchDB(prefix + props.resource)
    var localDB1 = new PouchDB(prefix + 'care_plans')
    var localDB2 = new PouchDB(prefix + 'compositions')
    var localDB3 = new PouchDB(prefix + 'bundles')
    var localDB4 = new PouchDB(prefix + 'medication_requests')
    var localDB5 = new PouchDB(prefix + 'users')
    onMounted(async() => {
      state.auth = props.auth
      state.online = props.online
      state.couchdb = props.couchdb
      state.pin = props.pin
      state.base = props.base
      state.schema = props.schema
      state.title = Case.title(props.resource)
      state.user = props.user
      state.careplanDoc = props.care_plan_doc
      state.compositionDoc = props.composition_doc
      state.patient = props.patient
      state.encounter = props.encounters
      state.provider = props.provider
      state.resource = props.resource
      var resources = await fetchJSON('resources', props.online)
      state.resources = resources.rows
      if (props.resource === 'care_plans') {
        state.select = true
        state.selectLabel = 'Add'
        state.activity_schema = state.base.activity.uiSchema
        state.activity_search = state.base.activity.uiSearchBars
        state.activity_resource = 'care_plans'
        state.activity_category = 'activity'
        state.activity_divContent = state.base.divContent
        state.preview = false
      }
      if (props.resource === 'compositions') {
        state.select = true
        state.selectLabel = 'Add'
        state.section_schema = state.base.section.uiSchema
        state.section_search = state.base.section.uiSearchBars
        state.section_resource = 'compositions'
        state.section_category = 'section'
        state.section_divContent = state.base.divContent
        state.preview = false
      }
      if (props.resource === 'service_requests' || props.resource === 'tasks') {
        state.select = true
        state.selectLabel = 'Filter'
      }
      if (props.resource === 'medication_statements' ||
          props.resource === 'allergy_intolerances' ||
          props.resource === 'conditions') {
        state.select = true
        state.selectLabel = 'Filter'
      }
      if (props.within_page == true) {
        state.within_page = 'q-gutter-md'
      }
      if (typeof state.base.pageOpen !== 'undefined') {
        state.pageOpen = state.base.pageOpen
      }
      if (objectPath.has(props, 'careplanDoc.resource')) {
        state.careplan_active = true
      }
      if (props.resource == 'patients' ||
          props.resource == 'practitioners' ||
          props.resource == 'related_persons') {
        state.add_user = true
      }
      await loadList()
    })
    watch(() => props.encounter, (newVal) => {
      state.encounter = newVal
    })
    watch(() => props.care_plan_doc, (newVal) => {
      if (objectPath.has(newVal, 'resource')) {
        state.careplanDoc = newVal
        state.careplan_active = true 
      } else {
        state.careplanDoc = {}
        state.careplan_active = false
      }
    })
    watch(() => props.reload, async(newVal) => {
      if (newVal) {
        console.log('reload list')
        await loadList()
        emit('reload-complete')
      }
    })
    watch(() => props.sort, (newVal) => {
      if (newVal) {
        if (newVal == 'date') {
          sortDate()
        }
        if (newVal == 'alpha') {
          sortTitle()
        }
      }
    })
    watch(() => state.selected, (newVal) => {
      if (newVal !== '') {
        onSelect(newVal.value, newVal.resource, newVal.doc)
        state.selected = ''
      }
    })
    watch(() => props.oidc, (newVal) => {
      if (newVal !== '') {
        reloadList()
      }
    })
    const filterFn = (val, update) => {
      update(() => {
        const needle = val.toLocaleLowerCase()
        qOptions.value = props.options.filter(v => v['label'].toLocaleLowerCase().indexOf(needle) > -1)
      })
    }
    const attestRow = async(doc) => {
      objectPath.set(doc, '')
      if (props.resource === 'conditions' ||
          props.resource === 'allergy_intolerances') {
        objectPath.set(doc, 'asserter.reference', props.user.reference)
      }
      if (props.resource === 'medication_statements') {
        objectPath.set(doc, 'informationSource.reference', props.user.reference)
      }
      await sync(props.resource, false, props.patient, true, doc)
      await reloadList()
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource.replace('_statements', '')) + ' has been marked as confirmed.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const checkUser = async(rows) => {
      for (var a in rows) {
        // check if email exists
        var add_user = true
        var magic_link = false
        if (objectPath.has(rows, a + '.doc.telecom')) {
          var email = rows[a].doc.telecom.find((a) => a.system === 'email')
          if (email !== undefined) {
            // check if user exists
            var result_users = await localDB5.find({
              selector: {'email': {$eq: email.value}, _id: {"$gte": null}}
            })
            if (result_users.docs.length > 0) {
              add_user = false
              if (auth.auth === 'mojoauth') {
                magic_link = true
              }
            }
          } else {
            add_user = false
          }
        } else {
          add_user = false
        }
        objectPath.set(state, 'rows.' + a + '.add_user', add_user)
        objectPath.set(state, 'rows.' + a + '.magic_link', magic_link)
      }
    }
    const closeActivity = async() => {
      state.dialogActivity = false
      await reloadList()
    }
    const closeSection = async() => {
      state.dialogSection = false
      await reloadList()
    }
    const completeTask = (id) => {
      emit('complete-task', id)
    }
    const deleteOIDCRow = async(index, origin) => {
      emit('remove-oidc', index, props.resource, origin)
      // await reloadList()
    }
    const deleteRow = async(doc, index) => {
      const result = await localDB.remove(doc)
      const opts = {
        doc_db: props.resource,
        doc_id: result.id,
        diff: null
      }
      await eventAdd('Deleted ' + pluralize.singular(props.resource.replace('_statements', '')), props.online, props.patient, opts)
      if (props.resource === 'conditions') {
        if (state.rows[index].history) {
          for (var a in state.rows[index].history) {
            var b = localDB1.get(state.rows[index].history[a].id)
            const result_b = await localDB1.remove(b)
            const opts_b = {
              doc_db: props.resource,
              doc_id: result_b.id,
              diff: null
            }
            await eventAdd('Deleted Care Plan', props.online, props.patient, opts_b)
          }
        }
      }
      auth.setSyncResource(props.resource)
      // await sync(props.resource, false, props.patient, false)
      await reloadList()
    }
    const importRow = async(doc, index, origin) => {
      console.log(state.rows)
      const id = 'nosh_' + uuidv4()
      objectPath.set(doc, 'id', id)
      objectPath.set(doc, '_id', id)
      if (props.resource === 'immunizations' ||
          props.resource === 'allergy_intolerances' ||
          props.resource === 'related_persons') {
        objectPath.set(doc, 'patient.reference', 'Patient/' + props.patient)
      } else if (props.resource === 'tasks') {
        objectPath.set(doc, 'for.reference', 'Patient/' + props.patient)
      } else {
        if (props.resource !== 'practitioners' &&
            props.resource !== 'organizations' &&
            props.resource !== 'appointments' &&
            props.resource !== 'users' &&
            props.resource !== 'patients') {
          objectPath.set(doc, 'subject.reference', 'Patient/' + props.patient)
        }
      }
      await sync(props.resource, false, props.patient, true, doc)
      console.log("from import: " + index)
      emit('remove-oidc', index, props.resource, origin)
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource.replace('_statements', '')) + ' has been imported.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const inactivateRow = async(doc) => {
      if (props.resource === 'conditions' || props.resource === 'allergy_intolerances') {
        objectPath.set(doc, 'clinicalStatus.coding.0.code', 'inactive')
        objectPath.set(doc, 'clinicalStatus.coding.0.display', 'Inactive')
      } else {
        objectPath.set(doc, 'status', 'stopped')
      }
      await sync(props.resource, false, props.patient, true, doc)
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource.replace('_statements', '')) + ' has been inactivated.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
      await reloadList(state.selected.value)
    }
    const fhirMap = async() => {
      for (var a in state.result) {
        objectPath.set(state, 'rows.' + a + '.id', objectPath.get(state, 'result.' + a + '.doc.id'))
        objectPath.set(state, 'rows.' + a + '.title', fhirReplace('title', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.subhead', fhirReplace('subhead', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.author', getAuthor(state.result[a].doc))
        objectPath.set(state, 'rows.' + a + '.content', fhirReplace('content', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.extended', fhirReplace('extended', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.status', fhirReplace('status', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.doc', objectPath.get(state, 'result.' + a + '.doc'))
        objectPath.set(state, 'rows.' + a + '.delete', 'y')
      }
      if (props.resource === 'care_plans') {
        for (var b in state.rows) {
          if (objectPath.has(state, 'rows.' + b + '.doc.activity')) {
            await getActivity(b, objectPath.get(state, 'rows.' + b + '.doc.activity'))
          }
        }
      }
      if (props.resource === 'conditions') {
        await getCarePlans(state.rows)
      }
      if (props.resource === 'compositions') {
        for (var c in state.rows) {
          if (objectPath.has(state, 'rows.' + c + '.doc.section')) {
            for (var d in objectPath.get(state, 'rows.' + c + '.doc.section')) {
              objectPath.set(state, 'rows.' + c + '.section.' + d + '.title', objectPath.get(state, 'rows.' + c + '.doc.section.' + d + '.title'))
              objectPath.set(state, 'rows.' + c + '.section.' + d + '.text', objectPath.get(state, 'rows.' + c + '.doc.section.' + d + '.text.div'))
              objectPath.set(state, 'rows.' + c + '.section.' + d + '.icon', 'note_alt')
            }
          }
        }
      }
      if (props.resource === 'communications') {
        for (var d in state.rows) {
          objectPath.set(state, 'rows.' + d + '.lock', true)
          if (objectPath.get(state, 'rows.' + d + '.doc.status') === 'completed') {
            objectPath.set(state, 'rows.' + d + '.lock_icon', 'lock')
            objectPath.set(state, 'rows.' + d + '.lock_color', 'negative')
          } else {
            objectPath.set(state, 'rows.' + d + '.lock_icon', 'lock_open')
            objectPath.set(state, 'rows.' + d + '.lock_color', 'positive')
          }
        }
      }
      if (props.resource === 'encounters') {
        await getBundle(state.rows)
      }
      if (props.resource === 'medication_statements') {
        await getMedicationRequests(state.rows)
        await getMedicationCarePlan(state.rows)
      }
      if (props.resource === 'patients' ||
          props.resource === 'practitioners' ||
          props.resource === 'related_persons') {
        await checkUser(state.rows)
      }
      if (props.oidc !== null && props.oidc.length > 0) {
        var a1 = state.rows.length
        for (var e in props.oidc) {
          if (objectPath.has(props, 'oidc.' + e + '.docs')) {
            var oidc_results = props.oidc[e].docs.find(f => f.resource === props.resource)
            if (oidc_results !== undefined) {
              var g1 = 0
              if (objectPath.has(oidc_results, 'rows')) {
                if (oidc_results.rows.length > 0) {
                  for (var g of oidc_results.rows) {
                    var comp_category = false
                    var comp = state.rows.find(h => objectPath.get(h, 'doc.' + state.base.compField) === objectPath.get(g, state.base.compField))
                    if (props.resource === 'observations' || props.resource === 'service_requests') {
                      if (g.category[0].coding[0].code === props.category) {
                        comp_category = true
                      }
                    } else {
                      comp_category = true
                    }
                    if (comp === undefined && comp_category) {
                      objectPath.set(state, 'rows.' + a1 + '.id', objectPath.get(g, 'id'))
                      objectPath.set(state, 'rows.' + a1 + '.title', fhirReplace('title', state.base, g, props.schema.flat()))
                      objectPath.set(state, 'rows.' + a1 + '.subhead', fhirReplace('subhead', state.base, g, props.schema.flat()))
                      objectPath.set(state, 'rows.' + a1 + '.content', fhirReplace('content', state.base, g, props.schema.flat()))
                      objectPath.set(state, 'rows.' + a1 + '.extended', fhirReplace('extended', state.base, g, props.schema.flat()))
                      objectPath.set(state, 'rows.' + a1 + '.status', fhirReplace('status', state.base, g, props.schema.flat()))
                      objectPath.set(state, 'rows.' + a1 + '.doc', g)
                      objectPath.set(state, 'rows.' + a1 + '.oidc', props.oidc[e].origin)
                      objectPath.set(state, 'rows.' + a1 + '.oidc_index', g1)
                      objectPath.set(state, 'rows.' + a1 + '.delete', 'n')
                      a1++
                    }
                    g1++
                  }
                }
              }
            }
          }
        }
      }
      console.log(state.rows)
    }
    const getActivity = async(a, activity) => {
      var progress = []
      var outcome = []
      var results = []
      for (var b of activity) {
        var resource = b.reference.split('/').slice(0,-1).join('')
        var id = b.reference.split('/').slice(-1).join('')
        if (objectPath.has(b, 'progress')) {
          progress.push('Progress: ' + objectPath.get(b, 'progress.text'))
        } else {
          progress.push('')
        }
        if (objectPath.has(b, 'outcomeCodeableConcept.0.coding.0.display')) {
          if (objectPath.has(b, 'progress')) {
            outcome.push(', Outcome: ' + objectPath.get(b, 'outcomeCodeableConcept.0.coding.0.display'))
          } else {
            outcome.push('Outcome: ' + objectPath.get(b, 'outcomeCodeableConcept.0.coding.0.display'))
          }
        } else {
          outcome.push('')
        }
        const db = new PouchDB(prefix + Case.snake(pluralize(resource)))
        var row = await db.get(id)
        results.push(row)
      }
      for (var c in results) {
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.id', results[c].id)
        var d = Case.snake(pluralize(results[c].resourceType))
        var e = state.resources.find(({resource}) => resource === d)
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.icon', e.icon)
        var f = Case.capital(pluralize.singular(d))
        if (f == 'Medication Statement') {
          f = 'Continue Medication'
        }
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.label', f + ': ' + removeTags(results[c].text.div))
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.progress', progress[c])
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.outcome', outcome[c])
        objectPath.set(state, 'rows.' + a + '.delete', 'n')
      }
      // return new Promise((resolve) => {
      //   var progress = []
      //   var outcome = []
      //   Promise.all(activity.map((b) => {
      //     var resource = b.reference.split('/').slice(0,-1).join('')
      //     var id = b.reference.split('/').slice(-1).join('')
      //     if (objectPath.has(b, 'progress')) {
      //       progress.push('Progress: ' + objectPath.get(b, 'progress.text'))
      //     } else {
      //       progress.push('')
      //     }
      //     if (objectPath.has(b, 'outcomeCodeableConcept.0.coding.0.display')) {
      //       if (objectPath.has(b, 'progress')) {
      //         outcome.push(', Outcome: ' + objectPath.get(b, 'outcomeCodeableConcept.0.coding.0.display'))
      //       } else {
      //         outcome.push('Outcome: ' + objectPath.get(b, 'outcomeCodeableConcept.0.coding.0.display'))
      //       }
      //     } else {
      //       outcome.push('')
      //     }
      //     var db = new PouchDB(Case.snake(pluralize(resource)))
      //     return db.get(id)
      //   })).then((results) => {
      //     for (var c in results) {
      //       objectPath.set(state, 'rows.' + a + '.activity.' + c + '.id', results[c].id)
      //       var d = Case.snake(pluralize(results[c].resourceType))
      //       var e = state.resources.find(({resource}) => resource === d)
      //       objectPath.set(state, 'rows.' + a + '.activity.' + c + '.icon', e.icon)
      //       var f = Case.capital(pluralize.singular(d))
      //       if (f == 'Medication Statement') {
      //         f = 'Continue Medication'
      //       }
      //       objectPath.set(state, 'rows.' + a + '.activity.' + c + '.label', f + ': ' + removeTags(results[c].text.div))
      //       objectPath.set(state, 'rows.' + a + '.activity.' + c + '.progress', progress[c])
      //       objectPath.set(state, 'rows.' + a + '.activity.' + c + '.outcome', outcome[c])
      //       objectPath.set(state, 'rows.' + a + '.delete', 'n')
      //     }
      //     resolve()
      //   }).catch(function (err) {
      //     console.log(err)
      //   })
      // })
    }
    const getAuthor = (doc) => {
      var a = ''
      if (props.resource === 'conditions' ||
          props.resource === 'allergy_intolerances') {
        if (objectPath.has(doc, 'asserter.reference')) {
          a = objectPath.get(doc, 'asserter.reference')
        }
      }
      if (props.resource === 'medication_statements') {
        if (objectPath.has(doc, 'informationSource.reference')) {
          a = objectPath.get(doc, 'informationSource.reference')
        }
      }
      if (a !== '') {
        return Case.snake(pluralize(a.split('/').slice(0,-1).join('')))
      } else {
        return ''
      }
    }
    const getBundle = async(rows) => {
      var results = []
      for (var b of rows) {
        var result = await localDB3.find({
          selector: {'entry.0.resource.encounter.reference': {$eq: 'Encounter/' + b.id}, _id: {"$gte": null}}
        })
        if (result.docs.length > 0) {
          result.docs.sort((a1, b1) => moment(b1.timestamp) - moment(a1.timestamp))
        }
        results.push(result)
      }
      for (var c in results) {
        objectPath.set(state, 'rows.' + c + '.lock', true)
        objectPath.set(state, 'rows.' + c + '.lock_icon', 'lock_open')
        objectPath.set(state, 'rows.' + c + '.lock_color', 'positive')
        if (objectPath.has(results, c + '.docs.0')) {
          for (var d in objectPath.get(results, c + '.docs')) {
            var comp = objectPath.get(results, c + '.docs.' + d + '.entry.0.resource.encounter.reference')
            var index = rows.findIndex((element) => element.id === comp.replace('Encounter/', ''))
            if (!objectPath.has(state, 'rows.' + index + '.bundle')) {
              objectPath.set(state, 'rows.' + index + '.bundle', objectPath.get(results, c + '.docs.' + d))
              objectPath.set(state, 'rows.' + index + '.lock_icon', 'lock')
              objectPath.set(state, 'rows.' + index + '.lock_color', 'negative')
              var history = []
              history.push(objectPath.get(results, c + '.docs.' + d))
              objectPath.set(state, 'rows.' + index + '.bundle_history', history)
            } else {
              var history1 = objectPath.get(state, 'rows.' + index + '.bundle_history')
              history1.push(objectPath.get(results, c + '.docs.' + d))
              objectPath.set(state, 'rows.' + index + '.bundle_history', history1)
            }
          }
        }
      }
      // return new Promise((resolve) => {
      //   Promise.all(rows.map((b) => {
      //     localDB3.createIndex({
      //       index: {fields: ['timestamp', 'entry.0.resource.encounter.reference', '_id']}
      //     })
      //     return localDB3.find({
      //       selector: {timestamp: {"$gte": null}, 'entry.0.resource.encounter.reference': {$eq: 'Encounter/' + b.id}, _id: {"$gte": null}},
      //       sort: [{timestamp: 'desc'}]
      //     })
      //   })).then(async(results) => {
      //     for (var c in results) {
      //       objectPath.set(state, 'rows.' + c + '.lock', true)
      //       objectPath.set(state, 'rows.' + c + '.lock_icon', 'lock_open')
      //       objectPath.set(state, 'rows.' + c + '.lock_color', 'positive')
      //       if (objectPath.has(results, c + '.docs.0')) {
      //         for (var d in objectPath.get(results, c + '.docs')) {
      //           var comp = objectPath.get(results, c + '.docs.' + d + '.entry.0.resource.encounter.reference')
      //           var index = rows.findIndex((element) => element.id === comp.replace('Encounter/', ''))
      //           if (!objectPath.has(state, 'rows.' + index + '.bundle')) {
      //             objectPath.set(state, 'rows.' + index + '.bundle', objectPath.get(results, c + '.docs.' + d))
      //             objectPath.set(state, 'rows.' + index + '.lock_icon', 'lock')
      //             objectPath.set(state, 'rows.' + index + '.lock_color', 'negative')
      //             var history = []
      //             history.push(objectPath.get(results, c + '.docs.' + d))
      //             objectPath.set(state, 'rows.' + index + '.bundle_history', history)
      //           } else {
      //             var history1 = objectPath.get(state, 'rows.' + index + '.bundle_history')
      //             history1.push(objectPath.get(results, c + '.docs.' + d))
      //             objectPath.set(state, 'rows.' + index + '.bundle_history', history1)
      //           }
      //         }
      //       }
      //     }
      //     resolve()
      //   }).catch(function (err) {
      //     console.log(err)
      //   })
      // })
    }
    const getCarePlans = async(rows) => {
      for (var index in rows) {
        var result = await localDB1.find({
          selector: {'contained.0.id': {$eq: rows[index].id}, _id: {"$gte": null}}
        })
        if (objectPath.has(result, 'docs.0')) {
          result.docs.sort((a1, b1) => moment(b1.created) - moment(a1.created))
          objectPath.set(state, 'rows.' + index + '.careplan.description', objectPath.get(result, 'docs.0.description'))
          objectPath.set(state, 'rows.' + index + '.careplan.created', objectPath.get(result, 'docs.0.created'))
          if (objectPath.has(result, 'docs.0.activity')) {
            await getActivity(index + '.careplan', objectPath.get(result, 'docs.0.activity'))
          }
        }
        for (var d in objectPath.get(result, 'docs')) {
          objectPath.set(state, 'rows.' + index + '.history.' + d + '.description', objectPath.get(result, 'docs.' + d + '.description'))
          objectPath.set(state, 'rows.' + index + '.history.' + d + '.created', objectPath.get(result, 'docs.' + d + '.created'))
          objectPath.set(state, 'rows.' + index + '.history.' + d + '.id', objectPath.get(result, 'docs.' + d + '.id'))
          objectPath.set(state, 'rows.' + index + '.delete', 'n')
          if (objectPath.has(result, 'docs.' + d + '.activity')) {
            await getActivity(index + '.history.' + d, objectPath.get(result, 'docs.' + d + '.activity'))
          }
        }
      }
    }
    const getMedicationCarePlan = async(rows) => {
      for (var index in rows) {
        var result = await localDB1.find({
          selector: {'activity': {"$elemMatch": {"reference": "MedicationStatement/" + rows[index].id}}, _id: {"$gte": null}}
        })
        if (objectPath.has(result, 'docs.0')) {
          for (var d in objectPath.get(result, 'docs')) {
            var e = objectPath.get(result, 'docs.' + d + '.activity')
            for (var f in e) {
              var id = e[f].reference.split('/').slice(-1).join('')
              var index1 = rows.findIndex((element) => element.id === id)
              objectPath.set(state, 'rows.' + index1 + '.delete', 'n')
            }
          }
        }
      }
    }
    const getMedicationRequests = async(rows) => {
      for (var index in rows) {
        var result = await localDB4.find({
          selector: {'medicationCodeableConcept.coding.0.code': {$eq: rows[index].doc.medicationCodeableConcept.coding[0].code}, _id: {"$gte": null}}
        })
        if (objectPath.has(result, 'docs.0')) {
          result.docs.sort((a1, b1) => moment(b1.authoredOn) - moment(a1.authoredOn))
          for (var d in objectPath.get(result, 'docs')) {
            objectPath.set(state, 'rows.' + index + '.history.' + d + '.description', removeTags(objectPath.get(result, 'docs.' + d + '.text.div')))
            objectPath.set(state, 'rows.' + index + '.history.' + d + '.created', objectPath.get(result, 'docs.' + d + '.authoredOn'))
            objectPath.set(state, 'rows.' + index + '.history.' + d + '.id', objectPath.get(result, 'docs.' + d + '.id'))
          }
        }
      }
    }
    const loading = () => {
      emit('loading')
    }
    const loadList = async(status = 'all') => {
      state.rows = []
      state.result = []
      var selector = {}
      var result = null
      if (props.resource === 'compositions' ||
          props.resource === 'care_plans') {
        selector = {[state.base.indexField]: {$eq: [state.base.indexRoot] + '/' + props.encounter}, _id: {"$gte": null}}
      } else if (props.resource === 'service_requests') {
        selector = {[state.base.indexField]: {$eq: props.category}, [state.base.patientField]: {$eq: 'Patient/' + props.patient }, _id: {"$gte": null}}
      } else if (props.resource === 'observations') {
        selector = {'category.0.coding.0.code': {$eq: props.category}, [state.base.patientField]: {$eq: 'Patient/' + props.patient }, _id: {"$gte": null}}
      } else if (props.resource === 'users' || props.resource === 'practitioners') {
        selector = {_id: {$regex: '^nosh_*'}}
      } else if (props.resource === 'communications') {
        if (props.category === 'patient') {
          selector = {[state.base.patientField]: {$eq: 'Patient/' + props.patient }, inResponseTo: {$exists: false}, _id: {"$gte": null}}
        } else if (props.category === 'inbox') {
          result = await inbox(props.resource, props.user)
        } else {
          var docs_arr1 = []
          const a1 = await localDB.query((doc, emit) => {
            if (doc.status !== 'in-progress') {
              for (let recipient of doc.recipient) {
                if (recipient.reference == props.user.reference) {
                  emit(recipient)
                }
              }
            }
          })
          for (var b1 of a1.rows) {
            var c1 = await localDB.get(b1.id)
            docs_arr1.push(c1)
          }
          var withReply1 = docs_arr.filter(d1 => d1.inResponseTo !== undefined)
          var single1 = docs_arr.filter(e1 => e1.inResponseTo === undefined)
          var grouped1 = groupItems(withReply1, 'inResponseTo.reference')
          var keys1 = Object.keys(grouped1)
          keys1.forEach(key1 => {
            grouped1[key1].sort((h, i) => moment(i.sent) - moment(h.sent))
            single1.push(grouped1[key1][0])
          })
          result = {}
          objectPath.set(result, 'docs', single1)
        }
      } else if (props.resource === 'tasks') {
        if (props.category === 'inbox') {
          result = await inbox(props.resource, props.user)
        } else {
          selector = {[state.base.patientField]: {$eq: 'Patient/' + props.patient }, _id: {"$gte": null}}
        }
      } else if (props.resource === 'bundles') {
        selector = {
          'entry': {"$elemMatch": {
            "resource.subject.reference": "Patient/" + props.patient,
            "resource.resourceType": props.category,
          }},
          _id: {"$gte": null}
        }
      } else {
        selector = {[state.base.patientField]: {$eq: 'Patient/' + props.patient }, _id: {"$gte": null}}
      }
      if (result === null) {
        try {
          result = await localDB.find({selector: selector})
        } catch (err) {
          console.log(err)
        }
      }
      if (props.resource === 'compositions') {
        if (result.docs.length == 0) {
          var defaults = {
            category: props.user.defaults.category,
            code: props.user.defaults.code
          }
          emit('open-form', 'add', props.resource, 'all', '', defaults)
        } else {
          state.compositionDoc = result.docs[0]
          emit('composition', result.docs[0])
        }
      }
      for (var j in result.docs) {
        objectPath.set(state, 'result.' + j + '.doc', result.docs[j])
      }
      await fhirMap()
      if (props.resource === 'service_requests' || props.resource === 'observations' || props.resource === 'tasks') {
        if (status !== 'all') {
          state.rows = state.rows.filter(row => row.status == Case.title(status))
        }
      } else if (props.resource === 'bundles') {
        state.rows.sort((b, c) => moment(c.timestamp) - moment(b.timestamp))
      } else {
        if (status === 'all') {
          state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('title', {ignoreCase:true, direction:'asc'}))
        }
        var active_arr = ['Active']
        if (props.resource === 'conditions') {
          active_arr = ['Active', 'Recurrence', 'Relapse']
        }
        if (props.resource === 'tasks') {
          active_arr = ['Draft', 'Requested', 'Recieved', 'Accepted', 'Ready', 'In Progress', 'On Hold']
        }
        if (status === 'active') {
          state.rows = state.rows.filter(row => active_arr.includes(row.status))
          state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('title', {ignoreCase:true, direction:'asc'}))
        }
        if (status === 'inactive') {
          state.rows = state.rows.filter(row => !active_arr.includes(row.status))
          state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('title', {ignoreCase:true, direction:'asc'}))
        }
      }
    }
    const lockThread = (id) => {
      emit('lock-thread', id)
    }
    const newPrescription = (doc) => {
      emit('care-plan', doc)
      emit('new-prescription')
    }
    const onFormOpen = (id) => {
      if (id === 'add') {
        if (props.resource === 'encounters' || props.resource === 'practitioners') {
          emit('open-form', id, props.resource, 'new')
        } else if (props.resource === 'document_references') {
          emit('open-file', id, props.resource, 'content')
        } else if (props.resource === 'care_plans') {
          emit('open-form', id, 'conditions')
        } else if (props.resource === 'communications') {
          emit('open-chat', id, props.category, 'in-progress')
        } else {
          emit('open-form', id, props.resource)
        }
      } else {
        if (state.pageOpen === true) {
          if (props.resource == 'practitioners' || props.resource == 'related_persons') {
            emit('open-page', id, props.resource, 'identity')
          } else if (props.resource == 'users') {
            emit('open-page', id, props.resource, 'me')
          } else {
            emit('open-page', id, props.resource, '')
          }
        } else {
          var b = state.rows.find(a => a.id == id)
          if (props.resource === 'encounters') {
            if (objectPath.has(b, 'bundle')) {
              emit('open-bundle', 'bundles', b.bundle, b.bundle_history)
            } else {
              if (props.provider) {
                emit('open-page', id, props.resource, 'subjective')
              }
            }
          } else if (props.resource === 'compositions') {
            emit('open-form', id, props.resource, 'all', '0')
          } else if (props.resource === 'service_requests' || props.resource === 'observations') {
            emit('open-form', id, props.resource, props.category)
          } else if (props.resource === 'communications') {
            emit('open-chat', id, props.category, b.doc.status)
          } else if (props.resource === 'document_references') {
            emit('open-file', id, props.resource, 'content')
          } else if (props.resource === 'bundles') {
            emit('open-bundle-qr', id, props.category)
          } else {
            emit('open-form', id, props.resource)
          }
        }
      }
    }
    const onSelect = async(value, resource, doc) => {
      var defaults = {}
      if (props.resource === 'care_plans') {
        if (value == 'add') {
          emit('open-form', value, 'conditions', 'all', '', {}, true)
        } else {
          objectPath.set(defaults, 'contained', doc)
          objectPath.set(defaults, 'addresses', 'Condition/' + value)
          objectPath.set(defaults, 'conditionICD10', doc.code.coding[0].code)
          objectPath.set(defaults, 'conditionText', doc.code.coding[0].display)
          emit('open-form', 'add', props.resource, 'all', '', defaults)
        }
      }
      if (props.resource === 'compositions') {
        state.section_id = objectPath.get(state, 'rows.0.id')
        state.section_resource = 'compositions'
        state.section_category = 'section'
        state.section_index = 'add'
        state.section_schema = state.base.section.uiSchema
        state.section_divContent = state.base.divContent
        state.compositionDoc = objectPath.get(state, 'rows.0.doc')
        var compSection = await fetchJSON('compSection', props.online)
        state.section_schema = addSchemaOptions('section_code', compSection, 'Code', 'Display', state.section_schema)
        state.section_schema = await loadSelect('practitioners', 'section_author', state.section_schema)
        if (value !== 'other') {
          objectPath.set(state, 'section_default.section_code', value)
        }
        await nextTick()
        state.dialogSection = true
      }
      if (props.resource === 'service_requests') {
        console.log(value)
        // var b = qOptions.value.find(a => a.value === value)
        // if (value == '363679005' || value == '108252007' || value == '387713003') {
        //   objectPath.set(defaults, 'intent', 'order')
        // }
        // emit('open-form', 'add', props.resource, value, '', defaults, false, doc)
      }
      if (props.resource === 'medication_statements' ||
          props.resource === 'conditions' ||
          props.resource === 'allergy_intolerances' ||
          props.resource === 'service_requests' ||
          props.resource === 'tasks') {
        await reloadList(value)
      }
    }
    const openActivity = (id, index) => {
      state.activity_index = index.toString()
      state.activity_id = id
      state.dialogActivity = true
    }
    const openHistory = (history) => {
      state.history = []
      state.history = history
      state.dialogHistory = true
    }
    const openQR = () => {
      emit('open-qr', window.location.href)
    }
    const openSection = async(index) => {
      var sections_arr = []
      var compSection = await fetchJSON('compSection', props.online)
      for (var a in compSection) {
        if (compSection[a].Code !== undefined) {
          sections_arr.push(compSection[a])
        }
      }
      var b = sections_arr.find(c => c.Code === objectPath.get(state, 'compositionDoc.section.' + index + '.coding.coding.0.code'))
      if (!objectPath.has(b, 'resource')) {
        state.section_id = objectPath.get(state, 'rows.0.id')
        state.section_resource = 'compositions'
        state.section_category = 'section'
        state.section_index = index.toString()
        state.section_schema = state.base.section.uiSchema
        state.section_divContent = state.base.divContent
        state.compositionDoc = objectPath.get(state, 'rows.0.doc')
        state.section_schema = addSchemaOptions('section_code', compSection, 'Code', 'Display', state.section_schema)
        state.section_schema = await loadSelect('practitioners', 'section_author', state.section_schema)
        setTimeout(() => {
          state.dialogSection = true
        }, 200)
      }
    }
    const qOptions = ref(props.options)
    const reactivateRow = async(doc) => {
      if (props.resource === 'conditions' || props.resource === 'allergy_intolerances') {
        objectPath.set(doc, 'clinicalStatus.coding.0.code', 'active')
        objectPath.set(doc, 'clinicalStatus.coding.0.display', 'Active')
      } else {
        objectPath.set(doc, 'status', 'active')
      }
      await sync(props.resource, false, props.patient, true, doc)
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource.replace('_statements', '')) + ' has been reactivated.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
      await reloadList(state.selected.value)
    }
    const reloadList = async(status = 'all') => {
      // state.rows = []
      console.log('reloading list')
      await loadList(status)
    }
    const removeActivity = async(doc, index1, index) => {
      doc.activity.splice(index1,1)
      state.rows[index].activity.splice(index1,1)
      await sync('care_plans', false, props.patient, true, doc)
      var doc2 = await localDB1.get(doc.id)
      state.careplanDoc = doc2
      emit('care-plan', doc2)
      state.rows[index].doc = doc2
      $q.notify({
        message: 'Activity removed from the active care plan.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const removeSection = async(doc, index1, index) => {
      doc.section.splice(index1,1)
      state.rows[index].section.splice(index1,1)
      await sync('compositions', false, props.patient, true, doc)
      var doc2 = await localDB2.get(doc.id)
      state.compositionDoc = doc2
      emit('composition', doc2)
      state.rows[index].doc = doc2
      $q.notify({
        message: 'Section removed from the composition.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const setActiveCarePlan = (doc) => {
      emit('care-plan', doc)
    }
    const setActiveComposition = (doc) => {
      emit('composition', doc)
    }
    const setActivity = async(doc) => {
      var doc1 = state.careplanDoc
      if (objectPath.has(doc1, 'activity')) {
        var a = doc1.activity.length
        objectPath.set(doc1, 'activity.' + a + '.reference', Case.pascal(pluralize.singular(props.resource)) + '/' + doc.id)
      } else {
        objectPath.set(doc1, 'activity.0.reference', Case.pascal(pluralize.singular(props.resource)) + '/' + doc.id)
      }
      emit('loading')
      await sync('care_plans', false, props.patient, true, doc1)
      var doc2 = await localDB1.get(state.careplanDoc.id)
      state.careplanDoc = doc2
      emit('care-plan', doc2)
      emit('loading')
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource) + ' is now associated with the active care plan.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const setCompositionSection = () => {
      if (props.resource == 'conditions' ||
          props.resource == 'medication_statements' ||
          props.resource == 'immunizations' ||
          props.resource == 'allergy_intolerances') {
        emit('set-composition-section', props.resource)
      }
    }
    const setDiagnosis = (doc) => {
      var defaults = {}
      objectPath.set(defaults, 'contained', doc)
      objectPath.set(defaults, 'addresses', 'Condition/' + doc.id)
      objectPath.set(defaults, 'conditionICD10', doc.code.coding[0].code)
      objectPath.set(defaults, 'conditionText', doc.code.coding[0].display)
      emit('open-form', 'add', 'care_plans', 'all', '', defaults)
    }
    const setEncounter = async(doc) => {
      objectPath.set(doc, 'context.encounter.0.reference', 'Encounter/' + props.encounter)
      await sync(props.resource, false, props.patient, true, doc)
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource) + ' is now associated with the active encounter.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const setNew = (doc, resource, category='all') => {
      emit('care-plan', doc)
      var defaults = {}
      if (resource === 'service_requests') {
        objectPath.set(defaults, 'priority', 'routine')
        objectPath.set(defaults, 'intent', 'order')
        objectPath.set(defaults, 'reasonICD10', objectPath.get(doc, 'contained.0.code.coding.0.code'))
        objectPath.set(defaults, 'reasonText', objectPath.get(doc, 'contained.0.code.coding.0.display'))
      }
      emit('open-form', 'add', resource, category, '', defaults)
    }
    const setPrescription = async(doc) => {
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
      emit('open-form', 'add', 'medication_requests', 'all', '', {}, false, doc1, div)
    }
    const setUser = async(doc) => {
      var id = 'nosh_' + uuidv4()
      var message = 'The ' + pluralize.singular(props.resource.replace('_statements', '')) + ' has been added as a user.'
      var email = doc.telecom.find(a => a.system === 'email')
      var user = {
        display: removeTags(doc.text.div),
        id: id,
        _id: id,
        email: email.value,
        reference: doc.resourceType + '/' + doc._id,
      }
      if (doc.resourceType === 'Patient') {
        objectPath.set(user, 'role', 'patient')
      }
      if (doc.resourceType === 'Practitioner') {
        if (objectPath.has(doc, 'identifier')) {
          var npi = doc.identifier.find(b => b.system === 'http://hl7.org/fhir/sid/us-npi')
          if (npi !== undefined) {
            objectPath.set(user, 'role', 'provider')
          }
          var defaults = {
            "class": "AMB",
            "type": "14736009",
            "serviceType": "349",
            "appointmentType": "ROUTINE",
            "serviceCategory": " 17"
          }
          var templates = await fetchJSON('templates', props.online)
          objectPath.set(user, 'defaults', defaults)
          objectPath.set(user, 'charts', [])
          objectPath.set(user, 'unsigned', [])
          objectPath.set(user, 'templates', templates)
        }
      }
      if (doc.resourceType === 'RelatedPerson') {
        objectPath.set(user, 'role', 'proxy')
      }
      await sync('users', false, props.patient, true, user)
      $q.notify({
        message: message,
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const sortTitle = () => {
      state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('title', {ignoreCase:true, direction:'asc'}))
    }
    const sortDate = () => {
      state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('subhead', {ignoreCase:true, direction:'desc'}))
    }
    return {
      addSchemaOptions,
      attestRow,
      checkUser,
      closeActivity,
      closeSection,
      completeTask,
      deleteOIDCRow,
      deleteRow,
      fetchJSON,
      filterFn,
      fhirMap,
      fhirModel,
      fhirReplace,
      getActivity,
      getAuthor,
      getBundle,
      getCarePlans,
      getMedicationCarePlan,
      getMedicationRequests,
      groupItems,
      importRow,
      inactivateRow,
      inbox,
      loading,
      loadList,
      loadSelect,
      lockThread,
      newPrescription,
      onFormOpen,
      onSelect,
      openActivity,
      openHistory,
      openQR,
      openSection,
      qOptions,
      reactivateRow,
      reloadList,
      removeActivity,
      removeSection,
      removeTags,
      setActiveCarePlan,
      setActiveComposition,
      setActivity,
      setCompositionSection,
      setDiagnosis,
      setEncounter,
      setNew,
      setPrescription,
      setUser,
      sortTitle,
      sortDate,
      sync,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
