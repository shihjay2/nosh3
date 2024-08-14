<template>
  <div :class="state.within_page">
    <q-card v-for="(row, index) in state.rows" :key="row.id" :class="{'bg-negative': row.status == 'inactive'}">
      <q-card-section>
        <div class="text-h6 text-primary">{{ row.title }}</div>
        <div class="text-subtitle2">{{ row.subhead }} {{ row.id }}</div>
      </q-card-section>
      <q-card-section>
        <span v-for="data in row.content" :key="data.key">
          <QInfoTemplate
            :data="data"
            :style="state.base.uiListContent.contentStyle"
          />
        </span>
      </q-card-section>
      <div v-if="row.section">
        <q-list v-for="row0 in row.section" :key="row0.id">
          <q-item clickable>
            <q-item-section avatar>
              <q-icon color="primary" :name="row0.icon" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ row0.title }}</q-item-label>
              <q-item-label caption><span v-html="row0.text"></span></q-item-label>
            </q-item-section>
            <q-item-section side top>
              <q-icon color="red" name="delete"/>
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
        <div class="text-h6 text-teal">Recent Care Plan</div>
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
    </q-card>
  </div>
</template>

<script>
import { defineComponent, reactive, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import { firstBy } from 'thenby'
import Case from 'case'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import QInfoTemplate from './QInfoTemplate.vue'

export default defineComponent({
  name: 'QBundleListTemplate',
  components: {
    QInfoTemplate
  },
  props: {
    doc: Object,
    resource: String,
    base: Object,
    schema: Object,
    reload: Boolean,
    sort: String,
    within_page: Boolean,
    online: Boolean
  },
  emits: ['reload-complete'],
  setup (props, { emit }) {
    const { fetchJSON, fhirModel, fhirReplace, removeTags } = common()
    const state = reactive({
      base: {},
      pageOpen: false,
      title: '',
      rows: [],
      result: [],
      within_page: 'q-pa-md q-gutter-md',
      // care_plans
      resources: [],
    })
    onMounted(async() => {
      state.base = props.base
      state.title = Case.title(props.resource)
      const resources = await fetchJSON('resources', props.online)
      state.resources = resources.rows
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
    const fhirMap = async() => {
      for (const a in state.result) {
        objectPath.set(state, 'rows.' + a + '.id', objectPath.get(state, 'result.' + a + '.doc.id'))
        objectPath.set(state, 'rows.' + a + '.title', fhirReplace('title', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.subhead', fhirReplace('subhead', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.content', fhirReplace('content', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.extended', fhirReplace('extended', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.status', fhirReplace('status', state.base, state.result[a].doc, props.schema.flat()))
        objectPath.set(state, 'rows.' + a + '.doc', objectPath.get(state, 'result.' + a + '.doc'))
      }
      if (props.resource === 'care_plans') {
        for (const b in state.rows) {
          if (objectPath.has(state, 'rows.' + b + '.doc.activity')) {
            getActivity(b, objectPath.get(state, 'rows.' + b + '.doc.activity'))
          }
        }
      }
      if (props.resource === 'compositions') {
        for (const c in state.rows) {
          if (objectPath.has(state, 'rows.' + c + '.doc.section')) {
            for (const d in objectPath.get(state, 'rows.' + c + '.doc.section')) {
              objectPath.set(state, 'rows.' + c + '.section.' + d + '.title', objectPath.get(state, 'rows.' + c + '.doc.section.' + d + '.title'))
              objectPath.set(state, 'rows.' + c + '.section.' + d + '.text', objectPath.get(state, 'rows.' + c + '.doc.section.' + d + '.text.div'))
              objectPath.set(state, 'rows.' + c + '.section.' + d + '.icon', 'note_alt')
            }
          }
        }
      }
    }
    const getActivity = (a, activity) => {
      const progress = []
      const outcome = []
      const results = []
      for (const b of activity) {
        const resource = b.reference.split('/').slice(0,-1).join('')
        const id = b.reference.split('/').slice(-1).join('')
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
        const list = props.doc.entry.filter(a1 => a1.resource.resourceType == Case.pascal(pluralize.singular(resource)))
        const item = list.find(a2 => a2.resource.id == id)
        results.push(item.resource)
      }
      for (const c in results) {
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.id', results[c].id)
        const d = Case.snake(pluralize(results[c].resourceType))
        const e = state.resources.find(({resource}) => resource === d)
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.icon', e.icon)
        let f = Case.capital(pluralize.singular(d))
        if (f == 'Medication Statement') {
          f = 'Continue Medication'
        }
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.label', f + ': ' + removeTags(results[c].text.div))
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.progress', progress[c])
        objectPath.set(state, 'rows.' + a + '.activity.' + c + '.outcome', outcome[c])
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
      //     var list = props.doc.entry.filter(a1 => a1.resource.resourceType == Case.pascal(pluralize.singular(resource)))
      //     var item = list.find(a2 => a2.resource.id == id)
      //     return item.resource
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
      //     }
      //     resolve()
      //   }).catch(function (err) {
      //     console.log(err)
      //   })
      // })
    }
    const loadList = async() => {
      const results = props.doc.entry.filter(a => a.resource.resourceType == Case.pascal(pluralize.singular(props.resource)))
      for (const b in results) {
        objectPath.set(state, 'result.' + b + '.doc', results[b].resource)
      }
      await fhirMap()
    }
    const reloadList = () => {
      state.rows = []
      setTimeout(async() => {
        await loadList()
      }, 200)
    }
    const sortTitle = () => {
      state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('title', {ignoreCase:true, direction:'asc'}))
    }
    const sortDate = () => {
      state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('subhead', {ignoreCase:true, direction:'desc'}))
    }
    return {
      fetchJSON,
      fhirMap,
      fhirModel,
      fhirReplace,
      getActivity,
      loadList,
      reloadList,
      removeTags,
      sortTitle,
      sortDate,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
