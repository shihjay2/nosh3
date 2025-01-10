<template>
  <div class="q-gutter-md">
    <q-card v-for="card in state.cards" :key="card.id">
      <q-table
        v-if='"rows" in card'
        :rows="card.rows"
        :columns="card.columns"
        :filter="card.filter"
        row-key="id"
        :visible-columns="card.visibleColumns"
        v-model:pagination="state.pagination"
        :rows-per-page-options="[0]"
        :wrap-cells="state.wrap"
      >
        <template v-slot:top>
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
import { defineComponent, reactive, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import Case from 'case'
import objectPath from 'object-path'
import pluralize from 'pluralize'

export default defineComponent({
  name: 'QBundleMixedTemplate',
  components: {
  },
  props: {
    doc: Object,
    resource: String,
    reload: Boolean,
    base: Object,
    schema: Object,
  },
  emits: ['reload-complete'],
  setup (props, { emit }) {
    const { getItem } = common()
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
    onMounted(async() => {
      state.base = props.base
      state.schema = props.schema
      query()
    })
    watch(() => props.reload, (newVal) => {
      if (newVal) {
        query()
        emit('reload-complete')
      }
    })
    const query = () => {
      state.cards = []
      const results = props.doc.entry.filter(a => a.resource.resourceType == Case.pascal(pluralize.singular(props.resource)))
      for (const b in results) {
        objectPath.set(state, 'result.' + b + '.doc', results[b].resource)
      }
      tableMap()
    }
    const tableMap = async() => {
      for (const a in state.base.categories) {
        objectPath.set(state, 'cards.' + a + '.category', state.base.categories[a].label)
        objectPath.set(state, 'cards.' + a + '.section', state.base.categories[a].value)
        objectPath.set(state, 'cards.' + a + '.visibleColumns', state.base.categories[a].visibleColumns)
        objectPath.set(state, 'cards.' + a + '.filter', '')
        objectPath.set(state, 'cards.' + a + '.id', a)
        objectPath.set(state, 'cards.' + a + '.loading', false)
        const schema = state.base.categories[a].docSchema
        for (const b in schema) {
          const colrow = {}
          objectPath.set(colrow, 'name', objectPath.get(schema, b + '.id'))
          objectPath.set(colrow, 'label', objectPath.get(schema, b + '.label'))
          objectPath.set(colrow, 'field', objectPath.get(schema, b + '.id'))
          objectPath.set(colrow, 'align', 'left')
          objectPath.set(state, 'cards.' + a + '.columns.' + b, colrow)
        }
        const sub = state.result.filter(c => {
          let d = c.doc.category.some(({ coding }) => coding.some(({ code }) => code === state.base.categories[a].value))
          return d
        })
        if (sub.length !== 0) {
          for (const e in sub) {
            const docrow = {}
            for (const f in schema) {
              objectPath.set(docrow, objectPath.get(schema, f + '.id'), getItem(schema[f], '0', sub[e].doc))
            }
            objectPath.set(docrow, 'resourceName', state.base.categories[a].label)
            objectPath.set(docrow, 'category', state.base.categories[a].value)
            objectPath.set(state, 'cards.' + a + '.rows.' + e, docrow)
          }
        }
      }
    }
    return {
      getItem,
      tableMap,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
