<template>
  <q-card>
    <q-toolbar>
      <q-toolbar-title>Enter Details for {{ state.updated_vaccine.shortname }}</q-toolbar-title>
    </q-toolbar>
    <q-card-section>
      <span class="text-blue q-pa-sm q-gutter-md" style="font-size: 2em">
        <q-icon name="print" />
      </span>
      <a v-if="state.updated_vaccine.vis !== ''" tag="a" :href="state.updated_vaccine.vis_url" target="_blank" v-ripple>
        {{ state.updated_vaccine.vis }}
      </a>
    </q-card-section>
    <q-separator />
    <Form @submit="selectVaccine">
      <q-card-section v-if="state.schema.length !== 0">
        <div v-for="field in state.schema" :key="field.id" class="q-pa-sm">
          <div class="q-gutter-sm">
            <p>{{ field.label_long }}</p>
            <QInputWithValidation
              v-if="!field.hidden"
              :name="field.id"
              :label="field.label"
              :type="field.type"
              :model="state.form[field.id]"
              @update-model="updateValue"
              :options="field.options"
              :multiple="field.multiple"
              :readonly="field.readonly"
              :mask="field.mask"
              :rules="field.rules"
              :placeholder="field.placeholder"
              :catch="state.catch"
            />
          </div>
        </div>
      </q-card-section>
      <q-card-actions align="right" class="text-primary">
        <q-btn flat icon="cancel" label="Cancel" @click="closeVaccine" />
        <q-btn v-if="state.schema.length !== 0" flat icon="save" label="Save" type="submit" />
      </q-card-actions>
    </Form>
  </q-card>
</template>

<script>
import { defineComponent, reactive, onMounted } from "vue"
import { Form } from "vee-validate"
import QInputWithValidation from "./QInputWithValidation.vue"

export default defineComponent({
  name: 'QVaccine',
  components: {
    Form,
    QInputWithValidation
  },
  props: {
    vaccine: Object,
  },
  emits: ['select-vaccine', 'close-vaccine'],
  setup(props, { emit }) {
    const state = reactive({
      updated_vaccine: {},
      schema: [],
      form: {}
    })
    onMounted(() => {
      state.updated_vaccine = props.vaccine
      for (var i in state.updated_vaccine.protocol) {
        var target = ''
        for (var j in state.updated_vaccine.protocol[i].targetDisease) {
          if (j !== '0') {
            target += ', '
          }
          target += state.updated_vaccine.protocol[i].targetDisease[j].display
        }
        var k = {}
        k.id = i
        k.name = k.id
        k.type = 'text'
        k.rules = 'required|integer|max_value:' + state.updated_vaccine.protocol[i].series.replace('-dose', '')
        k.label_long = 'Dose for ' + target + ' out of ' + state.updated_vaccine.protocol[i].series + ' series'
        k.label = 'Dose of Series'
        if (state.updated_vaccine.protocol[i].series !== '0-dose') {
          state.schema.push(k)
        }
        state.form[i] = state.updated_vaccine.protocol[i].doseNumberPositiveInt
      }
    })
    const closeVaccine = () => {
      emit('close-vaccine')
    }
    const selectVaccine = () => {
      for (var i in state.updated_vaccine.protocol) {
        state.updated_vaccine.protocol[i].doseNumberPositiveInt = Number(state.form[i])
      }
      emit('select-vaccine', state.updated_vaccine)
    }
    const updateValue = (val, field) => {
      state.form[field] = val
    }
    return {
      closeVaccine,
      selectVaccine,
      updateValue,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">

</style>
