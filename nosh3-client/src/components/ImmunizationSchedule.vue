<template>
  <q-card>
    <q-card-section>
      <div id="print_schedule">
        <q-table
          v-if='"rows" in state.table'
          :rows="state.table.rows"
          :columns="state.table.columns"
          :filter="state.table.filter"
          row-key="vaccine"
          :visible-columns="state.table.visibleColumns"
          @row-click="onClick"
          :wrap-cells="state.wrap"
        >
          <template v-slot:header="props">
            <q-tr :props="props">
              <q-th 
                v-for="col in props.cols"
                :key="col.name"
                :props="props"
                class="main-cell">
                {{ col.label }}
              </q-th>
            </q-tr>
          </template>
          <template v-slot:body-cell-vaccine="props">
            <q-td :props="props" class="main-cell">
              {{ props.value }}
            </q-td>
          </template>
          <template v-slot:body-cell="props">
            <q-td
              :props="props"
              :class="state.table.css[props.rowIndex][props.col.name]"
            >
              {{ props.value }}
            </q-td>
          </template>
        </q-table>
      </div>
    </q-card-section>
    <q-separator />
    <q-card-actions align="right">
      <div class="q-pa-sm q-gutter-sm">
        <q-btn push icon="cancel" color="red" @click="close" label="Close" />
        <q-btn push icon="print" color="primary" label="Print" v-print="'print_schedule'"/>
      </div>
    </q-card-actions>
  </q-card>
</template>

<script>
import { reactive, onMounted } from 'vue'
import { common } from '@/logic/common'
import moment from 'moment-timezone'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import objectPath, { get } from 'object-path'
import print from 'vue3-print-nb'
PouchDB.plugin(PouchDBFind)

export default {
  name: 'ImmunizationSchedule',
  props: {
    patient: String,
    patientDOB: String,
    online: Boolean
  },
  directives: {
    print
  },
  emits: ['close-immunizationschedule'],
  setup(props, { emit }) {
    const { fetchJSON, getPrefix } = common()
    const state = reactive({
      patientImmunizationHistory: [],
      patientAgeMonths: null,
      vacSched: {},
      unmatchedPatientImmunizations: [],
      table: {},
      wrap: true
    })
    var prefix = getPrefix()
    onMounted(async() => {
      state.vacSched = await fetchJSON('vacSched', props.online)
      state.patientAgeMonths = '' + moment().diff(props.patientDOB, 'months')
      await query()
      // console.log(state.patientImmunizationHistory)
      mergeImmunizationHistoryWithSchedule()
      // console.log(state.vacSched)
      // console.log(state.unmatchedPatientImmunizations)
      sortPatientImmunizations()
      tableMap()
    })
    const checkForDue = (vac, dose_number) => {
      let ret = ''
      if (typeof vac.dose_age_recommendation !== 'undefined' && typeof vac.dose_age_recommendation[dose_number-1] !== 'undefined') {
        if (state.patientAgeMonths) {
          if (state.patientAgeMonths > vac.dose_age_recommendation[dose_number-1]['month_span'][0]) {
            ret = 'due'
          }
        }
      }
      return ret
    }
    const close = () => {
      emit('close-immunizationschedule')
    }
    const mergeImmunizationHistoryWithSchedule = () => {
      state.patientImmunizationHistory.map((patientImmunization) => {
        let foundMatch = false
        state.vacSched.immunizations.map((vacSchedItem, idx) => {
          if (patientImmunizationMatchesVacSchedItem(patientImmunization, vacSchedItem)) {
            state.vacSched.immunizations[idx].patientImmunizations.push(patientImmunization)
            foundMatch = true;
          }
        })
        if (!foundMatch) {
          state.unmatchedPatientImmunizations.push(patientImmunization)
        }
      })
    }
    const nameMatchTester = (name_match, patientImmunization) => {
      return new RegExp('\\b' + name_match, "i").test(patientImmunization.product.name)
    }
    const patientImmunizationMatchesVacSchedItem = (patientImmunization, vacSchedItem) => {
      if ( vacSchedItem.name_matches.some((name_match) => { return nameMatchTester(name_match, patientImmunization) }) ||
        vacSchedItem.codes.some((code) => { code.system === 'CVX' && code.code === patientImmunization.cvx })
      ) {
        return true
      }
    }
    const populatePatientImmunization = (vac, dose_number) => {
      let ret = null
      const immunization = vac.patientImmunizations[dose_number-1]
      if (vac.patientImmunizations.length > 0) {
        if(typeof immunization !== 'undefined') {
          ret = {}
          objectPath.set(ret, 'class', 'received')
          objectPath.set(ret, 'text', immunization.product.name + ' - ' + immunization.date)
        }
      }
      return ret
    }
    const populateRecommendedAgeText = (vac, dose_number) => {
      let ret = null
      if (typeof vac.dose_age_recommendation !== "undefined") {
        ret = {}
        objectPath.set(ret, 'class', '')
        objectPath.set(ret, 'text', 'Rec: ' + vac.dose_age_recommendation[dose_number-1].name)
      }
      return ret
    }
    const query = async() => {
      const localDB = new PouchDB(prefix + 'immunizations')
      const result = await localDB.find({selector: {'patient.reference': {$eq: 'Patient/' + props.patient }, _id: {"$gte": null}}, limit: 10000})
      if (result.docs.length > 0) {
        for (const a in result.docs) {
          state.patientImmunizationHistory.push({
            date: result.docs[a].occurrenceDateTime,
            product: {
              name: result.docs[a].vaccineCode.coding[0].display
            },
            cvx: result.docs[a].vaccineCode.coding[0].code
          })
        }
      }
    }
    const sortPatientImmunizations = () => {
      state.vacSched.immunizations.forEach(immunization => {
        let sortedPatientImmunizations = immunization.patientImmunizations.sort((immun1, immun2) => {
          let date1 = new Date(immun1.date)
          let date2 = new Date(immun2.date)
          if (date1 > date2) {
            return 1
          }
          else if (date1 < date2) {
            return -1
          }
          else {
            return 0
          }
        })
        immunization.patientImmunizations = sortedPatientImmunizations
      })
    }
    const tableMap = async() => {
      const visible = []
      objectPath.set(state, 'table.columns.0', {name: 'vaccine', label: 'Vaccine', field: 'vaccine', align: 'left'})
      visible.push('vaccine')
      for (let i = 1; i <= state.vacSched.max_dose_count; i++) {
        objectPath.set(state, 'table.columns.' + i, {name: 'dose' + i, label: 'Dose ' + i, field: 'dose' + i, align: 'left'})
        visible.push('dose' + i)
      }
      objectPath.set(state, 'table.visibleColumns', visible)
      state.vacSched.immunizations.map((vac, idx) => {
        const row = {}
        const css = {}
        objectPath.set(row, 'vaccine', vac.name)
        objectPath.set(css, 'vaccine', 'main-cell')
        for (let i = 1; i <= state.vacSched.max_dose_count; i++) {
          if (i > vac.total_doses) {
            objectPath.set(row, 'dose' + i, '')
            objectPath.set(css, 'dose' + i, 'disabledCell')
          } else {
            objectPath.set(css, 'dose' + i , checkForDue(vac, i))
            const req = populateRecommendedAgeText(vac, i)
            if (req !== null) {
              objectPath.set(css, 'dose' + i, req.class)
              objectPath.set(row, 'dose' + i , req.text)
            }
            const req1 = populatePatientImmunization(vac, i)
            if (req1 !== null) {
              objectPath.set(css, 'dose' + i, req1.class)
              objectPath.set(row, 'dose' + i, req1.text)
            }
          }
        }
        objectPath.set(state, 'table.rows.' + idx, row)
        objectPath.set(state, 'table.css.' + idx, css)
      })
    }
    return {
      checkForDue,
      close,
      fetchJSON,
      mergeImmunizationHistoryWithSchedule,
      nameMatchTester,
      patientImmunizationMatchesVacSchedItem,
      populatePatientImmunization,
      populateRecommendedAgeText,
      query,
      sortPatientImmunizations,
      tableMap,
      state
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
  .disabledCell {
    background-color: lightgray;
  }
  .received {
    background-color: lightgreen;
  }
  .due {
    background-color: pink;
  }
  .main-cell {
    font-weight: bold;
  }
</style>
