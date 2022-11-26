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
    const query = () => {
      state.cards = []
      var results = props.doc.entry.filter(a => a.resource.resourceType == Case.pascal(pluralize.singular(props.resource)))
      for (var b in results) {
        objectPath.set(state, 'result.' + b + '.doc', results[b].resource)
      }
      tableMap()
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
          let d = c.doc.category.some(({ coding }) => coding.some(({ code }) => code === state.base.categories[a].value))
          return d
        })
        if (sub.length !== 0) {
          for (var e in sub) {
            var docrow = {}
            for (var f in schema) {
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
