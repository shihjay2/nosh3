<template>
  <q-markup-table v-if="state.data.columns !== undefined">
    <thead>
      <tr>
        <th v-for="(col, index) in state.data.columns" :key="index">
          {{ col.label }}
        </th>
      </tr>
    </thead>
    <tbody v-if="state.data.rows.length > 0">
      <tr v-for="(row, i) in state.data.rows" :key="i" clickable @click="onFormOpen(i)">
        <td v-for="(col, j) in state.data.columns" :key="j">
          <span>{{ row[col.field] }}</span>
        </td>
      </tr>
    </tbody>
  </q-markup-table>
</template>

<script>
import { defineComponent, reactive, onMounted } from 'vue'

export default defineComponent({
  name: 'QTableTemplate',
  props: {
    data: Object,
  },
  emits: ['select-dosage'],
  setup(props, { emit }) {
    const state = reactive({
      headers: [],
      data: {}
    })
    onMounted(() => {
      state.data = props.data
      state.updated_medication_final = props.medication_final
      console.log(state.data.columns)
    })
    const selectDosage = (index) => {
      state.updated_medication_final.subindex = index
      state.updated_medication_final.rxcui = props.medication_rxcuis[index]
      state.updated_medication_final.strength = state.dosages[index]
      emit('select-dosage', state.updated_medication_final)
    }
    return {
      selectDosage,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">

</style>
