<template>
  <div v-if="state.view === 'resource'" class="q-pa-md q-gutter-md">
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
      <q-list bordered class="rounded-borders">
        <q-expansion-item
          v-for="(row4, index4) in state.user_rows" :key="index4"
          expand-separator
          icon="account_circle"
          :label="row4.email"
        >
          <q-list>
            <q-item v-for="(row5, index5) in row4.resources" :key="index5">
              <q-item-section avatar>
                <div class="row">
                  <div class="col">
                    <q-icon color="primary" name="folder" />
                  </div>
                  <div class="col-8">
                    <q-chip v-for="(action1, index6) in row5.actions" :key="index6" dense>
                      <q-avatar v-if="action1 === 'read'" icon="visibility" class="q-pr-sm"></q-avatar>
                      <q-avatar v-if="action1 === 'write'" icon="edit" class="q-pr-sm"></q-avatar>
                      <q-avatar v-if="action1 === 'delete'" icon="delete" class="q-pr-sm"></q-avatar>
                      <q-tooltip>{{ action1 }}</q-tooltip>
                    </q-chip>
                  </div>
                </div>
              </q-item-section>
              <q-item-section>
                {{ row5.type }}
              </q-item-section>
              <q-item-section side>
                <q-btn flat round color="red" icon="delete" clickable @click="removeResource(row5, row4.email)">
                  <q-tooltip>Delete</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
          <q-btn color="positive" class="full-width" icon="add" label="Read, Write, and Delete for All Resources" clickable @click="addAllResources(row4.email, ['read', 'write', 'delete'])" />
          <q-btn color="primary" class="full-width" icon="add" label="Read Only for All Resources" clickable @click="addAllResources(row4.email, ['read'])" />
          <q-btn color="negative" class="full-width" icon="close" label="Remove Access to All Resources" clickable @click="removeAllResources(row4.email)" />
        </q-expansion-item>
      </q-list>
    </q-card>
  </div>
</template>

<script>
import { defineComponent, reactive, onMounted } from 'vue'
import axios from 'axios'
import objectPath from 'object-path'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import { useQuasar } from 'quasar'
import { useAuthStore } from '@/stores'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'QTrusteeTemplate',
  components: {
  },
  props: {
    user: Object,
    view: String
  },
  emits: ['loading'],
  setup (props, { emit }) {
    const $q = useQuasar()
    const auth = useAuthStore()
    const state = reactive({
      user: {},
      view: '',
      rows: [],
      user_rows: [],
      email_show: false,
      email_show_index: 0
    })
    onMounted(async() => {
      emit('loading')
      state.user = props.user
      state.view = props.view
      const body = {email: state.user.email, filter: ''}
      const a = await axios.post(window.location.origin + '/auth/gnapResources', body)
      if (objectPath.has(a, 'data.0.ro')) {
        state.rows = objectPath.get(a, 'data')
        const users = []
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
        }
        state.user_rows = users
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
          }
        }
      }
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
    const removeAllResources = async(email) => {
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
    const validate = (inputText) => {
      const emailRegex = new RegExp(/^[A-Za-z0-9_!#$%&'*+\/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/, "gm");
      return emailRegex.test(inputText);
    }
    return {
      addAllResources,
      addPrivilege,
      clickPrivilege,
      removeAllResources,
      removePrivilege,
      removeResource,
      validate,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
