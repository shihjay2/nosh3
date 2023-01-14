<template>
  <div class="q-gutter-md">
    <q-select
      v-model="state.section"
      label="Add"
      name="section"
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
    <q-card v-for="card in state.cards" :key="card.id">
      <q-table
        v-if='"rows" in card'
        :rows="card.rows"
        :columns="card.columns"
        :filter="card.filter"
        row-key="id"
        :visible-columns="card.visibleColumns"
        @row-click="onClick"
        selection="single"
        v-model:selected="state.selected"
        v-model:pagination="state.pagination"
        :rows-per-page-options="[0]"
        :wrap-cells="state.wrap"
      >
        <template v-slot:top>
          <q-btn-group>
            <q-btn size="xs" padding="xs" color="primary" :disable="card.loading" icon="add" clickable @click="addRow(card.category, card.section)">
              <q-tooltip>Add</q-tooltip>
            </q-btn>
            <q-btn size="xs" padding="xs" color="primary" :disable="card.loading" icon="delete" clickable @click="removeRow(card.id)">
              <q-tooltip>Remove</q-tooltip>
            </q-btn>
            <q-btn size="xs" padding="xs" color="primary" :disable="card.loading" icon="insights" clickable @click="graphRow()">
              <q-tooltip>Graph</q-tooltip>
            </q-btn>
          </q-btn-group>
          <q-toolbar-title class="text-primary">{{ card.category }}</q-toolbar-title>
          <q-input dense debounce="300" color="primary" v-model="card.filter">
            <template v-slot:append>
              <q-icon name="search" />
            </template>
          </q-input>
        </template>
        <template v-slot:body-cell="props">
          <q-td
            :props="props"
            :class="(props.row.interpretation !== 'Normal')? 'text-red': 'text-black'"
          >
            {{ props.value }}
          </q-td>
        </template>
      </q-table>
    </q-card>
  </div>
</template>

<script>
import { defineComponent, reactive, ref, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores'
import { common } from '@/logic/common'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'QMixedTemplate',
  components: {
  },
  props: {
    encounter: String,
    patient: String,
    category: String,
    resource: String,
    reload: Boolean,
    base: Object,
    schema: Object,
    online: Boolean,
    options: Array
  },
  emits: ['open-form', 'open-graph', 'reload-complete'],
  setup (props, { emit }) {
    const { eventAdd } = common()
    const state = reactive({
      base: {},
      schema: {},
      cards: [],
      result: [],
      section: '',
      filter: '',
      selected: [],
      wrap: true,
      pagination: {rowsPerPage: 0}
    })
    const auth = useAuthStore()
    var prefix = ''
    if (auth.instance === 'digitalocean' && auth.type === 'pnosh') {
      prefix = auth.patient + '_'
    }
    var localDB = new PouchDB(prefix + props.resource)
    onMounted(async() => {
      state.base = props.base
      state.schema = props.schema
      await query()
    })
    watch(() => props.reload, async(newVal) => {
      if (newVal) {
        await query()
        emit('reload-complete')
      }
    })
    watch(() => state.section, (newVal) => {
      var defaults = {}
      if (newVal.value === 'survey') {
        objectPath.set(defaults, 'codeValue', '{score}')
      }
      
      onFormOpen('add', newVal.value, '', defaults)
    })
    const addRow = (label, value) => {
      var defaults = {}
      if (value === 'survey') {
        objectPath.set(defaults, 'codeValue', '{score}')
      }
      onFormOpen('add', value, '', defaults)
    }
    const filterFn = (val, update) => {
      update(() => {
        const needle = val.toLocaleLowerCase()
        qOptions.value = props.options.filter(v => v['label'].toLocaleLowerCase().indexOf(needle) > -1)
      })
    }
    const getItem = (schema, index, fhir) => {
      var model = ''
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
        var a = []
        if (schema.modelRoot !== undefined) {
          if (schema.modelParent !== undefined) {
            for (var b in objectPath.get(fhir, schema.modelParent + '.' + index + '.' + schema.modelRoot)) {
              a[b] = objectPath.get(fhir, schema.modelParent + '.' + index + '.' + schema.modelRoot + '.' + b  + '.' + schema.model)
            }
          } else {
            for (var b1 in objectPath.get(fhir, schema.modelRoot)) {
              a[b1] = objectPath.get(fhir, schema.modelRoot + '.' + b1  + '.' + schema.model)
            }
          }
          if (a.length > 0) {
            return a
          }
        } else {
          return objectPath.get(state, 'fhir.' + model)
        }
      } else if (schema.modelOne !== undefined) {
        var c = ''
        if (objectPath.has(fhir, model + '.' + schema.modelOne + '.' + schema.modelEnd)) {
          c = objectPath.get(fhir, model + '.' + schema.modelOne + '.' + schema.modelEnd)
        } else {
          if (objectPath.has(fhir, model + '.' + schema.modelRange[0] + '.' + schema.modelEnd)) {
            c = objectPath.get(fhir, model + '.' + schema.modelRange[0] + '.' + schema.modelEnd)
            c += ' to '
            c += objectPath.get(fhir, model + '.' + schema.modelRange[1] + '.' + schema.modelEnd)
          }
        }
        return c
      } else if (schema.modelChoice !== undefined) {
        var d = ''
        for (var e in schema.modelChoice) {
          if (objectPath.has(fhir, model + '.' + schema.modelChoice[e] + '.' + schema.modelEnd)) {
            d = objectPath.get(fhir, model + '.' + schema.modelChoice[e] + '.' + schema.modelEnd)
          }
        }
        return d
      } else if (schema.text !== undefined) {
        return objectPath.get(state, 'fhir.' + model + '.' + schema.text)
      } else if (schema.div !== undefined) {
        if (objectPath.has(fhir, model)) {
          return removeTags(objectPath.get(fhir, model))
        }
      } else {
        return objectPath.get(fhir, model)
      }
    }
    const graphRow = () => {
      emit('open-graph', 'dft', state.selected[0].code1)
    }
    const onFormOpen = (id, category = 'all', index = '', defaults = {}) => {
      emit('open-form', id, props.resource, category, index, defaults)
    }
    const onClick = (evt, row) => {
      onFormOpen(row.id, row.category)
    }
    const qOptions = ref(props.options)
    const query = async() => {
      state.cards = []
      var result = await localDB.find({
        selector: {[state.base.indexField]: {$eq: [state.base.indexRoot] + '/' + props.encounter}, _id: {"$gte": null}}
      })
      state.result = result.docs
      tableMap()
    }
    const removeRow = async(id) => {
      state.cards[id].loading = true
      var doc = await localDB.get(state.selected[0].id)
      const result = await localDB.remove(doc)
      const opts = {
        doc_db: props.resource,
        doc_id: result.id,
        diff: null
      }
      await eventAdd('Deleted ' + pluralize.singular(props.resource.replace('_statements', '')), props.online, props.patient, opts)
      await query()
    }
    const removeTags = (str) => {
      if ((str===null) || (str==='')) {
        return false
      } else {
        str = str.toString()
        return str.replace( /(<([^>]+)>)/ig, '')
      }
    }
    const tableMap = async() => {
      for (var a in state.base.categories) {
        objectPath.set(state, 'cards.' + a + '.category', state.base.categories[a].label)
        objectPath.set(state, 'cards.' + a + '.section', state.base.categories[a].value)
        objectPath.set(state, 'cards.' + a + '.visibleColumns', state.base.categories[a].visibleColumns)
        objectPath.set(state, 'cards.' + a + '.filter', '')
        objectPath.set(state, 'cards.' + a + '.id', a)
        objectPath.set(state, 'cards.' + a + '.loading', false)
        var schema = state.base.categories[a].docSchema
        for (var b in schema) {
          var colrow = {}
          objectPath.set(colrow, 'name', objectPath.get(schema, b + '.id'))
          objectPath.set(colrow, 'label', objectPath.get(schema, b + '.label'))
          objectPath.set(colrow, 'field', objectPath.get(schema, b + '.id'))
          objectPath.set(colrow, 'align', 'left')
          objectPath.set(state, 'cards.' + a + '.columns.' + b, colrow)
        }
        var sub = state.result.filter(c => {
          let d = c.category.some(({ coding }) => coding.some(({ code }) => code === state.base.categories[a].value))
          return d
        })
        if (sub.length !== 0) {
          for (var e in sub) {
            var docrow = {}
            for (var f in schema) {
              objectPath.set(docrow, objectPath.get(schema, f + '.id'), getItem(schema[f], '0', sub[e]))
            }
            objectPath.set(docrow, 'resourceName', state.base.categories[a].label)
            objectPath.set(docrow, 'category', state.base.categories[a].value)
            objectPath.set(state, 'cards.' + a + '.rows.' + e, docrow)
          }
        }
      }
    }
    return {
      addRow,
      filterFn,
      getItem,
      graphRow,
      onFormOpen,
      onClick,
      qOptions,
      removeRow,
      removeTags,
      tableMap,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
