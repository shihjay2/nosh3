<template>
  <q-card>
    <q-toolbar>
      <q-toolbar-title>Select Dosage for {{ state.updated_medication_final.name }}</q-toolbar-title>
    </q-toolbar>
    <q-card-section>
      <q-list>
        <div v-for="(dosage, index) in state.dosages" :key="index">
          <q-item clickable @click="selectDosage(index)" v-ripple>
            <q-item-section>
              <q-item-label>{{ dosage }}</q-item-label>
            </q-item-section>
          </q-item>
        </div>
      </q-list>
    </q-card-section>
    <q-card-actions align="right" class="text-primary">
      <q-btn flat label="Cancel" v-close-popup />
    </q-card-actions>
  </q-card>
</template>

<script>
import { defineComponent, reactive, onMounted } from 'vue'

export default defineComponent({
  name: 'QDosage',
  props: {
    medication_final: Object,
    medication_strengths: Object,
    medication_rxcuis: Object
  },
  emits: ['select-dosage'],
  setup(props, { emit }) {
    const state = reactive({
      dosages: [],
      updated_medication_final: {}
    })
    onMounted(() => {
      state.dosages = props.medication_strengths
      state.updated_medication_final = props.medication_final
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
