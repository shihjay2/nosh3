<template>
  <div style="max-width: 250px">
    <q-toolbar class="text-primary">
      <q-toolbar-title clickable @click="open('page', 'patients', 'identity', state.patient)">
        {{ state.patientName }}
      </q-toolbar-title>
      <q-btn flat round dense @click="openCareOpportunities">
        <q-icon color="red" name="notification_important" />
        <q-tooltip>Care Opportunities</q-tooltip>
      </q-btn>
    </q-toolbar>
    <div class="q-px-sm q-pb-sm q-gutter-sm">
      <q-card class="relative-position">
        <q-card-section horizontal clickable @click="open('page', 'patients', 'identity', state.patient)">
          <q-card-section v-if="state.patientPhoto !== ''" >
            <q-img :src="state.patientPhoto" spinner-color="white" width="70px" height="70px" fit="scale-down" position="0 0"/>
          </q-card-section>
          <q-card-section>
            <div class="text-subtitle2">Age: {{ state.patientAge }}</div>
            <div class="text-subtitle2">Gender: {{state.patientGender}}</div>
            <div v-if="state.patientNickname !== ''" class="text-subtitle2">"{{state.patientNickname}}"</div>
          </q-card-section>
        </q-card-section>
      </q-card>
    </div>
    <q-list dense>
      <q-item v-if="state.encounterCheck">
        <q-chip
          removable
          icon="event"
          outline
          color="primary"
          text-color="primary"
          clickable
          @click="open('page', 'encounters', 'subjective', state.encounter)"
          @remove="unset('encounters')"
        >
          Active Encounter
          <q-tooltip>{{ state.encounter }}</q-tooltip>
        </q-chip>
      </q-item>
      <q-item v-if="state.careplanCheck">
        <q-chip
          removable
          icon="next_plan"
          outline
          color="primary"
          text-color="primary"
          clickable
          @click="open('page', 'encounters', 'assessment_plan', state.encounter)"
          @remove="unset('care_plans')"
        >
          Active Care Plan
          <q-tooltip>{{ state.careplan }}</q-tooltip>
        </q-chip>
      </q-item>
      <q-item v-if="state.pregnancyCheck">
        <q-chip
          icon="pregnant_woman"
          outline
          color="secondary"
          text-color="secondary"
          clickable
          @click="openPulldown('pregnancy')"
        >
          {{ state.pregnancyStatus }}
        </q-chip>
      </q-item>
      <q-item v-if="state.smokingCheck">
        <q-chip
          icon="smoking_rooms"
          outline
          color="secondary"
          text-color="secondary"
          clickable
          @click="openPulldown('tobacco')"
        >
          {{ state.smokingStatus }}
          <q-tooltip>{{ state.smokingStatusTooltip }}</q-tooltip>
        </q-chip>
      </q-item>
      <div v-for="item in state.ui" :key="item.resource">
        <q-item dense clickable @click="open(item.type, item.resource, item.category, '')" v-ripple>
          <q-item-section avatar>
            <q-icon color="primary" :name="item.icon" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ item.label }}</q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <div class="q-pa-sm q-gutter-sm">
              <q-badge rounded color="primary" :label="item.count">
                <q-tooltip># Items in Resource</q-tooltip>
              </q-badge>
              <q-badge v-if="item.oidc" rounded color="warning" :label="item.oidc">
                <q-tooltip># Ready to Import from Sync</q-tooltip>
              </q-badge>
            </div>
          </q-item-section>
        </q-item>
      </div>
    </q-list>
  </div>
</template>

<script>
import { defineComponent, reactive, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import objectPath from 'object-path'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'QDrawerTemplate',
  props: {
    encounter: String,
    care_plan_doc: Object,
    patient: String,
    patientDoc: Object,
    patientName: String,
    patientNickname: String,
    patientAge: String,
    patientGender: String,
    patientPhoto: String,
    drawerReload: Boolean,
    drawerResource: String,
    oidc: {
      type: Array,
      default: function () { return []}
    }
  },
  emits: ['open-care-opportunities', 'open-list', 'open-page', 'open-pulldown', 'reload-drawer-complete', 'unset'],
  setup (props, { emit }) {
    const { getPrefix, observationStatus, observationStatusRaw } = common()
    const state = reactive({
      patientName: '',
      patientAge: '',
      patientGender: '',
      patientPhoto: '',
      patientNickname: '',
      patient: '',
      patientDoc: {},
      ui: [],
      base: [],
      resources: [],
      results: [],
      document_references: 0,
      communications: 0,
      service_requests: 0,
      tasks: 0,
      encounterCheck: false,
      encounter: '',
      careplanCheck: false,
      pregnancyCheck: false,
      smokingCheck: false,
      pregnancyStatus: '',
      smokingStatus: '',
      smokingStatusTooltip: '',
      careplan: ''
    })
    var prefix = getPrefix()
    onMounted(async() => {
      encounterCheck()
      state.patientName = props.patientName
      state.patientAge = props.patientAge
      state.patientGender = props.patientGender
      state.patientPhoto = props.patientPhoto
      state.patientNickname = props.patientNickname
      state.patient = props.patient
      state.encounter = props.encounter
      var resources = await import('@/assets/ui/drawer.json')
      state.ui = resources.rows
      for (var a in state.ui) {
        if (typeof state.ui[a].resource !== 'undefined') {
          state.base[a] = await import('@/assets/fhir/' + state.ui[a].resource + '.json')
          state.resources.push(state.ui[a].resource)
          var count = await query(state.ui[a].resource, a)
          objectPath.set(state, 'ui.' + a + '.count', count)
          for (var e in props.oidc) {
            if (objectPath.has(props, 'oidc.' + e + '.docs')) {
              var oidc_results = props.oidc[e].docs.find(f => f.resource === state.ui[a].resource)
              if (oidc_results !== undefined) {
                if (objectPath.has(oidc_results, 'rows')) {
                  if (oidc_results.rows.length > 0) {
                    objectPath.set(state, 'ui.' + a + '.oidc', oidc_results.rows.length.toString())
                  }
                }
              }
            }
          }
        }
      }
    })
    watch(() => props.drawerReload, async(newVal) => {
      if (newVal) {
        for (var a in state.ui) {
          var count = await query(state.ui[a].resource, a)
          objectPath.set(state, 'ui.' + a + '.count', count)
          for (var e in props.oidc) {
            if (objectPath.has(props, 'oidc.' + e + '.docs')) {
              var oidc_results = props.oidc[e].docs.find(f => f.resource === state.ui[a].resource)
              if (oidc_results !== undefined) {
                if (objectPath.has(oidc_results, 'rows')) {
                  if (oidc_results.rows.length > 0) {
                    objectPath.set(state, 'ui.' + a + '.oidc', oidc_results.rows.length.toString())
                  }
                }
              }
            }
          }
        }
        emit('reload-drawer-complete')
      }
    })
    watch(() => props.oidc, async(newVal) => {
      for (var a in state.ui) {
        objectPath.del(state, 'ui.' + a + '.oidc')
        for (var e in newVal) {
          if (objectPath.has(newVal, e + '.docs')) {
            var oidc_results = newVal[e].docs.find(f => f.resource === state.ui[a].resource)
            if (oidc_results !== undefined) {
              if (objectPath.has(oidc_results, 'rows')) {
                if (oidc_results.rows.length > 0) {
                  objectPath.set(state, 'ui.' + a + '.oidc', oidc_results.rows.length.toString())
                }
              }
            }
          }
        }
      }
    },{deep: true})
    watch(() => props.encounter, async(newVal) => {
      await encounterCheck()
    })
    watch(() => props.care_plan_doc, (newVal) => {
      if (objectPath.has(newVal.id)) {
        state.careplanCheck = true
      } else {
        state.careplanCheck = false
      }
      state.careplan = objectPath.get(props, 'care_plan_doc.contained.0.code.coding.0.display')
    })
    watch(() => props.patientName, (newVal) => {
      state.patientName = newVal
    })
    watch(() => props.patientAge, (newVal) => {
      state.patientAge = newVal
    })
    watch(() => props.patientGender, (newVal) => {
      state.patientGender = newVal
    })
    watch(() => props.patientPhoto, (newVal) => {
      state.patientPhoto = newVal
    })
    watch(() => props.patientNickname, (newVal) => {
      state.patientNickname = newVal
    })
    watch(() => props.patient, (newVal) => {
      state.patient = newVal
    })
    watch(() => props.patientDoc, (newVal) => {
      state.patientDoc = newVal
    })
    watch(() => props.encounter, (newVal) => {
      state.encounter = newVal
    })
    const encounterCheck = async() => {
      if (props.encounter !== '') {
        state.encounterCheck = true
      } else {
        state.encounterCheck = false
      }
      if (objectPath.has(props, 'care_plan_doc.id')) {
        state.careplanCheck = true
      } else {
        state.careplanCheck = false
      }
      var pregnancy_arr = [{val: 'Y', label: 'Pregnant'},{val: 'N', label: 'Not Pregnant'},{val: 'U', label: 'Pregnancy ???'}]
      var tobacco_arr = [{val: 'Y', label: 'Smoker'},{val: 'N', label: 'Nonsmoker'},{val: 'U', label: 'Smoking Status ???'}]
      if (props.patientDoc.extension[2].valueCode === 'F') {
        var a = await observationStatus('pregnancy', props.patient, false, true)
        var b = pregnancy_arr.find(c => c.val === a)
        state.pregnancyStatus = b.label
        state.pregnancyCheck = true
      }
      var d = await observationStatus('tobacco', props.patient, false, true)
      var e = tobacco_arr.find(f => f.val === d)
      state.smokingStatus = e.label
      var g = await observationStatusRaw('tobacco', props.patient)
      if (objectPath.has(g, 'display')) {
        state.smokingStatusTooltip = g.display
      }
      state.smokingCheck = true
      state.encounter = props.encounter
      state.careplan = objectPath.get(props, 'care_plan_doc.contained.0.code.coding.0.display')
    }
    const open = (type, resource, category='all', id) => {
      if (type == 'list') {
        emit('open-' + type, resource, category)
      } else {
        emit('open-' + type, id, resource, category)
      }
    }
    const openCareOpportunities = () => {
      emit('open-care-opportunities')
    }
    const openPulldown = (type) => {
      emit('open-pulldown', type)
    }
    const query = async(resource, index) => {
      const localDB = new PouchDB(prefix + resource)
      const findobj = {selector: {[state.base[index].activeField]: {$ne: 'inactive'}, [state.base[index].patientField]: {$eq: 'Patient/' + props.patient }, _id: {"$gte": null}}}
      if (resource === 'communications') {
        findobj.selector = {[state.base[index].activeField]: {$ne: 'inactive'}, [state.base[index].patientField]: {$eq: 'Patient/' + props.patient }, inResponseTo: {$exists: false}, _id: {"$gte": null}}
      }
      const result = await localDB.find(findobj)
      return result.docs.length.toString()
    }
    const unset = (type) => {
      emit('unset', type)
    }
    return {
      encounterCheck,
      observationStatus,
      open,
      openCareOpportunities,
      openPulldown,
      query,
      unset,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
