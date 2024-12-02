<template>
  <div class="q-pa-md">
    <div class="q-pa-md">
      <q-select
        v-model="state.history"
        label="Versions"
        name="section"
        ref="qRefSelect"
        :options="qOptions"
        use-input
        outlined
        dense="dense"
      >
      </q-select>
    </div>
    <div id="print_bundle">
      <q-card v-for="tab1 in state.base.tabs" :key="tab1.category">
        <q-card-section>
          <div class="text-h5 text-primary">{{ tab1.label }}</div>
        </q-card-section>
          <q-card v-if="tab1.template == 'list'">
            <QBundleListTemplate
              v-if="state.showList"
              @reload-complete="reloadComplete"
              :doc="state.doc"
              :reload="state.tabReload"
              :resource="tab1.resource"
              :sort="state.sort"
              :base="tab1.base"
              :schema="tab1.schema"
              :within_page="state.within_page"
              :online="state.online"
            />
          </q-card>
          <q-card-section v-if="tab1.template == 'mixed'">
            <QBundleMixedTemplate
              v-if="state.showList"
              @reload-complete="reloadComplete"
              :doc="state.doc"
              :reload="state.tabReload"
              :resource="tab1.resource"
              :base="tab1.base"
              :schema="tab1.schema"
            />
          </q-card-section>
          <q-card-section v-if="tab1.template == 'info'">
            <q-list v-for="data in state.data[tab1.category]" :key="data.key">
              <QInfoTemplate
                :data="data"
                :style="tab1.base.uiListContent.contentStyle"
              />
            </q-list>
          </q-card-section>
        <q-separator spaced inset />
      </q-card>
    </div>
  </div>
</template>

<script>
import { defineComponent, reactive, ref, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import Case from 'case'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import QBundleListTemplate from './QBundleListTemplate.vue'
import QBundleMixedTemplate from './QBundleMixedTemplate.vue'
import QInfoTemplate from './QInfoTemplate.vue'

export default defineComponent({
  name: 'QBundleTemplate',
  components: {
    QBundleListTemplate,
    QBundleMixedTemplate,
    QInfoTemplate
  },
  props: {
    doc: Object,
    resource: String,
    category: String,
    options: Array,
    history: Array,
    online: Boolean
  },
  setup (props, { emit }) {
    const { fetchJSON, loadSchema } = common()
    const state = reactive({
      base: {},
      doc: {},
      data: [],
      online: true
    })
    onMounted(async() => {
      state.doc = props.doc
      state.online = props.online
      state.base = await fetchJSON('fhir/bundles', props.online)
      for (const a in state.base.tabs) {
        if (typeof state.base.tabs[a].resource !== 'undefined') {
          if (state.base.tabs[a].resource === 'compositions' || state.base.tabs[a].resource === 'care_plans') {
            await loadResource(a, state.base.tabs[a].resource, 'all')
          } else if (state.base.tabs[a].resource === 'observations') {
            await loadResource(a, state.base.tabs[a].resource, 'vital-signs')
          } else if (state.base.tabs[a].resource === 'encounters') {
            await loadResource(a, state.base.tabs[a].resource, 'new')
            const d = props.doc.entry.find(b => b.resource.resourceType == Case.pascal(pluralize.singular(state.base.tabs[a].resource)))
            fhirMap(d.resource, state.base.tabs[a].category)
          } else {
            await loadResource(a, state.base.tabs[a].resource, state.base.tabs[a].category)
          }
        }
      }
      state.showList = true
    })
    watch(() => state.history, (newVal) => {
      emit('open-bundle', 'bundles', 'Bundle', props.history[newVal.value], props.history)
    })
    const fhirMap = (fhir, category) => {
      const a = state.base.tabs.find(b => b.category == category)
      if (!objectPath.has(state, 'data.' + category)) {
        objectPath.set(state, 'data.' + category, [])
      }
      const uiSchema = a.schema.flat()
      for (const b in uiSchema) {
        let model = uiSchema[b].model
        if (typeof uiSchema[b].modelRoot !== 'undefined') {
          if (uiSchema[b].modelArray == false) {
            model = uiSchema[b].modelRoot + '.' + uiSchema[b].model
          } else {
            if (uiSchema[b].multiple == true) {
              model = uiSchema[b].modelRoot
            } else {
              model = uiSchema[b].modelRoot + '.0.' + uiSchema[b].model
            }
          }
        }
        const obj = {}
        if (typeof uiSchema[b].modelRoot !== 'undefined' && uiSchema[b].modelArray !== false) {
          if (objectPath.has(fhir, uiSchema[b].modelRoot)) {
            const c = objectPath.get(fhir, uiSchema[b].modelRoot)
            obj['key'] = uiSchema[b].label
            obj['value'] = ''
            for (const d in c) {
              if (objectPath.has(fhir, uiSchema[b].modelRoot + '.' + d + '.' + uiSchema[b].display)) {
                if (d > 0) {
                  obj['value'] += '<br/>'
                }
                obj['value'] += objectPath.get(fhir, uiSchema[b].modelRoot + '.' + d + '.' + uiSchema[b].display)
                state.data[category].push(obj)
              }
            }
          }
        } else {
          obj['key'] = uiSchema[b].label
          obj['value'] = objectPath.get(fhir, model)
          if (typeof uiSchema[b].modelOne !== 'undefined') {
            if (objectPath.has(fhir, model + '.' + uiSchema[b].modelOne + '.' + uiSchema[b].modelEnd)) {
              obj['value'] = objectPath.get(fhir, model + '.' + uiSchema[b].modelOne + '.' + uiSchema[b].modelEnd)
            }
            if (objectPath.has(fhir, model + '.' + uiSchema[b].modelRange[0] + '.' + uiSchema[b].modelEnd)) {
              obj['value'] = objectPath.get(fhir, model + '.' + uiSchema[b].modelRange[0] + '.' + uiSchema[b].modelEnd)
              obj['value'] += ' to '
              obj['value'] += objectPath.get(fhir, model + '.' + uiSchema[b].modelRange[1] + '.' + uiSchema[b].modelEnd)
            }
          }
          if (typeof uiSchema[b].modelChoice !== 'undefined') {
            for (const f in uiSchema[b].modelChoice) {
              if (objectPath.has(fhir, model + '.' + uiSchema[b].modelChoice[f] + '.' + uiSchema[b].modelEnd)) {
                obj['value'] = objectPath.get(fhir, model + '.' + uiSchema[b].modelChoice[f] + '.' + uiSchema[b].modelEnd)
              }
            }
          }
          if (typeof uiSchema[b].text !== 'undefined') {
            if (objectPath.has(fhir, model + '.' + uiSchema[b].text)) {
              obj['value'] = objectPath.get(fhir, model + '.' + uiSchema[b].text)
            }
          }
          if (obj['value'] !== undefined) {
            if (typeof uiSchema[b].options !== 'undefined') {
              if (uiSchema[b].multiple === true) {
                let value = ''
                for (const g in obj['value']) {
                  const h = uiSchema[b].options.find(({ value }) => value === obj['value'][c][uiSchema[b].model])
                  if (g !== '0') {
                    value += '; '
                  }
                  value += h.label
                }
                obj['value'] = value
              } else {
                const i = uiSchema[b].options.find(({ value }) => value === obj['value'])
                obj['value'] = i.label
              }
            }
            state.data[category].push(obj)
          }
        }
      }
    }
    const loadResource = async(index, resource, category) => {
      const a = await fetchJSON('fhir/' + resource, props.online)
      objectPath.set(state, 'base.tabs.' + index + '.base', a)
      if (category === 'all') {
        objectPath.set(state, 'base.tabs.' + index + '.schema', a.uiSchema)
      } else {
        if (resource !== 'observations') {
          objectPath.set(state, 'base.tabs.' + index + '.schema', objectPath.get(a, category + '.uiSchema'))
        } else {
          const sub = a.categories.find(o => o.value === category)
          objectPath.set(state, 'base.tabs.' + index + '.schema', sub.uiSchema)
        }
      }
      const resource_obj = await loadSchema(resource, category, objectPath.get(state, 'base.tabs.' + index + '.schema'), props.online, [])
      objectPath.set(state, 'base.tabs.' + index + '.schema', resource_obj.schema)
    }
    const qOptions = ref(props.options)
    const reloadComplete = () => {
      state.tabReload = false
      state.showList = true
    }
    return {
      fhirMap,
      loadResource,
      loadSchema,
      qOptions,
      reloadComplete,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
