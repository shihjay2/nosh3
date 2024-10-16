<template>
  <q-list v-if="state.style == 'p'">
    <q-item>
      <q-item-section>
        <q-item-label>{{ state.data.key }}</q-item-label>
        <q-item-label caption>{{ state.data.value }}</q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
  <span v-if="state.style == 'span_no_label'">{{ state.data.value.toLowerCase() }}&nbsp;</span>
  <q-item v-if="state.style == 'list'">
    <q-item-section>
      <div v-html="state.content"></div>
    </q-item-section>
  </q-item>
</template>

<script>
import { defineComponent, reactive, onMounted, watch } from 'vue'

export default defineComponent({
  name: 'QInfoTemplate',
  props: {
    data: Object,
    style: String
  },
  setup(props) {
    const state = reactive({
      data: {},
      style: ''
    })
    onMounted(() => {
      state.data = props.data
      state.style = props.style
      console.log(state.data)
    })
    watch(() => props.data, (newVal) => {
      state.data = newVal
    })
    return {
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">

</style>
