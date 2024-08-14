<template>
  <q-card>
    <q-toolbar>
      <q-toolbar-title>Templates</q-toolbar-title>
    </q-toolbar>
    <q-card-section>
      <q-list>
        <div v-for="(template, index) in state.templates" :key="template.id">
          <q-item clickable @click="selectTemplate(index)" v-ripple>
            <q-item-section>
              <q-item-label>{{ template.id }}</q-item-label>
              <q-item-label caption>{{ template.text }}</q-item-label>
            </q-item-section>
          </q-item>
        </div>
      </q-list>
    </q-card-section>
    <q-card-actions align="right" class="text-primary">
      <q-btn flat label="Cancel" @click="closeTemplate" />
    </q-card-actions>
  </q-card>
</template>

<script>
import { defineComponent, reactive, onMounted, watch } from "vue"
import Fuse from 'fuse.js'

export default defineComponent({
  name: 'QTemplate',
  props: {
    template: Object,
    user: Object
  },
  emits: ['close-template', 'select-template'],
  setup(props, { emit }) {
    const state = reactive({
      selectedTemplate: {text: '', target: '', clear: false},
      templates: [],
    })
    onMounted(async() => {
      const results = []
      const templates = props.user.templates
      const needle = props.template.text.replace('&nbsp;', '')
      const fuse = new Fuse(templates, {keys: ['id', 'text']})
      const result = fuse.search(needle)
      const shortresult = result.slice(0,20)
      for (const i in shortresult) {
        results.push(result[i].item)
      }
      state.templates = results
    })
    watch(() => props.template, value => {
      console.log(props.template + '/' + value)
      // stub for getting template based on template.text
    })
    const closeTemplate = () => {
      emit('close-template')
    }
    const selectTemplate = (index) => {
      state.selectedTemplate.text = state.templates[index].text
      state.selectedTemplate.target = props.template.target
      state.selectedTemplate.type = props.template.type
      state.selectedTemplate.clear = false
      emit('select-template', state.selectedTemplate)
    }
    return {
      closeTemplate,
      selectTemplate,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">

</style>
