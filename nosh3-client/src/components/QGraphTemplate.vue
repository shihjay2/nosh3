<template>
  <q-card>
    <q-card-section>
      <div id="print_graph">
        <highcharts :options="state.options"></highcharts>
      </div>
      <div v-if="state.percentile !== ''">
        Percentile: {{ state.percentile }}
      </div>
    </q-card-section>
    <q-separator />
    <q-card-actions align="right">
      <div class="q-pa-sm q-gutter-sm">
        <q-btn push icon="cancel" color="red" @click="close" label="Close" />
        <q-btn push icon="print" color="primary" label="Print" v-print="'print_graph'"/>
      </div>
    </q-card-actions>
  </q-card>
</template>

<script>
import { defineComponent, reactive, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import { Chart } from 'highcharts-vue'
import convert from 'convert'
import moment from 'moment-timezone'
import objectPath from 'object-path'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import print from 'vue3-print-nb'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'QGraphTemplate',
  components: {
    highcharts: Chart
  },
  props: {
    type: String,
    observation: String,
    patientDOB: String,
    patientGender: String,
    patientName: String,
    online: Boolean
  },
  directives: {
    print
  },
  emits: ['close-graph'],
  setup(props, { emit }) {
    const { fetchJSON, getPrefix } = common()
    const state = reactive({
      options: {},
      percentile: '',
      bfa_f: [],
      bfa_m: [],
      hcfa_f: [],
      hcfa_m: [],
      lhfa_f: [],
      lhfa_m: [],
      wfa_f: [],
      wfa_m: [],
      wfh_f: [],
      wfh_m: [],
      wfl_f: [],
      wfl_m: []
    })
    var prefix = getPrefix()
    var db = new PouchDB(prefix + 'observations')
    var gcType = [
      {type: 'wfa', x_title: 'Age (days)', y_title: 'kg', selector: ['29463-7'], title: 'Weight-for-age percentiles'},
      {type: 'lhfa', x_title: 'Age (days)', y_title: 'cm', selector: ['8302-2'], title: 'Height-for-age percentiles'},
      {type: 'hcfa', x_title: 'Age (days)', y_title: 'cm', selector: ['9843-4'], title: 'Head circumference-for-age'},
      {type: 'bfa', x_title: 'Age (days)', y_title: 'kg/m2', selector: ['39156-5'], title: 'BMI-for-age percentiles'},
      {type: 'wfl', x_title: 'cm', y_title: 'kg', selector: ['29463-7', '8302-2'], title: 'Weight-length'},
      {type: 'wfh', x_title: 'cm', y_title: 'kg', selector: ['29463-7', '8302-2'], title: 'Weight-height'}
    ]
    onMounted(async() => {
      const gc_chart = ['wfa', 'lhfa', 'hcfa', 'bfa', 'wfl', 'wfh']
      if (gc_chart.includes(props.type)) {
        await gc(props.type)
      } else {
        const x = gcType.find(y => y.selector.indexOf(props.observation) !== -1)
        if (moment().diff(props.patientDOB, 'days') < 1857 &&
          x !== undefined
        ) {
          console.log('growth chart used instead')
          await gc(x.type)
        } else {
          await dft(props.observation)
        }
      }
    })
    watch(() => props.type, async(newVal) => {
      const gc_chart = ['wfa', 'lhfa', 'hcfa', 'bfa', 'wfl', 'wfh']
      if (newVal !== '') {
        if (gc_chart.includes(props.type)) {
          await gc(props.type)
        } else {
          await dft(props.observation)
        }
      } else {
        objectPath.set(state, props.resource, false)
      }
    })
    const close = () => {
      emit('close-graph')
    }
    const dft = async(observation) => {
      const series = []
      const result = await db.find({selector: {'code.coding.0.code': {$eq: observation}, _id: {"$gte": null}}})
      const data1 = []
      if (objectPath.has(result, 'docs.0.effectivePeriod.start')) {
        result.docs.sort((a1, b1) => moment(a1.effectivePeriod.start) - moment(b1.effectivePeriod.start))
        for (const d in result.docs) {
          data1.push([new Date(result.docs[d].effectivePeriod.start).getTime(), parseFloat(result.docs[d].valueQuantity.value)])
        }
      } else {
        result.docs.sort((a1, b1) => moment(a1.effectiveDateTime) - moment(b1.effectiveDateTime))
        for (const d in result.docs) {
          data1.push([new Date(result.docs[d].effectiveDateTime).getTime(), parseFloat(result.docs[d].valueQuantity.value)])
        }
      }
      series.push({name: result.docs[0].code.coding[0].display, type: 'line', data: data1})
      state.options = {
        chart: {
          renderTo: 'graph',
          type: 'line',
          marginRight: 130,
          marginBottom: 50
        },
        title: {
          text: result.docs[0].code.coding[0].display + ' over time as of ' + moment().format('YYYY-MM-DD HH:mm'),
          x: -20
        },
        xAxis: {
          title: {
            text: 'Date'
          },
          type: 'datetime',
          labels: {
            format: '{value:%Y-%m-%d}'
          }
        },
        yAxis: {
          title: {
            text: result.docs[0].valueQuantity.unit
          },
          plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
          }]
        },
        legend: {
          layout: 'vertical',
          align: 'right',
          verticalAlign: 'top',
          x: -10,
          y: 100,
          borderWidth: 0
        },
        series: series,
        credits: {
          href: 'http://noshemr.wordpress.com',
          text: 'NOSH ChartingSystem'
        }
      }
    }
    const gc = async(type) => {
      const typeSub = gcType.find(a => a.type === type)
      const gender = props.patientGender.charAt(0).toLowerCase()
      state[type + '_' + gender] = await fetchJSON(type + '_' + gender, props.online)
      const splines = ['P95', 'P90', 'P75', 'P50', 'P25', 'P10', 'P5']
      const series = []
      const categories = []
      for (const b in splines) {
        const data = []
        for (const b1 in state[type + '_' + gender]) {
          if (type !== 'wfh' && type !== 'wfl') {
            data.push(objectPath.get(state[type + '_' + gender][b1], splines[b]))
            categories.push(objectPath.get(state[type + '_' + gender][b1], 'Age'))
          } else {
            if (type === 'wfh') {
              data.push([objectPath.get(state[type + '_' + gender][b1], 'Height') ,objectPath.get(state[type + '_' + gender][b1], splines[b])])
            } else {
              data.push([objectPath.get(state[type + '_' + gender][b1], 'Length') ,objectPath.get(state[type + '_' + gender][b1], splines[b])])
            }
          }
        }
        series.push({name: splines[b].substring(1) + '%', type: 'spline', data: data})
      }
      const selector = []
      for (const c in typeSub.selector) {
        selector.push({'code.coding.0.code': {$eq: typeSub.selector[c]}, _id: {"$gte": null}})
      }
      const result = await db.find({selector: {$or: selector}})
      const data1 = []
      const data2 = []
      result.docs.sort((a1, b1) => moment(a1.effectivePeriod.start) - moment(b1.effectivePeriod.start))
      for (const d in result.docs) {
        let compare = typeSub.y_title
        let d_unit = ''
        let d_val = ''
        if (type === 'wfh' || type === 'wfl') {
          if (result.docs[d].code.coding.code !== '29463-7') {
            compare = typeSub.x_title
          }
        }
        if (result.docs[d].valueQuantity.unit !== compare) {
          if (result.docs[d].valueQuantity.unit == 'lbs') {
            d_unit = 'lb'
          } else {
            d_unit = result.docs[d].valueQuantity.unit
          }
          d_val = convert(parseFloat(result.docs[d].valueQuantity.value), d_unit).to(compare)
        } else {
          d_val = parseFloat(result.docs[d].valueQuantity.value)
        }
        if (type !== 'wfh' && type !== 'wfl') {
          data1.push([moment(result.docs[d].effectivePeriod.start).diff(props.patientDOB, 'days'), d_val])
        } else {
          data2.push({age: moment(result.docs[d].effectivePeriod.start).diff(props.patientDOB, 'days'), val: d_val, code: result.docs[d].code.coding.code})
        }
      }
      if (type === 'wfh' || type === 'wfl') {
        const d3 = data2.reduce((r, arr) => {
          r[arr.age] = [...r[arr.age] || [], arr]
          return r
        }, {})
        const d4 = Object.values(d3)
        for (const d5 in d4) {
          let w = ''
          let l = ''
          if (d4[d5].length > 1) {
            for (const d6 in d4[d5]) {
              if (d4[d5][d6].code !== '29463-7') {
                l = d4[d5][d6].val
              } else {
                w = d4[d5][d6].val
              }
            }
          }
          if (w !== '' && l !== '') {
            data1.push([l,w])
          }
        }
      }
      console.log(data1)
      series.push({name: props.patientName, type: 'line', data: data1})
      // get percentiles
      if (data1.length > 0) {
        let lms = null
        const e = data1.slice(-1).pop()
        if (type !== 'wfh' && type !== 'wfl') {
          lms = state[type + '_' + gender].find(g => g.Age == e[0])
        } else {
          if (type === 'wfh') {
            lms = state[type + '_' + gender].find(g => g.Height == Math.round(e[0]))
          } else {
            lms = state[type + '_' + gender].find(g => g.Length == Math.round(e[0]))
          }
        }
        if (lms !== undefined) {
          const val1 = e[1] / lms.M
          let zscore = null
          if (lms.L !== '0') {
            const val2 = Math.pow(val1, lms.L) - 1
            const val3 = lms.L * lms.S
            zscore = val2 / val3
          } else {
            const val4 = Math.log($val1)
            zscore = val4 / lms.S
          }
          state.percentile = Math.round(gc_cdf(zscore) * 100)
        }
      }
      // set chart
      state.options = {
        chart: {
          renderTo: 'graph',
          defaultSeriesType: 'line',
          marginRight: 130,
          marginBottom: 50,
        },
        title: {
          text: typeSub.title,
          x: -20
        },
        xAxis: {
          title: {
            text: typeSub.x_title
          },
          labels: {
            step: 180
          },
          categories: categories
        },
        yAxis: {
          title: {
            text: typeSub.y_title
          },
          plotLines: [{
            value: 0,
            width: 1,
            color: '#808080'
          }]
        },
        tooltip: {
          enabled: true
        },
        legend: {
          layout: 'vertical',
          align: 'right',
          verticalAlign: 'top',
          x: -10,
          y: 100,
          borderWidth: 0
        },
        series: series,
        credits: {
          href: 'http://noshemr.wordpress.com',
          text: 'NOSH ChartingSystem'
        },
        plotOptions: {
          spline: {
            marker: {
              enabled: false
            }
          },
          line: {
            marker: {
              enabled: true
            }
          }
        }
      }
    }
    const gc_cdf = (zscore) => {
      if(zscore < 0) {
        return (1 - gc_erf(zscore / Math.sqrt(2)))/2
      } else {
        return (1 + gc_erf(zscore / Math.sqrt(2)))/2
      }
    }
    const gc_erf = (x) => {
      const pi = 3.1415927
      const a = (8 * (pi - 3))/(3 * pi * (4 - pi))
      const x2 = x * x
      const ax2 = a * x2
      const num = (4/pi) + ax2
      const denom = 1 + ax2
      const inner = (-x2) * num / denom
      const erf2 = 1 - Math.exp(inner)
      return Math.sqrt(erf2)
    }
    return {
      close,
      dft,
      fetchJSON,
      gc,
      gc_cdf,
      gc_erf,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">

</style>
