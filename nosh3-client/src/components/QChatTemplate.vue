<template>
  <div class="q-pa-md">
    <q-expansion-item
        expand-separator
        icon="chat"
        :label="state.topic"
        :caption="state.recipient_names"
        v-model="state.opened"
      >
      <q-card>
        <Form @submit="onSubmit">
          <q-card-section>
            <div v-for="field in state.schema" :key="field.id" class="q-pa-sm">
              <QInputWithValidation
                v-if="showForm(field.hidden,field.category)"
                :name="field.id"
                :label="field.label"
                :type="field.type"
                :model="state.form[field.id]"
                @update-model="updateValue"
                :placeholder="field.placeholder"
                :rules="field.rules"
                :options="field.options"
                :multiple="field.multiple"
                :readonly="field.readonly"
                :mask="field.mask"
              />
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn push icon="login" color="primary" label="Confirm" type="submit" />
          </q-card-actions>
        </Form>
      </q-card>
    </q-expansion-item>
    <q-virtual-scroll
      style="max-height: 400px;"
      ref="virtualChatRef"
      :items="state.messages"
      separator
      @virtual-scroll="onVirtualScroll" 
      v-slot="{ item, index }"
    >
      <q-chat-message :key="index"
        :name="item.name"
        :avatar="item.avatar"
        :text="item.text"
        :stamp="item.stamp"
        :sent="item.sent"
      />
    </q-virtual-scroll>
    <q-footer v-if="state.message_field" elevated>
      <q-toolbar>
        <q-form @submit="sendMessage" class="full-width">
          <q-input
            ref="newMessage"
            bg-color="white"
            v-model="state.new"
            placeholder="Message"
            class="full-width"
            autogrow
            outlined
            label-slot
          >
            <template v-slot:label>
              <div class="row items-center all-pointer-events">
                <q-icon class="q-mr-xs" color="deep-orange" size="24px" name="schedule_send" />
                <div v-if="state.send_date === ''">Send now</div>
                <div v-else>To send on {{ state.send_date }}</div>
              </div>
            </template>
            <template v-slot:append>
              <q-btn-dropdown split round dense flat icon="send" color="primary" @click="sendMessage" dropdown-icon="schedule">
                <q-list>
                  <q-item>
                    <q-input filled v-model="state.send_date" placeholder="Future Send Date">
                      <template v-slot:prepend>
                        <q-icon name="event" class="cursor-pointer">
                          <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                            <q-date v-model="state.send_date" mask="YYYY-MM-DD HH:mm">
                              <div class="row items-center justify-end">
                                <q-btn v-close-popup label="Close" color="primary" flat />
                              </div>
                            </q-date>
                          </q-popup-proxy>
                        </q-icon>
                      </template>
                      <template v-slot:append>
                        <q-icon name="access_time" class="cursor-pointer">
                          <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                            <q-time v-model="state.send_date" mask="YYYY-MM-DD HH:mm">
                              <div class="row items-center justify-end">
                                <q-btn v-close-popup label="Close" color="primary" flat />
                              </div>
                            </q-time>
                          </q-popup-proxy>
                        </q-icon>
                      </template>
                    </q-input>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
            </template>
          </q-input>
        </q-form>
      </q-toolbar>
    </q-footer>
  </div>
</template>

<script>
import { defineComponent, reactive, ref, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import Case from 'case'
import { common } from '@/logic/common'
import { Form } from 'vee-validate'
import QInputWithValidation from '@/components/QInputWithValidation.vue'
import moment from 'moment-timezone'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import {v4 as uuidv4} from 'uuid'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'QChatTemplate',
  components: {
    Form,
    QInputWithValidation
  },
  props: {
    auth: Object,
    couchdb: String,
    pin: String,
    online: Boolean,
    id: String,
    resource: String,
    category: String,
    user: Object,
    base: Object,
    schema: Object,
    patient: String,
    archive: Boolean
  },
  emits: ['reload-complete', 'set-chat-id'],
  setup (props, { emit }) {
    const $q = useQuasar()
    const { getPrefix, sync, thread } = common()
    const state = reactive({
      messages: [],
      last: {},
      new: '',
      topic: '',
      recipients: [],
      recipient_names: '',
      form: {},
      base: {},
      schema: {},
      opened: false,
      send_date: '',
      virtual_index: 0,
      message_field: false
    })
    const virtualChatRef = ref(null)
    var prefix = getPrefix()
    var localDB = new PouchDB(prefix + props.resource)
    onMounted(async() => {
      state.base = props.base
      state.schema = props.schema
      if (props.id === 'add') {
        state.opened = true
      } else {
        await query()
        state.message_field = true
        virtualChatRef.value.scrollTo(state.virtual_index)
      }
    })
    watch(() => props.reload, async(newVal) => {
      if (newVal) {
        await query()
        emit('reload-complete')
      }
    })
    watch(() => props.id, async(newVal) => {
      if (newVal) {
        await query()
      }
    })
    const onSubmit = () => {
      state.topic = state.form.topic
      state.recipients = state.form.recipients
      recipientNames()
      if (state.topic !== '' && state.recipients.length > 0) {
        state.opened = false
        state.message_field = true
      } else {
        $q.notify({
          message: 'Please complete all fields!',
          color: 'red',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const onVirtualScroll = ({ index }) => {
      console.log('virtual scroll fired, index ' + index)
      // state.virtual_index = index
    }
    const query = async() => {
      let arr = []
      const chat = []
      const a = await localDB.get(props.id)
      arr = await thread(a, props.online, props.patient)
      for (const b in arr) {
        const chatItem = {}
        objectPath.set(chatItem, 'id', arr[b]._id)
        objectPath.set(chatItem, 'doc', arr[b])
        objectPath.set(chatItem, 'date', new Date(arr[b].sent))
        objectPath.set(chatItem, 'stamp', moment(arr[b].sent).fromNow())
        if (props.user.reference === arr[b].sender.reference) {
          objectPath.set(chatItem, 'sent', true)
        } else {
          objectPath.set(chatItem, 'sent', false)
        }
        const name_arr = arr[b].sender.reference.split('/')
        const namedb = new PouchDB(prefix + Case.snake(pluralize(name_arr[0])))
        const name_doc = await namedb.get(name_arr[1])
        objectPath.set(chatItem, 'name', removeTags(name_doc.text.div))
        objectPath.set(chatItem, 'text', arr[b].payload[0].contentString.split('\n'))
        // objectPath.set(chatItem, 'text', [arr[b].payload[0].contentString])
        if (objectPath.has(arr[b], 'photo.0.data')) {
          objectPath.set(chatItem, 'avatar', 'data:' + arr[b].photo[0].contentType + ';base64,' + arr[b].photo[0].data)
        }
        chat.push(chatItem)
      }
      // sort docs by date time
      chat.sort((c, d) => c.date - d.date)
      state.messages = chat
      state.virtual_index = state.messages.length - 1
      state.last = chat.slice(-1)[0].doc
      state.topic = chat.slice(-1)[0].doc.topic.text
      const recipients = state.last.recipient
      const index = recipients.findIndex(e => e.reference === props.user.reference)
      recipients.splice(index,1)
      recipients.push(state.last.sender)
      const recipients_arr = []
      for (const f of recipients) {
        recipients_arr.push(f.reference)
      }
      state.recipients = recipients_arr
      recipientNames()
      // load form
      state.form.topic = state.topic
      state.form.recipients = state.recipients
    }
    const recipientNames = () => {
      const arr = []
      const opts = state.schema.find(row => row.id == 'recipients')
      for (const a of state.recipients) {
        const d = opts.options.find(e => e.value === a)
        arr.push(d.label)
      }
      state.recipient_names = arr.join(', ')
    }
    const removeTags = (str) => {
      if ((str===null) || (str==='')) {
        return false
      } else {
        str = str.toString()
        return str.replace( /(<([^>]+)>)/ig, '')
      }
    }
    const sendMessage = async() => {
      const fhir = state.base.fhir
      const id = 'nosh_' + uuidv4()
      objectPath.set(fhir, '_id', id)
      objectPath.set(fhir, 'id', id)
      objectPath.set(fhir, 'subject.reference', 'Patient/' + props.patient)
      objectPath.set(fhir, 'sender.reference', props.user.reference)
      for (const a in state.recipients) {
        objectPath.set(fhir, 'recipient.' + a + '.reference', state.recipients[a])
      }
      objectPath.set(fhir, 'topic.text', state.topic)
      objectPath.set(fhir, 'payload.0.contentString', state.new)
      if (state.send_date !== '') {
        objectPath.set(fhir, 'sent', moment(state.send_date).format('YYYY-MM-DDTHH:mm:ss.SSSZ'))
        objectPath.set(fhir, 'status', 'preparation')
      } else {
        objectPath.set(fhir, 'sent', moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ'))
        objectPath.set(fhir, 'status', 'in-progress')
      }
      if (objectPath.has(state, 'last.id')) {
        objectPath.set(fhir, 'inResponseTo.reference', 'Communication/' + props.id)
      }
      await sync(props.resource, false, props.patient, true, fhir)
      if (props.id == 'add') {
        emit('set-chat-id', id)
      } else {
        await query()
      }
      state.new = ''
      state.send_date = ''
      virtualChatRef.value.refresh(state.virtual_index)
    }
    const showForm = (hidden, category) => {
      if (props.category === 'all' || props.category === category) {
        if (hidden === false || typeof hidden == 'undefined') {
          return true
        } else {
          return false
        }
      } else {
        return false
      }
    }
    const updateValue = (val, field, type) => {
      state.form[field] = val
    }
    return {
      onSubmit,
      onVirtualScroll,
      query,
      recipientNames,
      removeTags,
      sendMessage,
      showForm,
      sync,
      thread,
      updateValue,
      virtualChatRef,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
