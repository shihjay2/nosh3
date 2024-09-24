<template>
  <div class="q-pa-md q-gutter-md">
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
</template>

<script>
import { defineComponent, reactive, nextTick, onMounted } from 'vue'
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
  },
  emits: ['loading'],
  setup (props, { emit }) {
    const $q = useQuasar()
    const auth = useAuthStore()
    const state = reactive({
      user: {},
      rows: [],
      email_show: false,
      email_show_index: 0
    })
    onMounted(async() => {
      emit('loading')
      state.user = props.user
      const body = {email: state.user.email, filter: ''}
      const a = await axios.post(window.location.origin + '/auth/gnapResources', body)
      if (objectPath.has(a, 'data.0.ro')) {
        state.rows = objectPath.get(a, 'data')
        emit('loading')
      }
    })

    const addPrivilege = async(row_index) => {
      if (state.email_show && state.email !== '') {
        if (validate(addValue)) {
          const privileges = objectPath.get(state, 'rows.' + row_index + '.privileges')
          privileges.push(state.email)
          objectPath.set(state, 'rows.' + index + '.privileges', privileges)
          const body = {
            resource: objectPath.get(state, 'rows.' + index),
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

    const validate = (inputText) => {
      const emailRegex = new RegExp(/^[A-Za-z0-9_!#$%&'*+\/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/, "gm");
      return emailRegex.test(inputText);
    }

    return {
      addPrivilege,
      clickPrivilege,
      removePrivilege,
      validate,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
