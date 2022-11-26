<template>
  <q-select v-if="type === 'select'"
    :model-value="computedModel"
    :label="label"
    :name="name"
    ref="qRefSelect"
    :options="qOptions"
    :multiple="multiple"
    @update:model-value="onInput"
    @filter="filterFn"
    :error-message="errorMessage"
    :error="!!errorMessage"
    use-input
    clearable
    dense="dense"
    emit-value
    map-options
  >
    <template v-slot:no-option>
      <q-item>
        <q-item-section class="text-grey">
          No results
        </q-item-section>
      </q-item>
    </template>
  </q-select>
  <q-select v-else-if="type === 'tags'"
    :model-value="computedModel"
    :label="label"
    :name="name"
    ref="qRefSelect"
    :options="qOptions"
    @update:model-value="onInput"
    :error-message="errorMessage"
    :error="!!errorMessage"
    use-input
    clearable
    use-chips
    multiple
    dense="dense"
    hide-dropdown-icon
    input-debounce="0"
    new-value-mode="add-unique"
    hint="Press Enter to create a new item"
  />
  <q-select v-else-if="type === 'autocomplete'"
    :model-value="computedModel"
    :label="label"
    :name="name"
    ref="qRefSelect"
    :options="qOptions"
    @update:model-value="onInput"
    @filter="filterFn"
    :error-message="errorMessage"
    :error="!!errorMessage"
    use-input
    clearable
    dense="dense"
    hide-dropdown-icon
    input-debounce="0"
    emit-value
    map-options
    new-value-mode="add-unique"
  >
    <template v-slot:no-option>
      <q-item>
        <q-item-section class="text-grey">
          No results
        </q-item-section>
      </q-item>
    </template>
  </q-select>
  <q-field v-else-if="type === 'checkbox'"
    :borderless="true"
    :error="!!errorMessage"
    :error-message="errorMessage"
  >
    <q-checkbox
      :model-value="computedModel"
      :label="label"
      :name="name"
      :autofocus="state.autofocus"
      @update:model-value="onInput"
      dense="dense"
    />
  </q-field>
  <q-field v-else-if="type === 'editor'"
    :error-message="errorMessage"
    :error="!!errorMessage"
    :label="label"
    :bottom-slots="true"
    :borderless="true"
    dense="dense"
  >
    <div class="q-pt-md full-width" style="color:#000000">
      <q-editor
        :model-value="computedModel"
        :name="name"
        ref="qRefEditor"
        :placeholder="placeholder"
        @update:model-value="onInput"
        min-height="5rem"
      />
    </div>
    <template v-slot:append>
      <q-icon name="description" :color="state.template" />
      <q-icon name="emergency" color="teal" clickable @click="nextFill()"/>
    </template>
  </q-field>
  <q-input v-else-if="type === 'password' || type === 'email' || type === 'tel' || type === 'url'"
    :model-value="computedModel"
    :label="label"
    :type="type"
    :name="name"
    ref="qRef"
    :readonly="readonly"
    :mask="mask"
    :placeholder="placeholder"
    :error-message="errorMessage"
    :error="!!errorMessage"
    @update:model-value="onInput"
    dense="dense"
  />
  <q-input v-else
    :model-value="computedModel"
    :label="label"
    :name="name"
    ref="qRef"
    :readonly="readonly"
    :mask="mask"
    :placeholder="placeholder"
    :error-message="errorMessage"
    :error="!!errorMessage"
    @update:model-value="onInput"
    autogrow
    dense="dense"
  >
    <template v-if="type === 'date' || type === 'datetime' || type === 'textarea'" v-slot:append>
      <q-icon v-if="type === 'date'" name="event" class="cursor-pointer">
        <q-popup-proxy ref="qDateProxy" transition-show="scale" transition-hide="scale">
          <q-date :model-value="computedModel" @update:model-value="onInput" mask="YYYY-MM-DD">
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
      <q-icon v-if="type === 'textarea'" name="description" :color="state.template" />
      <q-icon v-if="type === 'textarea'" name="emergency" color="teal" clickable @click="nextFill()"/>
      <q-icon v-if="type === 'datetime'" name="access_time" class="cursor-pointer">
        <q-popup-proxy ref="qTimeProxy" transition-show="scale" transition-hide="scale">
          <q-time :model-value="computedModel" @update:model-value="onInput" mask="YYYY-MM-DD HH:mm">
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-time>
        </q-popup-proxy>
      </q-icon>
    </template>
    <template v-if="type === 'datetime'" v-slot:prepend>
      <q-icon v-if="type === 'datetime'" name="event" class="cursor-pointer">
        <q-popup-proxy ref="qDateProxy" transition-show="scale" transition-hide="scale">
          <q-date :model-value="computedModel" @update:model-value="onInput" mask="YYYY-MM-DD">
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<script>
import { computed, defineComponent, onMounted, reactive, ref, watch } from "vue"
import { useField } from "vee-validate"
import {v4 as uuidv4} from 'uuid'

export default defineComponent({
  name: "QInputWithValidation",
  props: {
    type: {
      type: String,
      default: "text",
    },
    name: {
      type: String,
      required: true,
    },
    rules: {
      type: String,
      default: ""
    },
    mask: {
      type: String,
      default: ""
    },
    label: {
      type: String,
      required: true,
    },
    multiple: {
      type: Boolean,
      default: false
    },
    options: {
      type: Array
    },
    readonly: {
      type: Boolean,
      default: false
    },
    catch: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: null
    },
    model: {
      type: [String, Number, Array, Boolean],
      default: null,
    },
    template: {
      type: Boolean,
      default: false
    },
    focus: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update-model', 'update-template'],
  setup(props, { emit }) {
    var validationRef = ref(props.rules)
    const {
      value: inputValue,
      errorMessage,
      handleChange,
      meta,
    } = useField(props.name, validationRef, {
      type: props.type,
      initialValue: props.model,
      label: props.label,
      uncheckedValue: false,
      valueProp: true
    })
    const state = reactive({
      template: 'blue',
      autofocus: false
    })
    const qRef = ref(null)
    const qRefEditor = ref(null)
    const qRefSelect = ref(null)
    const onInput = (event) => {
      handleChange(event)
      if (qRefSelect.value !== null) {
        if (props.multiple == true) {
          if (props.type !== 'tags') {
            qRefSelect.value.updateInputValue('')
          }
        }
      }
      emit('update-model', event, props.name, props.type)
    }
    var qOptions = ref(props.options)
    const filterFn = (val, update) => {
      update(() => {
        const needle = val.toLocaleLowerCase()
        qOptions.value = props.options.filter(v => v['label'].toLocaleLowerCase().indexOf(needle) > -1)
      })
    }
    const computedModel = computed(() => {
      if (props.model === null && props.type === 'editor') {
        return ''
      } else {
        return props.model
      }
    })
    onMounted(() => {
      if (qRefEditor.value !== null) {
        qRefEditor.value.id = uuidv4()
      }
    })
    watch(() => props.model, value => {
      inputValue.value = value
      if (props.template == true) {
        if (qRefEditor.value !== null) {
          setTimeout(() => {
            const el = qRefEditor.value.caret.el
            el.focus()
            const range = document.createRange()
            range.selectNodeContents(el)
            range.collapse(false)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
            emit('update-template')
          }, 200)
        }
        if (qRef.value !== null) {
          setTimeout(() => {
            const input = qRef.value.getNativeElement()
            input.focus()
            input.setSelectionRange(input.value.length,input.value.length)
            emit('update-template')
          }, 200)
        }
      }
    })
    watch(() => props.catch, value => {
      if (value == true) {
        state.template = 'red'
      } else {
        state.template = 'blue'
      }
    })
    watch(() => props.rules, (newValue) => {
      if (newValue) {
        validationRef.value = newValue
      }
    })
    watch(() => props.focus, (newValue) => {
      if (newValue) {
        if (props.type == 'select') {
          qRefSelect.value.focus()
        } else{
          qRef.value.focus()
        }
      }
    })
    const nextFill = () => {
      if (qRefEditor.value !== null) {
        setTimeout(() => {
          const el = qRefEditor.value.caret.el
          el.focus()
          const range = document.createRange()
          const input1 = qRefEditor.value.getContentEl()
          const needle1 = input1.innerHTML.indexOf('*')
          if (needle1 !== -1) {
            range.setStart(el.firstChild, needle1)
            range.setEnd(el.firstChild, needle1 + 1)
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }, 200)
      }
      if (qRef.value !== null) {
        setTimeout(() => {
          const input = qRef.value.getNativeElement()
          input.focus()
          const needle = input.value.indexOf('*')
          if (needle !== -1) {
            input.setSelectionRange(needle, needle+1)
          }
        }, 200)
      }
    }
    return {
      computedModel,
      errorMessage,
      onInput,
      handleChange,
      inputValue,
      filterFn,
      meta,
      nextFill,
      qOptions,
      qRef,
      qRefEditor,
      qRefSelect,
      state,
      validationRef
    }
  }
})
</script>
