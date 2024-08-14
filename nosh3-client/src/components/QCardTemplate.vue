<template>
  <div class="q-pa-md q-gutter-md">
    <q-card v-for="(row, index) in state.rows" :key="row.id" :class="{'bg-negative': row.status == 'inactive'}">
      <q-card-section clickable @click="onFormOpen(row.id)">
        <div class="text-h6">{{ row.title }}</div>
        <div class="text-subtitle2">{{ row.subhead }}</div>
      </q-card-section>
      <q-card-section clickable @click="onFormOpen(row.id)">
        <div :class="{'q-gutter-sm row': state.base[state.data.category].uiListContent.contentStyle == 'p'}">
          <span class="col-4" v-for="data in row.content" :key="data.key">
            <QInfoTemplate
              :data="data"
              :style="state.base[state.data.category].uiListContent.contentStyle"
            />
          </span>
        </div>
      </q-card-section>
      <q-expansion-item v-if="row.extended !== '' && row.extended !== undefined && row.extended !== 'undefined'">
        <q-card>
          <q-card-section>{{ row.extended }}</q-card-section>
        </q-card>
      </q-expansion-item>
      <q-separator />
      <q-card-actions align="right">
        <q-btn v-if="row.delete === 'y'" flat round color="red" icon="delete" clickable @click="deleteRow(index)">
          <q-tooltip>Delete</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>
  </div>
</template>

<script>
import { defineComponent, reactive, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import { firstBy } from 'thenby'
import objectPath from 'object-path'
import QInfoTemplate from './QInfoTemplate.vue'

export default defineComponent({
  name: 'QCardTemplate',
  components: {
    QInfoTemplate
  },
  emits: ['open-form', 'reload-complete'],
  props: {
    auth: Object,
    online: Boolean,
    couchdb: String,
    pin: String,
    patient: String,
    data: Object,
    result: Object,
    sort: String,
    reload: Boolean,
    states: Array,
    countries: Array,
    language: Array,
    schema: Object
  },
  setup (props, { emit }) {
    const { addSchemaOptions, sync, syncEmailToUser } = common()
    const state = reactive({
      data: {},
      style: '',
      rows: [],
      result: [],
      countries: [],
      states: [],
      language: []
    })
    onMounted(async() => {
      state.data = props.data
      state.result = props.result
      state.base = await import('@/assets/fhir/' + state.data.resource + '.json')
      state.schema = props.schema
      fhirMap()
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
    watch(() => props.reload, (newVal) => {
      if (newVal) {
        state.result = props.result
        fhirMap()
        emit('reload-complete')
      }
    })
    const deleteRow = async(index) => {
      state.result[state.data.category].splice(index,1)
      state.rows.splice(index,1)
      await sync(state.data.resource, false, props.patient, true, state.result)
      await syncEmailToUser(state.data.resource, state.data.category, state.result, props.patient)
    }
    const fhirMap = () => {
      for (const a in state.result[state.data.category]) {
        objectPath.set(state, 'rows.' + a + '.id', a)
        objectPath.set(state, 'rows.' + a + '.title', fhirReplace('title', a))
        objectPath.set(state, 'rows.' + a + '.subhead', fhirReplace('subhead', a))
        objectPath.set(state, 'rows.' + a + '.content', fhirReplace('content', a))
        objectPath.set(state, 'rows.' + a + '.extended', fhirReplace('extended', a))
        objectPath.set(state, 'rows.' + a + '.status', fhirReplace('status', a))
        objectPath.set(state, 'rows.' + a + '.delete', 'y')
        if (state.data.resource === 'patients' ||
            state.data.resource === 'practitioners' ||
            state.data.resource === 'related_persons') {
          if (state.data.category === 'identity') {
            if (a !== 0) {
              objectPath.set(state, 'rows.' + a + '.delete', 'n')
            }
          }
        }
      }
    }
    const fhirModel = (field, index) => {
      let model = field.modelParent + '.' + index + '.' + field.model
      if (typeof field.modelRoot !== 'undefined') {
        if (field.modelArray == false) {
          model = field.modelParent + '.' + index + '.' + field.modelRoot + '.' + field.model
        } else {
          if (field.multiple == true) {
            model = field.modelParent + '.' + index + '.' + field.modelRoot
          } else {
            model = field.modelParent + '.' + index + '.' + field.modelRoot + '.0.' + field.model
          }
        }
      }
      return model
    }
    const fhirReplace = (key, index) => {
      const uiSchema = state.schema.flat()
      const row = state.base[state.data.category].uiListContent[key]
      let str = ''
      let field = ''
      let model = ''
      let value = ''
      if (key === 'content') {
        const models = []
        for (const a in state.base[state.data.category].uiListContent.contentFields) {
          if (state.base[state.data.category].uiListContent.contentFields[a] == 'state') {
            const c_field = uiSchema.find(({ id }) => id === 'country')
            const c_model = fhirModel(c_field, index)
            if (objectPath.has(state, 'result.' + c_model)) {
              const stateRow = props.states.find(state1 => state1.iso2 == objectPath.get(state, 'result.' + c_model))
              state.schema = addSchemaOptions('state', stateRow.states, 'state_code', 'name', state.schema)
            }
          }
          field = uiSchema.find(({ id }) => id === state.base[state.data.category].uiListContent.contentFields[a])
          model = fhirModel(field, index)
          const obj = {}
          if (objectPath.has(state, 'result.' + model)) {
            obj['key'] = field.label
            obj['value'] = objectPath.get(state, 'result.' + model)
            if (typeof field.modelOne !== 'undefined') {
              if (objectPath.has(state, 'result.0.' + model + '.' + field.modelOne + '.' + field.modelEnd)) {
                obj['value'] = objectPath.get(state, 'result.' + model + '.' + field.modelOne + '.' + field.modelEnd)
              }
              if (objectPath.has(state,'result.' + model + '.' + field.modelRange[0] + '.' + field.modelEnd)) {
                obj['value'] = objectPath.get(state, 'result.' + model + '.' + field.modelRange[0] + '.' + field.modelEnd)
                obj['value'] += ' to '
                obj['value'] += objectPath.get(state, 'result.' + model + '.' + field.modelRange[1] + '.' + field.modelEnd)
              }
            }
            if (typeof field.modelChoice !== 'undefined') {
              for (const b in field.modelChoice) {
                if (objectPath.has(state, 'result.' + model + '.' + field.modelChoice[b] + '.' + field.modelEnd)) {
                  obj['value'] = objectPath.get(state, 'result.' + model + '.' + field.modelChoice[b] + '.' + field.modelEnd)
                }
              }
            }
            if (typeof field.text !== 'undefined') {
              if (objectPath.has(state, 'result.' + model + '.' + field.text)) {
                obj['value'] = objectPath.get(state, 'result.' + model + '.' + field.text)
              }
            }
            if (obj['value'] !== undefined && obj['value'] !== '') {
              if (typeof field.options !== 'undefined') {
                if (field.multiple === true) {
                  if (Array.isArray(obj['value'])) {
                    for (const c in obj['value']) {
                      let d = {}
                      if (typeof field.modelRoot !== 'undefined') {
                        d = field.options.find(({ value }) => value === obj['value'][c][field.model])
                      } else {
                        d = field.options.find(({ value }) => value === obj['value'][c])
                      }
                      if (c !== '0') {
                        value += '; '
                      }
                      value += d.label
                    }
                    obj['value'] = value
                  } else {
                    const e = field.options.find(({ value }) => value === obj['value'])
                    obj['value'] = e.label
                  }
                } else {
                  const f = field.options.find(({ value }) => value === obj['value'])
                  obj['value'] = f.label
                }
              }
              models.push(obj)
            }
          }
        }
        return models
      } else {
        const found = []
        let rxp = /{([^}]+)}/g
        let curMatch
        let replaceWith = []
        let mapping = {}
        str = row
        while((curMatch = rxp.exec(str))) {
          found.push(curMatch[1])
        }
        for (const g in found) {
          field = uiSchema.find(({ id }) => id === found[g])
          model = fhirModel(field, index)
          if (objectPath.has(state, 'result.' + model)) {
            replaceWith[g] = objectPath.get(state, 'result.' + model)
            if (typeof field.options !== 'undefined') {
              if (field.multiple === true) {
                if (Array.isArray(obj['value'])) {
                  for (const h in obj['value']) {
                    let i = {}
                    if (typeof field.modelRoot !== 'undefined') {
                      i = field.options.find(({ value }) => value === obj['value'][h][field.model])
                    } else {
                      i = field.options.find(({ value }) => value === obj['value'][h])
                    }
                    if (h !== '0') {
                      value += '; '
                    }
                    value += i.label
                  }
                  replaceWith[g] = value
                } else {
                  const j = field.options.find(({ value }) => value === replaceWith[g])
                  replaceWith[g] = j.label
                }
              } else {
                const k = field.options.find(({ value }) => value === replaceWith[g])
                replaceWith[g] = k.label
              }
            }
          } else {
            if (found[g] == 'periodEnd') {
              replaceWith[g] = 'present'
            } else {
              replaceWith[g] = ''
            }
          }
        }
        found.forEach((e,i) => mapping[`{${e}}`] = replaceWith[i])
        str = str.replace(/\{\w+\}/ig, n => mapping[n])
        return str
      }
    }
    const onFormOpen = (id) => {
      emit('open-form', state.data.id, state.data.resource, state.data.category, id)
    }
    const sortDate = () => {
      state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('subhead', {ignoreCase:true, direction:'desc'}))
    }
    const sortTitle = () => {
      state.rows.sort(firstBy('status', {ignoreCase:true, direction:'asc'}).thenBy('title', {ignoreCase:true, direction:'asc'}))
    }
    return {
      addSchemaOptions,
      deleteRow,
      fhirMap,
      fhirModel,
      fhirReplace,
      onFormOpen,
      sortDate,
      sortTitle,
      sync,
      syncEmailToUser,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
