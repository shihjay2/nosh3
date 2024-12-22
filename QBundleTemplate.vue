<template>
  <div class="q-pa-md">
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
import { defineComponent, reactive, onMounted } from 'vue'
import Case from 'case'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import QBundleListTemplate from './QBundleListTemplate.vue'
import QBundleMixedTemplate from './QBundleMixedTemplate.vue'
import QInfoTemplate from './QInfoTemplate.vue'
import settings from './settings.mjs'
import { urlFix } from './core.mjs'

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
    prefix: String
  },
  setup (props) {
    const state = reactive({
      base: {},
      doc: {},
      data: [],
      online: true
    })
    onMounted(async() => {
      state.doc = props.doc
      state.base = await fetchJSON('fhir/bundles')
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
    const addSchemaOptions = (id, arr, val, label, schema, system='') => {
      const options = []
      for (const a of arr) {
        const b = {}
        if (a[val] !== undefined && a[val] !== 'notSelectable' ) {
          b.value = a[val]
          b.label = a[label]
          if (system !== '') {
            b.system = system
          }
          options.push(b)
        }
      }
      for (const c in schema) {
        if (Array.isArray(schema[c])) {
          for (const d in schema[c]) {
            if (id == schema[c][d].id) {
              if (objectPath.has(schema, c + '.' + d + '.options')) {
                objectPath.set(schema, c + '.' + d + '.options', objectPath.get(schema, c + '.' + d + '.options').concat(options))
              } else {
                objectPath.set(schema, c + '.' + d + '.options', options)
              }
            }
          }
        } else {
          if (id == schema[c].id) {
            if (objectPath.has(schema, c + '.options')) {
              objectPath.set(schema, c + '.options', objectPath.get(schema, c + '.options').concat(options))
            } else {
              objectPath.set(schema, c + '.options', options)
            }
          }
        }
      }
      return schema
    }
    const fetchJSON = async(file) => {
      raw = fs.readFileSync('./assets/' + file + '.json')
      return JSON.parse(raw)
    }
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
    const getPrefix = () => {
      return props.prefix
    }
    const getResource = async(resource, arr) => {
      const prefix = getPrefix()
      const resourceDB = new PouchDB(urlFix(settings.couchdb_uri) + prefix + resource, settings.couchdb_auth)
      const result = await resourceDB.allDocs({
        include_docs: true,
        attachments: true,
        startkey: 'nosh_',
      })
      if (result.rows.length > 0) {
        for (const a of result.rows) {
          let label = 'No Name'
          if (objectPath.has(a, 'doc.text.div')) {
            label = removeTags(a.doc.text.div)
          }
          arr.push({
            val: Case.pascal(pluralize.singular(resource)) + '/' + a.doc.id,
            label: label
          })
        }
      }
      return arr
    }
    const loadResource = async(index, resource, category) => {
      const a = await fetchJSON('fhir/' + resource)
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
      const resource_obj = await loadSchema(resource, category, objectPath.get(state, 'base.tabs.' + index + '.schema'), [])
      objectPath.set(state, 'base.tabs.' + index + '.schema', resource_obj.schema)
    }
    const loadSchema = async(resource, category, schema, options) => {
      const prefix = getPrefix()
      let countries = []
      const select = {}
      let states = []
      if (resource === 'immunizations') {
        const actSites = await fetchJSON('actSites')
        schema = addSchemaOptions('site', actSites.concept[0].concept[0].concept, 'code', 'display', schema)
      }
      if (resource === 'medication_statements') {
        const doseform = await fetchJSON('doseform')
        const routes = await fetchJSON('routes')
        schema = addSchemaOptions('doseUnit', doseform.concept, 'code', 'display', schema)
        schema = addSchemaOptions('route', routes, 'code', 'desc', schema)
      }
      if (resource === 'conditions' ||
          resource === 'allergy_intolerances' ||
          resource === 'medication_statements' ||
          resource === 'tasks') {
        options = setOptions()
      }
      if (resource === 'patients' ||
          resource === 'practitioners' ||
          resource === 'related_persons' ||
          resource === 'organizations' ||
          resource === 'insurance_plans') {
        countries = await fetchJSON('countries')
        states = await fetchJSON('states')
        schema = addSchemaOptions('country', countries, 'iso2', 'name', schema)
      }
      if (resource === 'patients' ||
          resource === 'related_persons' ||
          resource === 'practitioners') {
        const language = await fetchJSON('language')
        schema = addSchemaOptions('language', language, 'alpha2', 'English', schema)
      }
      if (resource === 'patients') {
        const ethnicity = await fetchJSON('ethnicity')
        schema = addSchemaOptions('ethnicity', ethnicity, 'Code', 'Display', schema)
        const race = await fetchJSON('race')
        schema = addSchemaOptions('race', race, 'Code', 'Display', schema)
      }
      if (resource === 'related_persons') {
        const relationship = await fetchJSON('relationship')
        schema = addSchemaOptions('relationship', relationship, 'Code', 'Display', schema)
      }
      if (resource === 'encounters' || resource === 'appointments') {
        const serviceTypes = await fetchJSON('serviceTypes')
        schema = addSchemaOptions('serviceType', serviceTypes, 'Code', 'Display', schema)
      }
      if (resource === 'appointments') {
        const serviceCategories = await fetchJSON('serviceCategories')
        schema = addSchemaOptions('serviceCategory', serviceCategories, 'Code', 'Display', schema)
        schema = await loadSelect('patients', 'patient', schema)
        schema = await loadSelect('practitioners', 'practitioner', schema)
      }
      if (resource === 'encounters') {
        const encounterTypes = await fetchJSON('encounterTypes')
        schema = addSchemaOptions('type', encounterTypes, 'Code', 'Display', schema)
        schema = await loadSelect('practitioners', 'participant', schema)
      }
      if (resource === 'practitioners') {
        const degrees = await fetchJSON('degrees')
        schema = addSchemaOptions('degree', degrees.concept, 'code', 'display', schema)
      }
      if (resource === 'document_references') {
        const docTypeCodes = await fetchJSON('docTypeCodes')
        const docClassCodes = await fetchJSON('docClassCodes')
        schema = addSchemaOptions('type', docTypeCodes, 'Code', 'Display', schema, 'http://loinc.org')
        schema = addSchemaOptions('category', docClassCodes, 'Code', 'Display', schema, 'http://loinc.org')
        schema = addSchemaOptions('category', [{'Code': 'clinical-note', 'Display': 'Clinical Note'}], 'Code', 'Display', schema, 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category')
      }
      if (resource === 'users') {
        const encounterTypes = await fetchJSON('encounterTypes')
        schema = addSchemaOptions('type', encounterTypes, 'Code', 'Display', schema)
        const serviceTypes = await fetchJSON('serviceTypes')
        schema = addSchemaOptions('serviceType', serviceTypes, 'Code', 'Display', schema)
        const serviceCategories = await fetchJSON('serviceCategories')
        schema = addSchemaOptions('serviceCategory', serviceCategories, 'Code', 'Display', schema)
        const compType = await fetchJSON('compType')
        schema = addSchemaOptions('code', compType, 'Code', 'Display', schema)
        const docClassCodes = await fetchJSON('docClassCodes')
        schema = addSchemaOptions('category', docClassCodes, 'Code', 'Display', schema)
      }
      if (resource === 'observations') {
        schema = await loadSelect('practitioners', 'performer', schema)
        if (category !== 'exam' && category !== 'vital-signs' && category !== 'social-history' && category !== 'all') {
          const category1 = Case.camel(category)
          const category2 = await fetchJSON(category1)
          if (category === 'activity') {
            const a = []
            for (const b of category2) {
              a.push(b)
            }
            objectPath.set(select, category, a)
          }
          const observationsCodes = []
          let c = 0
          let d = ''
          const f = []
          for (const e of category2) {
            if (category === 'activity') {
              if (!f.includes(objectPath.get(e, 'CF_CODE10'))) {
                objectPath.set(observationsCodes, c + '.code', objectPath.get(e, 'CF_CODE10'))
                f.push(objectPath.get(e, 'CF_CODE10'))
                if (objectPath.get(e, 'Description') !== '') {
                  d = objectPath.get(e, 'Description') + ' | '
                } else {
                  d = objectPath.get(e, 'Common Term') + ' | '
                }
                d = d + objectPath.get(e, 'REFID')
                objectPath.set(observationsCodes, c + '.display', d)
                c = c + 1
              }
            } else {
              if (!objectPath.has(e, 'span')) {
                if (objectPath.has(e, 'a.small')) {
                  objectPath.set(observationsCodes, c + '.code', objectPath.get(e, 'a.small'))
                  objectPath.set(observationsCodes, c + '.display', objectPath.get(e, '#text'))
                  c = c + 1
                }
              }
            }
          }
          schema = addSchemaOptions('code', observationsCodes, 'code', 'display', schema)
        }
      }
      if (resource === 'compositions') {
        const compSection = await fetchJSON('compSection')
        const compType = await fetchJSON('compType')
        const docClassCodes = await fetchJSON('docClassCodes')
        schema = addSchemaOptions('code', compType, 'Code', 'Display', schema)
        schema = addSchemaOptions('category', docClassCodes, 'Code', 'Display', schema)
        schema = await loadSelect('practitioners', 'author', schema)
        schema = await loadSelect('practitioners', 'section_author', schema)
        for (const g of compSection) {
          if (g.Code !== undefined && g.Code !== 'notSelectable') {
            if (objectPath.has(g, 'Common')) {
              options.push({
                label: g.Display,
                value: g.Code,
                doc: {},
                resource: 'compositions'
              })
            }
          }
        }
        options.push({
          label: 'Other',
          value: 'other',
          doc: {},
          resource: 'compositions'
        })
      }
      if (resource === 'care_plans') {
        const outcomeTypes = await fetchJSON('outcomeTypes')
        schema = addSchemaOptions('outcome', outcomeTypes, 'Code', 'Display', schema)
        options = []
        options.push({
          label: 'New Condition',
          value: 'add',
          doc: {},
          resource: 'conditions'
        })
        const conditionsDB = new PouchDB(urlFix(settings.couchdb_uri) + prefix + 'conditions', settings.couchdb_auth)
        const result = await conditionsDB.allDocs({
          include_docs: true,
          attachments: true,
          startkey: 'nosh_',
        })
        for (const h of result.rows) {
          options.push({
            label: h.doc.code.coding[0].display + ' [' + h.doc.code.coding[0].code + ']',
            value: h.doc.id,
            doc: h.doc,
            resource: 'conditions'
          })
        }
      }
      if (resource === 'service_requests') {
        schema = await loadSelect('practitioners', 'requester', schema)
        options = [
          {"value": "draft", "label": "Draft"},
          {"value": "active", "label": "Active"},
          {"value": "on-hold", "label": "On Hold"},
          {"value": "revoked", "label": "Revoked"},
          {"value": "completed", "label": "Completed"},
          {"value": "entered-in-error", "label": "Entered In Error"},
          {"value": "unknown", "label": "Unknown"}
        ]
      }
      if (resource === 'communications') {
        schema = await loadSelect(['practitioners','patients','related_persons'], 'recipients', schema)
      }
      if (resource === 'tasks') {
        options = [
          {"value": "draft", "label": "Draft"},
          {"value": "requested", "label": "Requested"},
          {"value": "received", "label": "Received"},
          {"value": "accepted", "label": "Accpted"},
          {"value": "rejected", "label": "Rejected"},
          {"value": "ready", "label": "Ready"},
          {"value": "cancelled", "label": "Cancelled"},
          {"value": "in-progress", "label": "In Progress"},
          {"value": "on-hold", "label": "On Hold"},
          {"value": "failed", "label": "Failed"},
          {"value": "completed", "label": "Completed"},
          {"value": "entered-in-error", "label": "Entered in Error"}
        ]
        schema = await loadSelect('practitioners', 'owner', schema)
      }
      return {schema: schema, options: options, select: select, states: states, countries: countries}
    }
    const loadSelect = async(resource, id, schema) => {
      let arr = []
      if (Array.isArray(resource)) {
        for (const resource0 of resource) {
          arr = await getResource(resource0, arr)
        }
      } else {
        arr = await getResource(resource, arr)
      }
      if (arr.length > 0) {
        schema = addSchemaOptions(id, arr, 'val', 'label', schema)
      }
      return schema
    }
    const reloadComplete = () => {
      state.tabReload = false
      state.showList = true
    }
    return {
      addSchemaOptions,
      fetchJSON,
      fhirMap,
      getPrefix,
      getResource,
      loadResource,
      loadSchema,
      loadSelect,
      reloadComplete,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
