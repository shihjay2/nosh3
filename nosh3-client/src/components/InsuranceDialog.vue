<template>
  <q-table
    v-if='"rows" in state.table'
    style="height: 300px"
    :rows="state.table.rows"
    :columns="state.table.columns"
    :filter="state.table.filter"
    row-key="id"
    :visible-columns="state.table.visibleColumns"
    :wrap-cells="state.wrap"
    v-model:expanded="state.expanded"
    virtual-scroll
  >
    <template v-slot:header="props">
      <q-tr :props="props">
        <q-th auto-width />
        <q-th v-for="col in props.cols" :key="col.name" :props="props">
          {{ col.label }}
        </q-th>
      </q-tr>
    </template>
    <template v-slot:body="props">
      <q-tr :props="props">
        <q-td v-if="props.row.category === 'ExplanationOfBenefit'" auto-width>
          <q-btn size="sm" color="primary" round dense @click="props.expand = !props.expand" :icon="props.expand ? 'remove' : 'add'" />
        </q-td>
        <q-td v-for="col in props.cols" :key="col.name" :props="props">
          {{ col.value }}
        </q-td>
      </q-tr>
      <q-tr v-show="props.expand" :props="props">
        <q-td colspan="100%">
          <ul>
            <li>Start Date: {{ props.row.billable_start_date }}</li>
            <li>End Date: {{ props.row.billable_end_date }}</li>
            <li>Facility: {{ props.row.facility }}</li>
            <li>Total Cost: {{ props.row.total_cost }}</li>
            <li>Payment: {{ props.row.payment }}</li>
          </ul>
          <b>Diagnoses:</b>
          <ul>
            <li v-for="(dx, index) in props.row.diagnoses" :key="index">
              {{ dx }}
            </li>
          </ul>
          <div v-if="props.row.coverage">
            <a tag="a" :href="props.row.coverage_link.link" target="_blank" v-ripple>
              {{ props.row.coverage_link.display }}
            </a>
          </div>
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script>
import { reactive, onMounted, watch } from 'vue'
import objectPath from 'object-path'

export default {
  name: 'InsuranceDialog',
  props: {
    fhir: Array,
    type: String
  },
  emits: [],
  setup(props, { emit }) {
    const state = reactive({
      fhir: [],
      table: {},
      expanded: [],
      current: [],
      prev: [],
      wrap: true,
      diff: [],
      expanded_text: ''
    })
    onMounted(async() => {
      state.fhir = props.fhir
      sort()
      tableMap()
    })
    watch(() => state.expanded, async(newVal, oldVal) => {
      if (newVal) {
        console.log(newVal)
        if (newVal.length === 2 || oldVal.length === 0) {
          let update = false
          if (newVal.length === 2) {
            newVal.splice(newVal.indexOf(oldVal[0]),1)
            update = true
          }
          if (update) {
            state.expanded = newVal
          }
        }
      }
    })
    const sort = () => {
      const sorted = []
      let i = 0
      for (const row of state.fhir) {
        if (props.type === 'Coverage') {
          const sorted_row = {
            id: i,
            category: props.type,
            type: objectPath.get(row, 'type.coding.0.system') + ' ' + objectPath.get(row, 'type.coding.0.code'),
            status: objectPath.get(row, 'status'),
            start_date: objectPath.get(row, 'period.start'),
          }
          sorted.push(sorted_row)
        }
        if (props.type === 'ExplanationOfBenefit') {
          const eob_type_map = [
            {type: 'CARRIER', link: 'https://www.medicare.gov/what-medicare-covers/part-b/what-medicare-part-b-covers.html', display: 'What Part B Covers'},
            {type: 'DME', link: 'https://www.medicare.gov/coverage/durable-medical-equipment-dme-coverage', display: 'What Part B Covers: Durable Medical Equipment'},
            {type: 'HHA', link: 'https://www.medicare.gov/coverage/home-health-services.html', display: 'What Part A Covers: Home Health Services'},
            {type: 'HOSPICE', link: 'https://www.medicare.gov/what-medicare-covers/part-a/part-a-coverage-hospice.html', display: 'What Part A Covers: Hospice'},
            {type: 'INPATIENT', link: 'https://www.medicare.gov/coverage/hospital-care-inpatient.html', display: 'What Part A Covers: Inpatient Hospital Care'},
            {type: 'OUTPATIENT', link: 'https://www.medicare.gov/what-medicare-covers/part-b/what-medicare-part-b-covers.html', display: 'What Part B Covers'},
            {type: 'PDE', link: 'https://www.medicare.gov/drug-coverage-part-d', display: 'What Drug Plans Cover'},
            {type: 'SNF', link: 'https://www.medicare.gov/what-medicare-covers/part-a/part-a-coverage-skilled-nursing-facilities.html', display: 'What Part A Covers: Skilled Nursing Facility Care'}
          ]
          let coverage_link = null
          let coverage = false
          const coverage_link_index = eob_type_map.findIndex((a) => a.type === objectPath.get(row, 'type.coding.1.code'))
          if (coverage_link_index !== -1) {
            coverage = true
            coverage_link = objectPath.get(eob_type_map, coverage_link_index)
          }
          const dx_arr = []
          if (objectPath.has(row, 'diagnosis')) {
            for (const dx of objectPath.get(row, 'diagnosis')) {
              if (objectPath.has(dx, 'diagnosisCodeableConcept.coding.0.display')) {
                dx_arr.push(objectPath.get(dx, 'diagnosisCodeableConcept.coding.0.display') + ' [' + objectPath.get(dx, 'diagnosisCodeableConcept.coding.0.code') + ']')
              }
            }
          }
          const sorted_row = {
            id: objectPath.get(row, 'id'),
            category: props.type,
            type: objectPath.get(row, 'type.coding.0.display'),
            status: objectPath.get(row, 'status'),
            billable_start_date: objectPath.get(row, 'billablePeriod.start'),
            billable_end_date: objectPath.get(row, 'billablePeriod.end'),
            facility: objectPath.get(row, 'facility.display'),
            total_cost: objectPath.get(row, 'totalCost.value') + ' ' + objectPath.get(row, 'totalCost.code'),
            payment: objectPath.get(row, 'payment.amount.value') + ' ' + objectPath.get(row, 'payment.amount.code'),
            diagnoses: dx_arr,
            coverage: coverage,
            coverage_link: coverage_link
          }
          sorted.push(sorted_row)
        }
        i++
      }
      state.fhir = sorted
      console.log(state.fhir)
    }
    const tableMap = () => {
      if (props.type === 'Coverage') {
        state.table.columns = [
          {name: 'id', label: 'ID', field: 'id', align: 'left'},
          {name: 'type', label: 'Type', field: 'type', align: 'left'},
          {name: 'status', label: 'Status', field: 'status', align: 'left'},
          {name: 'start_date', label: 'Start Date', field: 'start_date', align: 'left'}
        ]
        state.table.visibleColumns = ['type', 'status', 'start_date']
      }
      if (props.type === 'ExplanationOfBenefit') {
        state.table.columns = [
          {name: 'id', label: 'ID', field: 'id', align: 'left'},
          {name: 'type', label: 'Type', field: 'type', align: 'left'},
          {name: 'status', label: 'Status', field: 'status', align: 'left'},
          {name: 'billable_start_date', label: 'Start Date', field: 'billable_start_date', align: 'left'},
          {name: 'facility', label: 'Facility', field: 'facility', align: 'left'}
        ]
        state.table.visibleColumns = ['type', 'status', 'billable_start_date', 'facility']
      }
      state.table.rows = state.fhir
    }
    return {
      sort,
      tableMap,
      state
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
#diffpreview {
  font-family:Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace;
}
</style>
