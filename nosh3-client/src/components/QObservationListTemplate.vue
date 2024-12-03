<template>
  <div :class="state.within_page">
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
        </q-card-section>
        <q-item-section v-if="row.lock" avatar>
          <q-icon :color="row.lock_color" :name="row.lock_icon" />
        </q-item-section>
      </q-item>
      <q-card-section v-if="row.oidc">
        <q-list v-for="data in row.content" :key="data.id">
          <q-item clickable>
            <q-item-section avatar>
              <q-icon :color="data.icon_color" :name="data.icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ data.title }}</q-item-label>
              <q-item-label caption>{{ data.text }}</q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-btn flat round color="teal" icon="import_export" clickable @click="importRow(data.doc, data.doc._oidc_index, row.oidc)">
                <q-tooltip>Import</q-tooltip>
              </q-btn>
              <q-btn flat round color="red" icon="delete" clickable @click="deleteOIDCRow(data.doc.oidc_index, row.oidc)">
                <q-tooltip>Delete</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-card-section v-else>
        <q-list v-for="data in row.content" :key="data.id">
          <q-item clickable>
            <q-item-section avatar>
              <q-icon :color="data.icon_color" :name="data.icon" />
            </q-item-section>
            <q-item-section @click="onFormOpen(data.doc._id)">
              <q-item-label>{{ data.title }}</q-item-label>
              <q-item-label caption>{{ data.text }}</q-item-label>
              <q-item-label>
                <q-chip v-if="data.author === 'patients'" icon="face" color="teal" text-color="white">Patient Submitted</q-chip>
              </q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-btn v-if="data.author === 'patients' && state.provider" flat round color="teal" icon="thumb_up_alt" clickable @click="attestRow(data.doc)">
                <q-tooltip>Attest</q-tooltip>
              </q-btn>
              <q-btn v-if="data.delete === 'y'" flat round color="red" icon="delete" clickable @click="deleteRow(data.doc)">
                <q-tooltip>Delete</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn v-if="row.oidc" flat round color="teal" icon="import_export" clickable @click="importRows(index, row.oidc)">
          <q-tooltip>Import All</q-tooltip>
        </q-btn>
        <q-btn v-if="row.oidc" flat round color="red" icon="delete" clickable @click="deleteOIDCRows(index, row.oidc)">
          <q-tooltip>Delete All</q-tooltip>
        </q-btn>
        <q-btn v-if="row.delete === 'y'" flat round color="red" icon="delete" clickable @click="deleteRows(index)">
          <q-tooltip>Delete All</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>
  </div>
</template>

<script>
import { defineComponent, reactive, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import { firstBy } from 'thenby'
import Case from 'case'
import moment from 'moment'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb-browser'
import { useAuthStore } from '@/stores'
import { useQuasar } from 'quasar'
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'QObservationListTemplate',
  components: {},
  props: {
    auth: Object,
    online: Boolean,
    couchdb: String,
    pin: String,
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
    oidc: {
      type: Array,
      default: function () { return []}
    }
  },
  emits: ['loading', 'open-form', 'reload-drawer', 'reload-complete', 'remove-oidc'],
  setup (props, { emit }) {
    const $q = useQuasar()
    const { addSchemaOptions, eventAdd, fetchJSON, fhirModel, fhirReplace, getPrefix, groupItems, importFHIR, inbox, loadSelect, removeTags, sync, timelineResources, timelineUpdate } = common()
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
      resource: '',
      provider: false,
      user: {},
      within_page: 'q-pa-md q-gutter-md',
      preview: true
    })
    const auth = useAuthStore()
    var prefix = getPrefix()
    var localDB = new PouchDB(prefix + props.resource)
    onMounted(async() => {
      state.auth = props.auth
      state.online = props.online
      state.couchdb = props.couchdb
      state.pin = props.pin
      state.base = props.base
      state.schema = props.schema
      state.title = Case.title(props.resource)
      state.user = props.user
      state.patient = props.patient
      state.provider = props.provider
      state.resource = props.resource
      if (props.within_page == true) {
        state.within_page = 'q-gutter-md'
      }
      if (typeof state.base.pageOpen !== 'undefined') {
        state.pageOpen = state.base.pageOpen
      }
      await loadList()
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
    watch(() => props.oidc, (newVal) => {
      if (newVal !== '') {
        reloadList()
      }
    },{deep: true})
    const attestRow = async(doc) => {
      objectPath.set(doc, '')
      if (props.resource === 'observations') {
        objectPath.set(doc, 'performer.0.reference', props.user.reference)
      }
      await sync(props.resource, false, props.patient, true, doc)
      await reloadList()
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource.replace('_statements', '').replace('_references', '')) + ' has been marked as confirmed.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const clearDefault = () => {
      state.section_default = {} 
    }
    const deleteOIDCRow = async(index, origin) => {
      emit('remove-oidc', index, props.resource, origin)
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource.replace('_statements', '').replace('_references', '')) + ' has been removed.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const deleteOIDCRows = async(index, origin) => {
      for (const row of objectPath.get(state, 'rows.' + index + '.content')) {
        const oidc_index = objectPath.get(row, 'doc._oidc_index')
        emit('remove-oidc', oidc_index, props.resource, origin)
      }
      $q.notify({
        message: 'The ' + props.resource.replace('_statements', '').replace('_references', '') + ' have been removed.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const deleteRow = async(doc) => {
      const result = await localDB.remove(doc)
      const opts = {
        doc_db: props.resource,
        doc_id: result.id,
        diff: null
      }
      await eventAdd('Deleted ' + pluralize.singular(props.resource.replace('_statements', '').replace('_references', '')), props.patient, opts)
      if (timelineResources.includes(props.resource)) {
        await timelineUpdate([{id: doc._id, resource: props.resource}], 'delete')
      }
      auth.setSyncResource(props.resource)
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource.replace('_statements', '').replace('_references', '')) + ' has been deleted.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
      emit('reload-drawer', props.resource)
      await reloadList()
    }
    const deleteRows = async(index) => {
      for (const row of objectPath.get(state, 'rows.' + index + '.content')) {
        const result = await localDB.remove(row.doc)
        const opts = {
          doc_db: props.resource,
          doc_id: result.id,
          diff: null
        }
        await eventAdd('Deleted ' + pluralize.singular(props.resource.replace('_statements', '').replace('_references', '')), props.patient, opts)
        if (timelineResources.includes(props.resource)) {
          await timelineUpdate([{id: doc._id, resource: props.resource}], 'delete')
        }
        auth.setSyncResource(props.resource)
      }
      $q.notify({
        message: 'The ' + props.resource.replace('_statements', '').replace('_references', '') + ' have been deleted.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const importRow = async(doc, index, origin) => {
      objectPath.del(doc, '_oidc_index')
      await importFHIR(doc, props.resource, props.patient, origin)
      emit('remove-oidc', index, props.resource, origin)
      $q.notify({
        message: 'The ' + pluralize.singular(props.resource.replace('_statements', '').replace('_references', '')) + ' has been imported.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const importRows = async(index, origin) => {
      for (const row of objectPath.get(state, 'rows.' + index + '.content')) {
        const oidc_index = objectPath.get(row, 'doc._oidc_index')
        objectPath.del(row, 'doc._oidc_index')
        await importFHIR(row.doc, props.resource, props.patient, origin)
        emit('remove-oidc', oidc_index, props.resource, origin)
      }
      $q.notify({
        message: 'The ' + props.resource.replace('_statements', '').replace('_references', '') + ' have been imported.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const fhirMap = async() => {
      const groups = state.result.reduce((groups, doc) => {
        const date = doc.doc.effectiveDateTime.split(' ')[0]
        if (!groups[date]) {
          groups[date] = []
        }
        groups[date].push(doc.doc)
        return groups
      }, {})
      const groups_arr = Object.keys(groups).map((date) => {
        return {
          date,
          docs: groups[date]
        }
      })
      for (const a in groups_arr) {
        objectPath.set(state, 'rows.' + a + '.id', moment(groups_arr[a].date).unix())
        objectPath.set(state, 'rows.' + a + '.title', groups_arr[a].date)
        objectPath.set(state, 'rows.' + a + '.subhead', '')
        const content_arr = []
        for (const doc of groups_arr[a].docs) {
          const content_item = {}
          objectPath.set(content_item, 'id', doc._id)
          objectPath.set(content_item, 'title', fhirReplace('title', state.base, doc, props.schema.flat()))
          const content_val_arr = fhirReplace('content', state.base, doc, props.schema.flat())
          objectPath.set(content_item, 'text', objectPath.get(content_val_arr, '0.value') + ' ' + objectPath.get(content_val_arr, '1.value'))
          if (objectPath.has(doc, 'interpretation.0.coding0.status')) {
            if (objectPath.get(doc, 'interpretation.0.coding0.status') !== 'N') {
              objectPath.set(content_item, 'icon', 'priority_high')
              objectPath.set(content_item, 'icon_color', 'red')
            } else {
              objectPath.set(content_item, 'icon', 'thumb_up')
              objectPath.set(content_item, 'icon_color', 'green')
            }
          }
          objectPath.set(content_item, 'doc', doc)
          objectPath.set(content_item, '.author', getAuthor(doc))
          objectPath.set(content_item, 'delete', 'y')
          content_arr.push(content_item)
        }
        objectPath.set(state, 'rows.' + a + '.content', content_arr)
        objectPath.set(state, 'rows.' + a + '.delete', 'y')
      }
      if (props.oidc !== null && props.oidc.length > 0) {
        let a1 = state.rows.length
        for (const e in props.oidc) {
          if (objectPath.has(props, 'oidc.' + e + '.docs')) {
            const oidc_results = props.oidc[e].docs.find(f => f.resource === props.resource)
            if (oidc_results !== undefined) {
              let g1 = 0
              const oidc_resource_results = []
              if (objectPath.has(oidc_results, 'rows')) {
                if (oidc_results.rows.length > 0) {
                  for (const g of oidc_results.rows) {
                    let comp_category = false
                    const comp = state.rows.find(h => objectPath.get(h, 'doc.' + state.base.compField) === objectPath.get(g, state.base.compField))
                    if (g.category[0].coding[0].code === props.category) {
                      comp_category = true
                    }
                    if (comp === undefined && comp_category) {
                      objectPath.set(g, '_oidc_index', g1)
                      oidc_resource_results.push(g)
                    }
                    g1++
                  }
                  const oidc_groups = oidc_resource_results.reduce((oidc_groups, doc) => {
                    const date = doc.effectiveDateTime.split(' ')[0]
                    if (!oidc_groups[date]) {
                      oidc_groups[date] = []
                    }
                    oidc_groups[date].push(doc)
                    return oidc_groups
                  }, {})
                  const oidc_groups_arr = Object.keys(oidc_groups).map((date) => {
                    return {
                      date,
                      docs: oidc_groups[date]
                    }
                  })
                  for (const a in oidc_groups_arr) {
                    objectPath.set(state, 'rows.' + a1 + '.id', moment(oidc_groups_arr[a].date).unix())
                    objectPath.set(state, 'rows.' + a1 + '.title', oidc_groups_arr[a].date)
                    objectPath.set(state, 'rows.' + a1 + '.subhead', '')
                    objectPath.set(state, 'rows.' + a1 + '.oidc', props.oidc[e].origin)
                    const content_arr = []
                    for (const doc of oidc_groups_arr[a].docs) {
                      const content_item = {}
                      objectPath.set(content_item, 'id', doc._id)
                      objectPath.set(content_item, 'title', fhirReplace('title', state.base, doc, props.schema.flat()))
                      const content_val_arr = fhirReplace('content', state.base, doc, props.schema.flat())
                      objectPath.set(content_item, 'text', objectPath.get(content_val_arr, '0.value') + ' ' + objectPath.get(content_val_arr, '1.value'))
                      if (objectPath.has(doc, 'interpretation.0.coding0.status')) {
                        if (objectPath.get(doc, 'interpretation.0.coding0.status') !== 'N') {
                          objectPath.set(content_item, 'icon', 'priority_high')
                          objectPath.set(content_item, 'icon_color', 'red')
                        } else {
                          objectPath.set(content_item, 'icon', 'thumb_up')
                          objectPath.set(content_item, 'icon_color', 'green')
                        }
                      }
                      objectPath.set(content_item, 'doc', doc)
                      objectPath.set(content_item, 'delete', 'y')
                      content_arr.push(content_item)
                    }
                    objectPath.set(state, 'rows.' + a1 + '.content', content_arr)
                    objectPath.set(state, 'rows.' + a1 + '.delete', 'y')
                    a1++
                  }
                }
              }
            }
          }
        }
      }
    }
    const getAuthor = (doc) => {
      let a = ''
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
    const loading = () => {
      emit('loading')
    }
    const loadList = async(status = 'all') => {
      emit('loading')
      state.rows = []
      state.result = []
      let selector = {'category.0.coding.0.code': {$eq: props.category}, [state.base.patientField]: {$eq: 'Patient/' + props.patient }, _id: {"$gte": null}}
      try {
        const result = await localDB.find({selector: selector})
        for (const j in result.docs) {
          objectPath.set(state, 'result.' + j + '.doc', result.docs[j])
        }
        await fhirMap()
        if (status !== 'all') {
          state.rows = state.rows.filter(row => row.status == Case.title(status))
        }
        state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('title', {ignoreCase:true, direction:'desc'}))
      } catch (err) {
        console.log(err)
      }
      emit('loading')
    }
    const onFormOpen = (id) => {
      if (id === 'add') {
        emit('open-form', id, props.resource)
      } else {
        emit('open-form', id, props.resource, props.category)
      }
    }
    const reloadList = async(status = 'all') => {
      // state.rows = []
      await loadList(status)
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
      clearDefault,
      deleteOIDCRow,
      deleteOIDCRows,
      deleteRow,
      deleteRows,
      fetchJSON,
      fhirMap,
      fhirModel,
      fhirReplace,
      getAuthor,
      groupItems,
      importRow,
      importRows,
      inbox,
      loading,
      loadList,
      loadSelect,
      onFormOpen,
      reloadList,
      removeTags,
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
