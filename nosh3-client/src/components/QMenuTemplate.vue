<template>
  <q-menu fit auto-close>
    <q-list style="min-width: 150px">
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
      <q-item clickable @click="openQRReader()">
        <q-item-section>
          <q-item-label>QR Code Reader</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="qr_code_scanner" />
        </q-item-section>
      </q-item>
      <q-item v-if="state.type == 'pnosh' && state.user.role == 'patient'" clickable @click="openShare()">
        <q-item-section>
          <q-item-label>Sharing</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="share" />
        </q-item-section>
      </q-item>
      <q-item v-if="state.type == 'pnosh' && state.user.role == 'patient'" clickable @click="openInsurance()">
        <q-item-section>
          <q-item-label>Insurance</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="account_balance" />
        </q-item-section>
      </q-item>
      <q-item v-if="state.patient !== ''" clickable @click="openActivity()">
        <q-item-section>
          <q-item-label>Activity</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="receipt_long" />
        </q-item-section>
      </q-item>
      <q-item clickable @click="setMAIA()">
        <q-item-section>
          <q-item-label>Set MAIA URL</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="link" />
        </q-item-section>
      </q-item>
      <q-item v-if="state.maia !== ''" clickable @click="openMAIA()">
        <q-item-section>
          <q-item-label>Launch MAIA</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="smart_toy" />
        </q-item-section>
      </q-item>
      <q-item v-if="state.type == 'pnosh'">
        <q-item-section>
          <q-toggle v-model="state.stay_logged_in" label="Keep Me Logged In" color="primary" keep-color />
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="autorenew" />
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
import { common } from '@/logic/common'
import { useAuthStore } from '@/stores'

export default defineComponent({
  name: 'QMenuTemplate',
  props: {
    user: Object,
    online: Boolean,
    patient: {
      type: String,
      default: ''
    },
    type: String
  },
  emits: ['open-activities', 'open-insurance', 'open-list', 'open-page', 'open-schedule', 'open-share', 'set-maia', 'stop-inbox-timer'],
  setup (props, { emit }) {
    const auth = useAuthStore()
    const { eventAdd } = common()
    const state = reactive({
      user: {},
      patient: '',
      type: '',
      maia: '',
      stay_logged_in: false
    })
    onMounted(() => {
      state.user = props.user
      state.patient = props.patient
      state.type = props.type
      state.stay_logged_in = auth.stay_logged_in
      if (auth.maia_alt !== null) {
        state.maia = auth.maia_alt + "?uri=" + encodeURIComponent(location.protocol + '//' + location.host + '/api/' + state.patient + '/Timeline')
      } else {
        if (auth.maia !== '') {
          state.maia = auth.maia + "?uri=" + encodeURIComponent(location.protocol + '//' + location.host + '/api/' + state.patient + '/Timeline')
        }
      }
    })
    watch(() => props.user, (newVal) => {
      if (newVal) {
        state.user = newVal
      }
    })
    watch(() => auth.maia_alt, (newVal) => {
      if (newVal !== null) {
        state.maia = auth.maia_alt + "?uri=" + encodeURIComponent(location.protocol + '//' + location.host + '/api/' + state.patient + '/Timeline')
      } else {
        state.maia = auth.maia + "?uri=" + encodeURIComponent(location.protocol + '//' + location.host + '/api/' + state.patient + '/Timeline')
      }
    })
    watch(() => state.stay_logged_in, (newVal) => {
      auth.setStayLoggedIn(newVal)
    })
    const logout = async() => {
      emit('stop-inbox-timer')
      if (props.patient !== '') {
        await eventAdd('Logged Out', props.patient)
      }
      return auth.logout()
    }
    const open = (type, resource, category='all', id) => {
      if (type == 'list') {
        emit('open-' + type, resource, category)
      } else {
        emit('open-' + type, id, resource, category)
      }
    }
    const openActivity = () => {
      emit('open-activities')
    }
    const openInsurance = () => {
      emit('open-insurance')
    }
    const openMAIA = () => {
      window.open(state.maia)
    }
    const openQRReader = () => {
      emit('open-qr-reader')
    }
    const openSchedule = () => {
      emit('open-schedule')
    }
    const openShare = () => {
      emit('open-share')
    }
    const setMAIA = () => {
      emit('set-maia')
    }
    return {
      logout,
      open,
      openActivity,
      openInsurance,
      openMAIA,
      openQRReader,
      openSchedule,
      openShare,
      setMAIA,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
