<template>
  <q-card>
    <div class="q-pa-md q-gutter-md">
      <q-card v-if="state.uspstf">
        <q-expansion-item expand-separator icon="recommend" label="USPSTF Recommendations">
          <q-scroll-area style="height: 150px">
            <q-card-section>
              <div v-for="row in state.uspstf_specific_recommendations" :key="row.id" class="q-pa-sm q-gutter-sm">
                <q-banner :class="row.class">{{ row.title }}: {{ row.text }}, Grade {{ row.grade }}</q-banner>
              </div>
            </q-card-section>
          </q-scroll-area>
        </q-expansion-item>
      </q-card>
      <q-card v-if="state.ascvd !== null">
        <q-expansion-item expand-separator icon="recommend" label="10-year ASCVD Risk">
          <q-card-section>
            <q-banner :class="state.ascvd.class">Score: {{ state.ascvd.score }}</q-banner>
          </q-card-section>
        </q-expansion-item>
      </q-card>
      <q-card v-if="state.hedis.length > 0">
        <q-expansion-item expand-separator icon="recommend" label="HEDIS">
          <q-scroll-area style="height: 150px">
            <q-card-section>
              <div v-for="row in state.hedis" :key="row.id">
                <q-banner>{{ row.title }}:
                  <div v-for="(row1, index1) in row.text" :key="index1" class="q-pa-sm q-gutter-sm">
                    <q-badge outline :color="row.class[index1]" :label="row1" />
                  </div>
                </q-banner>
              </div>
            </q-card-section>
          </q-scroll-area>
        </q-expansion-item>
      </q-card>
      <q-separator />
      <q-card-actions align="right">
        <div class="q-pa-sm q-gutter-sm">
          <q-btn push icon="cancel" color="red" @click="close" label="Close" />
        </div>
      </q-card-actions>
    </div>
  </q-card>
</template>

<script>
import { reactive, onMounted } from 'vue'
import axios from 'axios'
import { calculateASCVDEstimate } from 'ascvdcalc'
import Case from 'case'
import { common } from '@/logic/common'
import moment from 'moment-timezone'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import objectPath from 'object-path'
import print from 'vue3-print-nb'
PouchDB.plugin(PouchDBFind)
import { useAuthStore } from '@/stores'
import { query } from 'jsqry'

export default {
  name: 'CareOpportunities',
  props: {
    patient: String,
    patientDOB: String,
    patientAge: String,
    patientGender: String,
    online: Boolean
  },
  directives: {
    print
  },
  emits: ['close-care-opportunties'],
  setup(props, { emit }) {
    const { fetchJSON, getSignedEncounters, historyDXMatch, observationResult, observationStatus, patientStatus } = common()
    const state = reactive({
      ascvd: null,
      hedis: [],
      patientAgeMonths: 0,
      uspstf: false,
      uspstf_specific_recommendations: []
    })
    const auth = useAuthStore()
    onMounted(async() => {
      state.patientAgeMonths = moment().diff(props.patientDOB, 'months')
      await ascvd()
      await uspstf()
      await hedisAudit()
    })
    const ascvd = async() => {
      if (props.patientAge >= 40 && props.patientAge <= 79) {
        const patientParams = {}
        patientParams.sex = props.patientGender.toLowerCase()
        patientParams.race = await patientStatus('race', props.patient)
        patientParams.age = props.patientAge
        patientParams.totalChol = await observationResult('2093-3', props.patient)
        patientParams.hdl = await observationResult('2085-9', props.patient)
        patientParams.systolicBp = await observationResult('8480-6', props.patient)
        patientParams.isDiabetic = false
        patientParams.isSmoker = await observationStatus('tobacco', props.patient, true)
        patientParams.treatedHTN = false
        if (patientParams.totalChol !== '' && patientParams.hdl !== '' && patientParams.systolicBp !== '' && patientParams.isSmoker !== '') {
          state.ascvd = {}
          objectPath.set(state, 'ascvd.score', calculateASCVDEstimate(patientParams)) // output 5.4%
          if (state.ascvd.score < '7.5%') {
            objectPath.set(state, 'ascvd.class', 'bg-positive text-white')
          } else {
            objectPath.set(state, 'ascvd.class', 'bg-negative text-white')
          }
        }
      }
    }
    const close = () => {
      emit('close-care-opportunties')
    }
    const hedisAudit = async() => {
      let dxBundles = []
      const hedis = await fetchJSON('hedis', props.online)
      for (const a of hedis.rows) {
        // build includes
        const includes_arr = []
        if (objectPath.has(a, 'includes.min_age')) {
          if (props.patientAge >= objectPath.get(a, 'includes.min_age')) {
            includes_arr.push(true)
          } else {
            includes_arr.push(false)
          }
        }
        if (objectPath.has(a, 'includes.min_age_months')) {
          if (state.patientAgeMonths >= objectPath.get(a, 'includes.min_age_months')) {
            includes_arr.push(true)
          } else {
            includes_arr.push(false)
          }
        }
        if (objectPath.has(a, 'includes.max_age')) {
          if (props.patientAge <= objectPath.get(a, 'includes.max_age')) {
            includes_arr.push(true)
          } else {
            includes_arr.push(false)
          }
        }
        if (objectPath.has(a, 'includes.max_age_months')) {
          if (state.patientAgeMonths <= objectPath.get(a, 'includes.max_age_months')) {
            includes_arr.push(true)
          } else {
            includes_arr.push(false)
          }
        }
        if (objectPath.has(a, 'includes.gender')) {
          if (props.patientGender === objectPath.get(a, 'includes.gender')) {
            includes_arr.push(true)
          } else {
            includes_arr.push(false)
          }
        }
        if (objectPath.has(a, 'includes.dx')) {
          dxBundles = await historyDXMatch(objectPath.get(a, 'includes.dx'))
          if (dxBundles.length > 0) {
            includes_arr.push(true)
          } else {
            includes_arr.push(false)
          }
        }
        const not_goal = 'Goal not met'
        const goal = 'Goal met'
        if (eval(includes_arr.join('&&'))) {
          // proceed with audit
          const hedis_obj = {}
          objectPath.set(hedis_obj, 'id', objectPath.get(a, 'type'))
          objectPath.set(hedis_obj, 'title', objectPath.get(a, 'title'))
          let bundles = []
          if (dxBundles.length > 0) {
            bundles = dxBundles
          } else {
            bundles = await getSignedEncounters(a.years)
          }
          for (const bundle of bundles) {
            if (objectPath.has(a, 'query')) {
              let query_count = 0
              for (const b of objectPath.get(a, 'query')) {
                const c = bundle.entry.filter(bundle1 => bundle1.resource.resourceType === b.resource)
                if (c.length > 0) {
                  let needle_arr = []
                  if (objectPath.has(b, 'needle_fetch')) {
                    needle_arr = await fetchJSON(objectPath.get(b, 'needle_fetch'), props.online)
                  } else {
                    needle_arr = objectPath.get(b, 'needle_arr')
                  }
                  for (const d of needle_arr) {
                    const f = c.find(e => objectPath.get(e, 'resource.' + objectPath.get(b, 'model')).toLowerCase().includes(d.toLowerCase()))
                    if (f !== undefined) {
                      if (objectPath.get(b, 'outcome') == 'percent' || objectPath.get(b, 'outcome') == 'score' || objectPath.get(b, 'outcome') == 'count') {
                        objectPath.set(b, 'result', objectPath.get(b, 'result') + 1)
                      }
                    }
                  }
                }
                if (objectPath.get(b, 'outcome') == 'percent') {
                  if (bundle.length > 0) {
                    objectPath.set(b, 'result_percent', Math.round((objectPath.get(b, 'result')/bundle.length) * 100))
                  }
                  objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(b, 'text') + objectPath.get(b, 'result_percent'))
                  if (objectPath.has(b, 'min_percent_goal')) {
                    if (objectPath.get(b, 'result_percent') >= objectPath.get(b, 'min_percent_goal')) {
                      objectPath.set(hedis_obj, 'class.' + query_count, 'positive')
                    } else {
                      objectPath.set(hedis_obj, 'class.' + query_count, 'negative')
                    }
                  } else {
                    if (objectPath.get(b, 'result_percent') <= objectPath.get(b, 'max_percent_goal')) {
                      objectPath.set(hedis_obj, 'class.' + query_count, 'positive')
                    } else {
                      objectPath.set(hedis_obj, 'class.' + query_count, 'negative')
                    }
                  }
                }
                if (objectPath.get(b, 'outcome') == 'score') {
                  if (objectPath.get(b, 'result') >= objectPath.get(b, 'score_goal')) {
                    objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(b, 'text') + goal)
                    objectPath.set(hedis_obj, 'class.' + query_count, 'positive')
                  } else {
                    objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(b, 'text') + not_goal)
                    objectPath.set(hedis_obj, 'class.' + query_count, 'negative')
                  }
                }
                query_count++
              }
            }
            if (objectPath.has(a, 'post_query')) {
              for (const g of objectPath.get(a, 'post_query')) {
                const arr = []
                for (const h of objectPath.get(g, 'items')) {
                  const j = a.query.find(i => i.name == h)
                  if (j !== undefined) {
                    arr.push(j.result)
                  }
                  const j1 = a.post_query.find(i1 => i1.name == h)
                  if (j1 !== undefined) {
                    arr.push(j1.result)
                  }
                }
                if (g.process == 'subtract' || g.process == 'sum') {
                  let process = (accumulator, number) => accumulator + number
                  if (g.process == 'subtract') {
                    process = (accumulator, number) => accumulator - number
                  }
                  objectPath.set(g, 'result', arr.reduce(process))
                }
                if (g.process == 'ratio') {
                  objectPath.set(g, 'result', arr[0]/arr[1])
                  if (objectPath.has(g, 'min_goal')) {
                    if (objectPath.get(g, 'result') > objectPath.get(g, 'min_goal')) {
                      objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(g, 'text') + goal)
                      objectPath.set(hedis_obj, 'class.' + query_count, 'positive')
                    } else {
                      objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(g, 'text') + not_goal)
                      objectPath.set(hedis_obj, 'class.' + query_count, 'negative')
                    }
                  }
                }
                if (objectPath.get(g, 'outcome') == 'percent') {
                  if (bundle.length > 0) {
                    objectPath.set(g, 'result_percent', Math.round((objectPath.get(g, 'result')/bundle.length) * 100))
                  }
                  objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(g, 'text') + objectPath.get(g, 'result_percent'))
                  if (objectPath.has(g, 'min_percent_goal')) {
                    if (objectPath.get(g, 'result_percent') >= objectPath.get(g, 'min_percent_goal')) {
                      objectPath.set(hedis_obj, 'class.' + query_count, 'positive')
                    } else {
                      objectPath.set(hedis_obj, 'class.' + query_count, 'negative')
                    }
                  } else {
                    if (objectPath.get(g, 'result_percent') <= objectPath.get(g, 'max_percent_goal')) {
                      objectPath.set(hedis_obj, 'class.' + query_count, 'positive')
                    } else {
                      objectPath.set(hedis_obj, 'class.' + query_count, 'negative')
                    }
                  }
                }
                query_count++
              }
            }
            if (objectPath.has(a, 'observationResult')) {
              for (const k of objectPath.get(a, 'observationResult')) {
                for (const l of objectPath.get(a, 'observationResult.type')) {
                  const m = observationResult(l, props.patient)
                  if (m !== '') {
                    if (objectPath.has(k, 'max_goal')) {
                      if (m <= objectPath.get(k, 'max_goal')) {
                        objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(k, 'text') + goal)
                        objectPath.set(hedis_obj, 'class.' + query_count, 'positive')
                      } else {
                        objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(k, 'text') + not_goal)
                        objectPath.set(hedis_obj, 'class.' + query_count, 'negative')
                      }
                    }
                    if (objectPath.has(k, 'min_goal')) {
                      if (m >= objectPath.get(k, 'min_goal')) {
                        objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(k, 'text') + goal)
                        objectPath.set(hedis_obj, 'class.' + query_count, 'positive')
                      } else {
                        objectPath.set(hedis_obj, 'text.' + query_count, objectPath.get(k, 'text') + not_goal)
                        objectPath.set(hedis_obj, 'class.' + query_count, 'negative')
                      }
                    }
                  }
                  query_count++
                }
              }
            }
          }
          state.hedis.push(hedis_obj)
        }
      }
      console.log(state.hedis)
    }
    const uspstf = async() => {
      const opts = {
        params: {
          key: auth.api.uspstf_key,
          age: props.patientAge,
          sex: Case.capital(props.patientGender),
          pregnant: await observationStatus('pregnancy', props.patient),
          sexuallyActive: await observationStatus('sexually_active', props.patient),
          tobacco: await observationStatus('tobacco', props.patient)
        }
      }
      const result = await axios.get('https://data.uspreventiveservicestaskforce.org/api/json', opts)
      if (objectPath.has(result, 'data.specificRecommendations')) {
        state.uspstf_specific_recommendations = objectPath.get(result,'data.specificRecommendations')
        for (const a in state.uspstf_specific_recommendations) {
          if (state.uspstf_specific_recommendations[a].grade == 'A' || state.uspstf_specific_recommendations[a].grade == 'B') {
            objectPath.set(state, 'uspstf_specific_recommendations.' + a + '.class', 'bg-positive text-white')
          }
          if (state.uspstf_specific_recommendations[a].grade == 'C') {
            objectPath.set(state, 'uspstf_specific_recommendations.' + a + '.class', 'bg-warning text-white')
          }
          if (state.uspstf_specific_recommendations[a].grade == 'D') {
            objectPath.set(state, 'uspstf_specific_recommendations.' + a + '.class', 'bg-negative text-white')
          }
          if (state.uspstf_specific_recommendations[a].grade == 'I') {
            objectPath.set(state, 'uspstf_specific_recommendations.' + a + '.class', 'bg-info text-white')
          }
        }
        state.uspstf = true
      }
    }
    return {
      ascvd,
      close,
      fetchJSON,
      getSignedEncounters,
      hedisAudit,
      historyDXMatch,
      observationResult,
      observationStatus,
      patientStatus,
      uspstf,
      state
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
