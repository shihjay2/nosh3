<template>
  <q-breadcrumbs>
    <q-breadcrumbs-el :label="state.titleResource" :icon="state.iconResource" />
    <q-breadcrumbs-el v-if="state.titleSubResource !== ''" :label="state.titleSubResource" :icon="state.iconSubResource" />
    <q-breadcrumbs-el v-if="state.titleCategory !== ''" :label="state.titleCategory" icon="widgets" />
    <q-breadcrumbs-el v-if="state.titleAction !== ''" :label="state.titleAction" :icon="state.iconAction" />
  </q-breadcrumbs>
  <q-space />
  <q-btn v-if="state.encounterSign && state.provider" push flat round icon="approval" clickable @click="signEncounter">
    <q-tooltip>Sign Encounter</q-tooltip>
  </q-btn>
  <q-btn v-if="state.chat && state.status == 'in-progress'" push flat round icon="approval" clickable @click="lockThread">
    <q-tooltip>Lock Thread</q-tooltip>
  </q-btn>
  <q-btn v-if="state.relatedPersons" push flat round icon="groups" clickable @click="openRelatedPersons">
    <q-tooltip>Related Persons</q-tooltip>
  </q-btn>
  <q-btn v-if="state.timeline && state.user.role === 'patient'" push flat round icon="policy" clickable @click="openTrustee('user')" color="deep-orange">
    <q-tooltip>Share Record</q-tooltip>
  </q-btn>
  <q-btn v-if="state.maiaEnable && state.maia !== ''" push flat round icon="smart_toy" clickable @click="openMAIA" color="deep-orange">
    <q-tooltip>Launch MAIA</q-tooltip>
  </q-btn>
  <q-btn v-if="state.resource == 'medication_statements' && state.provider" push flat round icon="local_pharmacy" clickable @click="newPrescription">
    <q-tooltip>New Prescription</q-tooltip>
  </q-btn>
  <q-btn v-if="state.resource == 'immunizations'" push flat round icon="notifications_active" clickable @click="openImmunizationSchedule">
    <q-tooltip>Immunization Schedule</q-tooltip>
  </q-btn>
  <q-btn v-if="state.add !== ''" push flat round icon="add" clickable @click="onFormOpen('add')">
    <q-tooltip>Add {{ state.add }}</q-tooltip>
  </q-btn>
  <q-btn v-if="state.list" push flat round icon="date_range" clickable @click="sortDate()">
    <q-tooltip>Sort by Descending Date</q-tooltip>
  </q-btn>
  <q-btn v-if="state.list" push flat round icon="sort_by_alpha" clickable @click="sortTitle()">
    <q-tooltip>Sort Alphabetically</q-tooltip>
  </q-btn>
  <q-btn v-if="state.list && state.encounter !== ''" push flat round icon="playlist_add_check" clickable @click="setCompositionSection()">
    <q-tooltip>Mark List as Reviewed</q-tooltip>
  </q-btn>
  <q-btn v-if="state.file" push flat round icon="details" clickable @click="openDetail()">
    <q-tooltip>File Details</q-tooltip>
  </q-btn>
  <q-btn v-if="state.bundle && state.provider" push flat round icon="post_add" clickable @click="addendumEncounter()">
    <q-tooltip>Encounter Addendum</q-tooltip>
  </q-btn>
  <q-btn v-if="state.bundle" push flat round icon="print" clickable v-print="'print_bundle'">
    <q-tooltip>Print</q-tooltip>
  </q-btn>
  <q-btn v-if="state.oidc" push flat round icon="file_upload" clickable @click="uploadSync()">
    <q-tooltip>Upload Sync</q-tooltip>
  </q-btn>
  <q-btn v-if="state.oidc" push flat round icon="adb" clickable @click="openDebug()">
    <q-tooltip>Debug Sync</q-tooltip>
  </q-btn>
  <q-btn v-if="state.oidc" push flat round icon="file_download" clickable @click="dumpSync()">
    <q-tooltip>Sync Dump</q-tooltip>
  </q-btn>
  <q-btn v-if="state.oidc" push flat round icon="delete" clickable @click="clearSync()">
    <q-tooltip>Clear Sync</q-tooltip>
  </q-btn>
  <q-btn v-if="state.oidc" push flat round icon="import_export" clickable @click="importAll()">
    <q-tooltip>Import Everything</q-tooltip>
  </q-btn>
  <q-btn v-if="state.oidc" push flat round icon="delete_sweep" clickable @click="clearAll()">
    <q-tooltip>Clear Everything</q-tooltip>
  </q-btn>
  <q-btn v-if="!state.timeline" push flat round icon="close" clickable @click="closeContainer()">
    <q-tooltip>Close</q-tooltip>
  </q-btn>
</template>

<script>
import { defineComponent, onMounted, reactive, watch } from 'vue'
import { common } from '@/logic/common'
import { useAuthStore } from '@/stores'
import Case from 'case'
import pluralize from 'pluralize'
import print from 'vue3-print-nb'
import objectPath from 'object-path'

export default defineComponent({
  name: 'QToolbarTemplate',
  props: {
    encounter: String,
    id: String,
    toolbarObject: Object,
    user: Object,
    patient: String,
    provider: Boolean,
    online: Boolean
  },
  directives: {
    print
  },
  emits: ['addendum-encounter', 'clear-all', 'clear-sync', 'close-container', 'dump-sync', 'import-all', 'lock-thread', 'new-prescription', 'open-chat', 'open-debug', 'open-detail', 'open-form', 'open-file', 'open-immunizationschedule', 'open-list', 'open-page', 'open-page-form', 'open-trustee', 'set-composition-section', 'sign-encounter', 'sort-alpha', 'sort-date', 'start-sync', 'upload-sync'],
  setup (props, { emit }) {
    const auth = useAuthStore(localStorage.getItem('auth_id'))
    const { fetchJSON } = common()
    const state = reactive({
      base: {},
      pageOpen: false,
      patient: '',
      provider: false,
      encounter: '',
      encounterSign: false,
      relatedPersons: false,
      resource: '',
      category: '',
      resources: [],
      titleResource: '',
      titleSubResource: '',
      titleCategory: '',
      titleAction: '',
      iconResource: '',
      iconSubResource: '',
      iconAction: '',
      add: '',
      list: false,
      card: false,
      chat: false,
      info: false,
      page: false,
      file: false,
      bundle: false,
      mixed: false,
      form: false,
      oidc: false,
      status: '',
      maia: '',
      timeline: false,
      maiaEnable: false,
      user: {}
    })
    onMounted(async() => {
      const resources = await fetchJSON('resources', props.online)
      state.resources = resources.rows
      state.provider = props.provider
      state.patient = props.patient
      state.user = props.user
      if (auth.maia_alt !== null) {
        state.maia = auth.maia_alt + "?uri=" + encodeURIComponent(location.protocol + '//' + location.host + '/api/' + state.patient + '/Timeline')
      } else {
        if (auth.maia !== '') {
          state.maia = auth.maia + "?uri=" + encodeURIComponent(location.protocol + '//' + location.host + '/api/' + state.patient + '/Timeline')
        }
      }
      await updateToolbar(props.toolbarObject)
    })
    watch(() => props.toolbarObject, (newVal) => {
      if (newVal) {
        updateToolbar(newVal)
        emit('reload-complete')
      }
    })
    watch(() => auth.maia_alt, (newVal) => {
      if (newVal !== null) {
        state.maia = auth.maia_alt + "?uri=" + encodeURIComponent(location.protocol + '//' + location.host + '/api/' + state.patient + '/Timeline')
      } else {
        state.maia = auth.maia + "?uri=" + encodeURIComponent(location.protocol + '//' + location.host + '/api/' + state.patient + '/Timeline')
      }
    })
    const addendumEncounter = () => {
      emit('addendum-encounter')
    }
    const clearAll = () => {
      emit('clear-all')
    }
    const clearSync = () => {
      emit('clear-sync')
    }
    const closeContainer = () => {
      emit('close-container')
    }
    const dumpSync = () => {
      emit('dump-sync')
    }
    const importAll = () => {
      emit('import-all')
    }
    const lockThread = () => {
      emit('lock-thread', props.id)
    }
    const newPrescription = () => {
      emit('new-prescription')
    }
    const onFormOpen = (id) => {
      if (props.id == '') {
        if (state.pageOpen === true && id !== 'add') {
          emit('open-page', id, state.resource)
        } else {
          if (state.resource === 'encounters' || state.resource === 'practitioners' || state.resource === 'related_persons') {
            const defaults = {}
            if (state.resource === 'encounters') {
              if (objectPath.has(props, 'user.defaults')) {
                objectPath.set(defaults, 'class', props.user.defaults.class)
                objectPath.set(defaults, 'type', props.user.defaults.type)
                objectPath.set(defaults, 'serviceType', props.user.defaults.serviceType)
              }
            }
            emit('open-form', id, state.resource, 'new', '', defaults)
          } else if (state.resource === 'document_references') {
            emit('open-file', id, state.resource, 'content')
          } else if (state.resource === 'service_requests' || state.resource === 'observations') {
            emit('open-page-form')
          } else if (state.resource === 'communications') {
            emit('open-chat', id, state.category, 'in-progress')
          } else {
            emit('open-form', id, state.resource, state.category)
          }
        }
      } else {
        emit('open-page-form')
      }
    }
    const openDebug = () => {
      emit('open-debug')
    }
    const openDetail = () => {
      emit('open-detail')
    }
    const openImmunizationSchedule = () => {
      emit('open-immunizationschedule')
    }
    const openMAIA = () => {
      window.open(state.maia)
    }
    const openRelatedPersons = () => {
      emit('open-list', 'related_persons', 'all')
    }
    const openTrustee = (view) => {
      emit('open-trustee', view)
    }
    const setCompositionSection = () => {
      emit('set-composition-section', state.resource)
    }
    const signEncounter = () => {
      emit('sign-encounter')
    }
    const sortDate = () => {
      emit('sort-date')
    }
    const sortTitle = () => {
      emit('sort-alpha')
    }
    const updateToolbar = async(toolbar) => {
      state.base = {}
      state.pageOpen = false
      state.list = false
      state.card = false
      state.info = false
      state.page = false
      state.file = false
      state.bundle = false
      state.chat = false
      state.oidc = false
      state.encounterSign = false
      state.timeline = false
      state.maiaEnable = false
      state.resource = ''
      state.category = ''
      state.encounter = ''
      state.titleResource = ''
      state.titleSubResource = ''
      state.titleCategory = ''
      state.titleAction = ''
      state.iconResource = ''
      state.iconSubResource = ''
      state.iconAction = ''
      state.add = ''
      state.status = ''
      if (toolbar.type === 'oidc') {
        state.oidc = true
        state.titleResource = 'Sync from EPIC and CMS Bluebutton'
        state.iconResource = 'sync'
      } else if (toolbar.type === 'timeline') {
        state.titleResource = 'Timeline'
        state.iconResource = 'timeline'
        state.timeline = true
        state.maiaEnable = true
      } else {
        state.base = await import('@/assets/fhir/' + toolbar.resource + '.json')
        if (typeof state.base.pageOpen !== 'undefined') {
          state.pageOpen = state.base.pageOpen
        }
        state.resource = toolbar.resource
        state.encounter = props.encounter
        state.titleResource = Case.title(pluralize.singular(toolbar.resource))
        if (toolbar.type == 'list' || toolbar.type == 'card') {
          state.titleResource = Case.title(toolbar.resource)
          state.add = state.titleResource
          if (toolbar.resource == 'encounters') {
            if (!state.provider) {
              state.add = ''
            }
          }
        }
        const b = state.resources.find(a => a.resource == toolbar.resource)
        state.iconResource = b.icon
        if (objectPath.has(toolbar, 'subresource')) {
          state.titleResource = Case.title(pluralize.singular(toolbar.resource))
          state.titleSubResource = Case.title(pluralize.singular(toolbar.subresource))
          if (toolbar.type == 'list' || toolbar.type == 'card') {
            state.titleSubResource = Case.title(toolbar.subresource)
          }
          const d = state.resources.find(c => c.resource == toolbar.subresource)
          state.iconSubResource = d.icon
          if (state.resource !== 'encounters') {
            state.add = state.titleSubResource
          } else {
            state.add = ''
          }
        }
        if (objectPath.has(toolbar, 'category')) {
          state.category = toolbar.category
          if (toolbar.category !== 'all') {
            if (state.resource === 'service_requests') {
              const f = state.base.tabs.find(e => e.category === state.category)
              state.titleCategory = f.label
            } else {
              state.titleCategory = Case.title(toolbar.category)
            }
            if (state.resource !== 'encounters') {
              if (state.category !== 'identity') {
                if (state.resource == 'communications') {
                  if (state.category == 'inbox') {
                    state.add = 'Message Thread'
                  }
                } else {
                  state.add = state.titleCategory
                }
              } else {
                state.add = ''
              }
            } else {
              state.add = ''
            }
          }
        }
        if (objectPath.has(toolbar, 'action')) {
          state.titleAction = toolbar.action
          if (toolbar.action == 'Add') {
            state.iconAction = 'add'
          } else {
            state.iconAction = 'edit'
          }
        }
        if (objectPath.has(toolbar, 'status')) {
          state.status = toolbar.status
        }
        state[toolbar.type] = true
        if (toolbar.resource === 'encounters') {
          if (toolbar.category !== 'all') {
            state.encounterSign = true
          }
        }
        if (toolbar.resource === 'patients') {
          state.relatedPersons = true
        }
        if (toolbar.resource === 'document_references') {
          state.maiaEnable = true
        }
      }
    }
    const uploadSync = () => {
      emit('upload-sync')
    }
    return {
      addendumEncounter,
      clearAll,
      clearSync,
      closeContainer,
      dumpSync,
      fetchJSON,
      importAll,
      lockThread,
      newPrescription,
      onFormOpen,
      openDebug,
      openDetail,
      openImmunizationSchedule,
      openMAIA,
      openRelatedPersons,
      openTrustee,
      setCompositionSection,
      signEncounter,
      sortDate,
      sortTitle,
      updateToolbar,
      uploadSync,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
