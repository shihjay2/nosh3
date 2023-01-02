<template>
  <q-card>
    <q-card-section>
      <q-table
        v-if='"rows" in state.table'
        :rows="state.table.rows"
        :columns="state.table.columns"
        :filter="state.table.filter"
        row-key="_id"
        :visible-columns="state.table.visibleColumns"
        :wrap-cells="state.wrap"
        v-model:expanded="state.expanded"
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
          <q-tr :props="props" @click="props.expand = !props.expand">
            <q-td auto-width>
              <q-btn size="sm" color="primary" round dense :icon="props.expand ? 'remove' : 'add'" />
            </q-td>
            <q-td v-for="col in props.cols" :key="col.name" :props="props">
              {{ col.value }}
            </q-td>
          </q-tr>
          <q-tr v-show="props.expand" :props="props">
            <q-td colspan="100%">
              <div>{{ state.expanded_text }}</div>
              <q-scroll-area v-if="props.row.diff !== null && props.row.diff.length > 0" style="height: 100px">
                <div id="diffpreview" class="bg-grey-9 text-white">
                  <div v-for="(diff, index) in props.row.diff" :key="index">
                    <div v-if="diff[0] === 1" class="row bg-green-9">
                      <div class="col-1 text-center">+</div>
                      <div class="col-11">{{ diff[1] }}</div>
                    </div> 
                    <div v-else-if="diff[0] === 0" class="row">
                      <div class="col-1"></div>
                      <div class="col-11">{{ diff[1] }}</div>
                    </div>
                    <div v-else class="row bg-red-9">
                      <div class="col-1 text-center">-</div>
                      <div class="col-11">{{ diff[1] }}</div>
                    </div>
                  </div>
                </div>
              </q-scroll-area>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card-section>
    <q-separator />
    <q-card-actions align="right">
      <div class="q-pa-sm q-gutter-sm">
        <q-btn push icon="cancel" color="red" @click="close" label="Close" />
      </div>
    </q-card-actions>
  </q-card>
</template>

<script>
import { reactive, onMounted, watch } from 'vue'
import PouchDB from 'pouchdb-browser'

export default {
  name: 'ActivitiesDialog',
  props: {},
  emits: ['close-activities'],
  setup(props, { emit }) {
    const state = reactive({
      activities: [],
      table: {},
      expanded: [],
      current: [],
      prev: [],
      wrap: true,
      diff: [],
      expanded_text: ''
    })
    onMounted(async() => {
      await query()
      sort()
      tableMap()
    })
    watch(() => state.expanded, async(newVal, oldVal) => {
      if (newVal) {
        if (newVal.length === 2 || oldVal.length === 0) {
          var update = false
          if (newVal.length === 2) {
            newVal.splice(newVal.indexOf(oldVal[0]),1)
            update = true
          }
          const b = state.activities.find(c => c._id === newVal[0])
          state.diff = []
          if (b.diff !== null) {
            state.expanded_text = 'Document updated with these changes: '
            state.diff = b.diff
          } else if (b.doc_rev !== null) {
            state.expanded_text = 'Added new document.'
          } else {
            state.expanded_text = 'No further details about this activity.'
          }
          if (update) {
            state.expanded = newVal
          }
        }
      }
    })
    const close = () => {
      emit('close-activities')
    }
    const query = async() => {
      var localDB = new PouchDB('activities')
      var result = await localDB.allDocs({
        include_docs: true,
        attachments: true
      })
      if (result.rows.length > 0) {
        for (var a of result.rows) {
          state.activities.push(a.doc)
        }
      }
    }
    const sort = () => {
      let sorted = state.activities.sort((a, b) => {
        let date1 = new Date(a.datetime)
        let date2 = new Date(b.datetime)
        if (date1 > date2) {
          return -1
        }
        else if (date1 < date2) {
          return 1
        }
        else {
          return 0
        }
      })
      state.activities = sorted
    }
    const tableMap = () => {
      state.table.columns = [
        {name: 'event', label: 'Event', field: 'event', align: 'left'},
        {name: 'datetime', label: 'Initiated', field: 'datetime', align: 'left'},
        {name: 'user', label: 'User', field: 'user', align: 'left'}
      ]
      state.table.visibleColumns = ['event', 'datetime', 'user']
      state.table.rows = state.activities
    }
    return {
      close,
      query,
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
