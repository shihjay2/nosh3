<template>
  <q-menu fit auto-close>
    <q-list style="min-width: 100px">
      <q-item clickable @click="open('page', 'users', 'me', state.user.id)">
        <q-item-section>
          <q-item-label>{{ state.user.display }}</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="settings" />
        </q-item-section>
      </q-item>
      <q-item clickable @click="open('list', 'practitioners', 'all', '')">
        <q-item-section>
          <q-item-label>Practitioners</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="masks" />
        </q-item-section>
      </q-item>
      <q-item clickable @click="open('list', 'users', 'all', '')">
        <q-item-section>
          <q-item-label>Users</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="group" />
        </q-item-section>
      </q-item>
      <q-item clickable @click="openSchedule()">
        <q-item-section>
          <q-item-label>Schedule</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="calendar_today" />
        </q-item-section>
      </q-item>
      <q-item clickable @click="openQR()">
        <q-item-section>
          <q-item-label>Share Health Record</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="qr_code_2" />
        </q-item-section>
      </q-item>
      <q-item>
        <q-item-section>
          <q-item-label>Trustee Policies</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="policy" />
        </q-item-section>
      </q-item>
      <q-item clickable @click="logout()">
        <q-item-section>
          <q-item-label>Logout</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="logout" />
        </q-item-section>
      </q-item>
    </q-list>
  </q-menu>
</template>

<script>
import { defineComponent, onMounted, reactive, watch } from 'vue'
import { useAuthStore } from '@/stores'

export default defineComponent({
  name: 'QMenuTemplate',
  props: {
    user: Object
  },
  emits: ['open-list', 'open-page', 'open-qr', 'open-schedule', 'stop-inbox-timer'],
  setup (props, { emit }) {
    const auth = useAuthStore()
    const state = reactive({
      user: {}
    })
    onMounted(() => {
      state.user = props.user
    })
    watch(() => props.user, (newVal) => {
      if (newVal) {
        state.user = newVal
      }
    })
    const logout = () => {
      emit('stop-inbox-timer')
      return auth.logout()
    }
    const open = (type, resource, category='all', id) => {
      if (type == 'list') {
        emit('open-' + type, resource, category)
      } else {
        emit('open-' + type, id, resource, category)
      }
    }
    const openQR = () => {
      emit('open-qr', window.location.href)
    }
    const openSchedule = () => {
      emit('open-schedule')
    }
    return {
      logout,
      open,
      openQR,
      openSchedule,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
