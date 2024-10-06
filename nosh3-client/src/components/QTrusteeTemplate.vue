<template>
  <div v-if="state.view === 'resource'" class="q-pa-md q-gutter-md">
    <q-btn color="positive" class="full-width" icon="add" label="Add New User to Share" clickable @click="addUser('resource')" />
    <q-card v-for="(row, index) in state.rows" :key="index">
      <q-card-section>
        <div class="text-h6 text-primary">{{ row.type }}</div>
        <div class="text-subtitle2">Locations: {{ row.location }}</div>
      </q-card-section>
      <q-separator inset />
      <q-card-section avatar>
        <q-avatar color="teal" text-color="white" icon="manage_accounts" />
        <q-chip v-for="(action, index1) in row.actions" :key="index1">
          <q-icon v-if="action === 'read'" name="visibility" class="q-pr-sm"></q-icon>
          <q-icon v-if="action === 'write'" name="edit" class="q-pr-sm"></q-icon>
          <q-icon v-if="action === 'delete'" name="delete" class="q-pr-sm"></q-icon>
          {{ action }}
        </q-chip>
      </q-card-section>
      <q-separator inset />
      <q-card-section avatar style="white-space: normal">
        <q-avatar color="red" text-color="white" icon="link" />
        <b class="q-pl-sm">Locations</b>
        <q-list v-for="(location, index2) in row.locations" :key="index2">
          <q-item>
            {{ location }}
          </q-item>
        </q-list>
      </q-card-section>
      <q-separator inset />
      <q-card-section avatar>
        <q-avatar color="primary" text-color="white" icon="people" />
        <b class="q-pl-sm">Privileges</b>
        <div class="column justify-start">
          <div v-for="(privilege, index3) in row.privileges" :key="index3">
            <q-chip removable @remove="removePrivilege(index, index3)">
              {{ privilege }}
            </q-chip>
          </div>
        </div>
      </q-card-section>
      <div class="row justify-end q-pa-md">
        <q-input v-if="state.email_show && state.email_show_index === index" dense v-model="state.email" label="Email" :error="state.error">
          <template v-slot:error>
            E-mail invalid.
          </template>
        </q-input>
        <q-btn round icon="add" color="accent" @click="addPrivilege(index)"></q-btn>
      </div>
      <div v-if="state.email_show && state.email_show_index === index" class="row justify-end q-pb-md q-pr-md">
        <q-chip v-if="!row.privileges.includes('npi')" clickable @click="clickPrivilege(index, 'npi')">npi<q-icon name="add" class="q-pl-sm" /></q-chip>
        <q-chip v-if="!row.privileges.includes('offline')" clickable @click="clickPrivilege(index, 'offline')">offline<q-icon name="add" class="q-pl-sm" /></q-chip>
      </div>
    </q-card>
  </div>
  <div v-if="state.view === 'user'" class="q-pa-md q-gutter-md">
    <q-card>
      <q-btn color="positive" class="full-width" icon="add" label="Add New User to Share" clickable @click="addUser('user')" />
      <q-list bordered class="rounded-borders q-pa-md q-gutter-md">
        <q-expansion-item
          v-for="(row4, index4) in state.user_rows" :key="index4"
          expand-separator
          icon="account_circle"
          :label="row4.email"
        >
          <q-btn color="positive" class="full-width" icon="add" label="Read, Write, and Delete for All Resources" clickable @click="addAllResources(row4.email, ['read', 'write', 'delete'])" />
          <q-btn color="primary" class="full-width" icon="add" label="Read Only for All Resources" clickable @click="addAllResources(row4.email, ['read'])" />
          <q-btn color="negative" class="full-width" icon="close" label="Remove Access to All Resources" clickable @click="removeAllResources(row4.email)" />
          <q-list bordered separator>
            <q-item v-for="(row5, index5) in row4.resources" :key="index5">
              <q-item-section avatar>
                <q-icon color="primary" name="folder" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ row5.type }}
                </q-item-label>
                <q-item-label>
                  <q-chip v-for="(action1, index6) in row5.actions" :key="index6">
                    <q-icon v-if="action1 === 'read'" name="visibility" class="q-pr-sm"></q-icon>
                    <q-icon v-if="action1 === 'write'" name="edit" class="q-pr-sm"></q-icon>
                    <q-icon v-if="action1 === 'delete'" name="delete" class="q-pr-sm"></q-icon>
                    {{ action1 }}
                  </q-chip>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn flat round color="red" icon="delete" clickable @click="removeResource(row5, row4.email)">
                  <q-tooltip>Delete</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </q-expansion-item>
      </q-list>
    </q-card>
  </div>
  <div v-if="state.view === 'add'" class="q-pa-md q-gutter-md">
    <q-card>
      <q-card-section>
        <div class="text-h6 text-center">Add user for access to your health records</div>
      </q-card-section>
      <q-separator />
      <Form @submit="onSubmitAdd">
        <q-card-section>
          <div v-for="field in state.schemaAdd" :key="field.id" class="q-pa-sm">
            <QInputWithValidation
              ref="myInput"
              :name="field.id"
              :label="field.label"
              :type="field.type"
              :model="state.formAdd[field.id]"
              @update-model="updateValue"
              :placeholder="field.placeholder"
              :rules="field.rules"
              :options="field.options"
              :multiple="field.multiple"
              focus="false"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn push icon="cancel" color="negative" @click="onCancelAdd" label="Cancel" />
          <q-btn push icon="add" color="positive" label="Add User" type="submit" />
        </q-card-actions>
      </Form>
    </q-card>
  </div>
</template>

<script>
import { defineComponent, reactive, onMounted } from 'vue'
import axios from 'axios'
import { Form } from 'vee-validate'
import objectPath from 'object-path'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import QInputWithValidation from '@/components/QInputWithValidation.vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'QTrusteeTemplate',
  components: {
    Form,
    QInputWithValidation
  },
  props: {
    user: Object,
    view: String
  },
  emits: ['close', 'loading', 'qr'],
  setup (props, { emit }) {
    const $q = useQuasar()
    const auth = useAuthStore()
    const state = reactive({
      user: {},
      view: '',
      rows: [],
      user_rows: [],
      email_show: false,
      email_show_index: 0,
      click_origin: '',
      schemaAdd: [
        {
          "id": "email",
          "label": "Email Address of New User",
          "model": "email",
          "type": "email",
          "placeholder": "yourname@email.com",
          "rules": "required|email"
        },
        {
          "id": "access",
          "label": "Access Permissions for Health Records",
          "model": "access",
          "type": "select",
          "options": [
            {"value": "read,write,delete", "label": "Read, Write, Delete"},
            {"value": "read", "label": "Read Only"},
            {"value": "restrict", "label": "Restrict Some Resources"}
          ],
          "rules": "required"
        }
      ],
      formAdd: {},
      options: []
    })
    onMounted(async() => {
      emit('loading')
      state.user = props.user
      state.view = props.view
      const body = {email: state.user.email, filter: ''}
      const a = await axios.post(window.location.origin + '/auth/gnapResources', body)
      if (objectPath.has(a, 'data.0.ro')) {
        state.rows = objectPath.get(a, 'data')
        calcUsers()
        emit('loading')
      }
    })
    const addAllResources = async(email, read_only_arr) => {
      emit('loading')
      for (const i in state.rows) {
        if (objectPath.get(state, 'rows.' + i + '.actions').join() === read_only_arr.join()) {
          if (objectPath.get(state, 'rows.' + i + '.privileges').findIndex((item) => item === email) === -1) {
            const privileges = objectPath.get(state, 'rows.' + i + '.privileges')
            privileges.push(email)
            objectPath.set(state, 'rows.' + i + '.privileges', privileges)
            const body = {
              resource: objectPath.get(state, 'rows.' + i),
              method: 'PUT',
              jwt: auth.gnap_jwt
            }
            await axios.post(window.location.origin + '/auth/gnapResource', body)
            const counter = Number(i) + 1
            $q.notify({
              message: counter + '/' + state.rows.length + ': Privileges updated for ' + objectPath.get(state, 'rows.' + i + '.type'),
              color: 'primary',
              actions: [
                { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
              ]
            })
          }
        }
      }
      calcUsers()
      emit('loading')
      $q.notify({
        message: 'Privileges updated.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const addPrivilege = async(row_index) => {
      if (state.email_show && state.email !== '') {
        if (validate(state.email)) {
          const privileges = objectPath.get(state, 'rows.' + row_index + '.privileges')
          privileges.push(state.email)
          objectPath.set(state, 'rows.' + row_index + '.privileges', privileges)
          const body = {
            resource: objectPath.get(state, 'rows.' + row_index),
            method: 'PUT',
            jwt: auth.gnap_jwt
          }
          const a = await axios.post(window.location.origin + '/auth/gnapResource', body)
          if (objectPath.has(a, 'data')) {
            $q.notify({
              message: 'Privilege ' + state.email + ' added.',
              color: 'primary',
              actions: [
                { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
              ]
            })
          }
        } else {
          console.log('error')
        }
      } else {
        state.email_show = true
        state.email_show_index = row_index
      }
    }
    const addResources = async(email, row_indexes) => {
      let i = 0
      for (const row_index of row_indexes) {
        const privileges = objectPath.get(state, 'rows.' + row_index + '.privileges')
        privileges.push(email)
        objectPath.set(state, 'rows.' + row_index + '.privileges', privileges)
        const body = {
          resource: objectPath.get(state, 'rows.' + row_index),
          method: 'PUT',
          jwt: auth.gnap_jwt
        }
        await axios.post(window.location.origin + '/auth/gnapResource', body)
        const counter = Number(i) + 1
        $q.notify({
          message: counter + '/' + row_indexes.length + ': Privileges updated for ' + objectPath.get(state, 'rows.' + row_index + '.type'),
          color: 'primary',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const addUser = (origin) => {
      state.view = 'add'
      state.click_origin = origin
      updateValue('read,write,delete', 'access')
    }
    const calcUsers = () => {
      const users = []
      const options = []
      let i = 0
      for (const resource of state.rows) {
        for (const privilege of objectPath.get(resource, 'privileges')) {
          if (privilege.indexOf('@') > -1) {
            if (privilege !== state.user.email) {
              const found = users.findIndex((user) => user.email === privilege)
              if (found > -1) {
                const resources_arr = objectPath.get(users, found + '.resources')
                resources_arr.push(resource)
                objectPath.set(users, found + '.resources', resources_arr)
              } else {
                const user = {
                  email: privilege,
                  resources: [resource]
                }
                users.push(user)
              }
            }
          }
        }
        options.push({
          "value": i,
          "label": resource.type + " [" + resource.actions.join(', ') + "]"
        })
        i++
      }
      state.user_rows = users
      state.options = options
    }
    const clickPrivilege = async(row_index, value) => {
      const privileges = objectPath.get(state, 'rows.' + row_index + '.privileges')
      privileges.push(value)
      objectPath.set(state, 'rows.' + row_index + '.privileges', privileges)
      const body = {
        resource: objectPath.get(state, 'rows.' + row_index),
        method: 'PUT',
        jwt: auth.gnap_jwt
      }
      const a = await axios.post(window.location.origin + '/auth/gnapResource', body)
      if (objectPath.has(a, 'data')) {
        console.log('success')
        $q.notify({
          message: 'Privilege ' + value + ' added.',
          color: 'primary',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
      }
    }
    const onCancelAdd = () => {
      if (state.click_origin === '') {
        emit('close')
      } else {
        state.view = state.click_origin
        state.click_origin = ''
      }
    }
    const onSubmitAdd = async(values) => {
      const { email, access, restrict } = values
      if (access !== 'restrict') {
        const arr_access = access.split(',')
        await addAllResources(email, arr_access)
        const index = state.rows.findIndex((resource) => resource.type === 'App')
        const body = {
          method: 'POST',
          jwt: auth.gnap_jwt,
          to: email,
          from: state.user.display,
          from_email: state.user.email,
          access: arr_access,
          url: state.rows[index].locations[0]
        }
        await axios.post(window.location.origin + '/auth/gnapNotify', body)
      } else {
        if (restrict.length > 0) {
          await addResources(email, restrict)
          let message = state.user.display + ' (' + state.user.email + ') has invited you to the following health record and resources:<ul>'
          for (const restrict_index of restrict) {
            message += '<li>' + state.rows[restrict_index].type + '[' + state.rows[restrict_index].actions.join(', ') + '], <a href="' + state.rows[restrict_index].locations[0] + '" target="_blank">' + state.rows[restrict_index].locations[0] + '</a></li>'
          }
          message += '</ul>'
          const body = {
            method: 'POST',
            jwt: auth.gnap_jwt,
            to: email,
            from: state.user.display,
            from_email: state.user.email,
            title: 'HIE of One - Health Record Shared With You',
            previewtext: 'HIE of One - Health Record Shared With You',
            paragraphtext: btoa('<h3>' + state.user.display + ' shared a health record resources:</h3>' + message),
            paragraphtext2: '',
            link: '',
            buttonstyle: 'display:none',
            buttontext: ''
          }
          await axios.post(window.location.origin + '/auth/gnapMail', body)
        }
      }
      $q.notify({
        message: 'Email sent to ' + email,
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
      if (state.click_origin === '') {
        emit('close')
      } else {
        state.view = state.click_origin
        state.click_origin = ''
      }
      emit('qr')
    }
    const removeAllResources = async(email) => {
      emit('loading')
      for (const i in state.rows) {
        if (objectPath.get(state, 'rows.' + i + '.privileges').findIndex((item) => item === email) > -1) {
          const privileges = []
          for (const b of objectPath.get(state, 'rows.' + i + '.privileges')) {
            if (b !== email) {
              privileges.push(b)
            }
          }
          objectPath.set(state, 'rows.' + i + '.privileges', privileges);
          const body = {
            resource: objectPath.get(state, 'rows.' + i),
            method: 'PUT',
            jwt: auth.gnap_jwt
          }
          await axios.post(window.location.origin + '/auth/gnapResource', body)
        }
      }
      calcUsers()
      emit('loading')
      $q.notify({
        message: 'Privileges updated.',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
    }
    const removePrivilege = async(row_index, privilege_index) => {
      const privileges = objectPath.get(state, 'rows.' + row_index + '.privileges')
      const value = privileges[privilege_index]
      privileges.splice(privilege_index, 1)
      objectPath.set(state, 'rows.' + row_index + '.privileges', privileges)
      const body = {
        resource: objectPath.get(state, 'rows.' + row_index),
        method: 'PUT',
        jwt: auth.gnap_jwt
      }
      const a = await axios.post(window.location.origin + '/auth/gnapResource', body)
      if (objectPath.has(a, 'data')) {
        console.log('success')
        $q.notify({
          message: 'Privilege ' + value + ' removed.',
          color: 'primary',
          actions: [
            { label: 'Undo', color: 'white', handler: async() => {
              privileges.push(value)
              objectPath.set(state, 'rows.' + row_index + '.privileges', privileges)
              const body = {
                resource: objectPath.get(state, 'rows.' + row_index),
                method: 'PUT',
                jwt: auth.gnap_jwt
              }
              const b = await axios.post(window.location.origin + '/auth/gnapResource', body)
              if (objectPath.has(b, 'data')) {
                console.log('success')
              }
            } }
          ]
        })
      }
    }
    const removeResource = async(resource, email) => {
      const row_index = state.rows.findIndex((item) => objectPath.get(item, '_id') === resource._id)
      const privileges = objectPath.get(state, 'rows.' + row_index + '.privileges')
      const privilege_index = privileges.findIndex((item1) => item1 === email)
      await removePrivilege(row_index, privilege_index)
    }
    const updateValue = (val, field, type) => {
      state.formAdd[field] = val
      if (field !== 'restrict') {
        if (val === 'restrict') {
          state.schemaAdd.push({
            "id": "restrict",
            "label": "Select Resources for Access",
            "model": "restrict",
            "type": "select",
            "multiple": true,
            "options": state.options,
            "rules": "required"
          })
          const index = state.rows.findIndex((resource) => resource.type === 'App')
          updateValue([index], 'restrict')
        } else {
          if (objectPath.has(state, 'schemaAdd.2')) {
            objectPath.del(state, 'schemaAdd.2')
          }
        }
      }
    }
    const validate = (inputText) => {
      const emailRegex = new RegExp(/^[A-Za-z0-9_!#$%&'*+\/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/, "gm");
      return emailRegex.test(inputText);
    }
    return {
      addAllResources,
      addPrivilege,
      addResources,
      addUser,
      calcUsers,
      clickPrivilege,
      onCancelAdd,
      onSubmitAdd,
      removeAllResources,
      removePrivilege,
      removeResource,
      updateValue,
      validate,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
