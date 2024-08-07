<template>
  <q-menu fit auto-close>
    <q-list dense style="min-width: 100px">
      <q-item dense clickable @click="open('page', 'users', 'me', state.user.id)">
        <q-item-section>
          <q-item-label>{{ state.user.display }}</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="settings" />
        </q-item-section>
      </q-item>
      <q-item dense clickable @click="open('list', 'practitioners', 'all', '')">
        <q-item-section>
          <q-item-label>Practitioners</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="masks" />
        </q-item-section>
      </q-item>
      <q-item dense clickable @click="open('list', 'users', 'all', '')">
        <q-item-section>
          <q-item-label>Users</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="group" />
        </q-item-section>
      </q-item>
      <q-item dense clickable @click="openSchedule()">
        <q-item-section>
          <q-item-label>Schedule</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="calendar_today" />
        </q-item-section>
      </q-item>
      <q-item dense clickable @click="openQRReader()">
        <q-item-section>
          <q-item-label>QR Code Reader for Prescriptions and Orders</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="qr_code_scanner" />
        </q-item-section>
      </q-item>
      <q-item dense clickable @click="openQR()">
        <q-item-section>
          <q-item-label>Health Record Access QR Code</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="qr_code_2" />
        </q-item-section>
      </q-item>
      <q-item v-if="state.type == 'pnosh' && state.user.role == 'patient'" dense clickable @click="openShare()">
        <q-item-section>
          <q-item-label>Sharing</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="share" />
        </q-item-section>
      </q-item>
      <q-item v-if="state.patient !== ''" dense clickable @click="openActivity()">
        <q-item-section>
          <q-item-label>Activity</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="receipt_long" />
        </q-item-section>
      </q-item>
      <q-item v-if="state.maia !== ''" dense clickable @click="openMAIA()">
        <q-item-section>
          <q-item-label>Launch MAIA</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="smart_toy" />
        </q-item-section>
      </q-item>
      <q-item dense clickable @click="logout()">
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
  emits: ['open-activities', 'open-list', 'open-page', 'open-qr', 'open-schedule', 'open-share', 'stop-inbox-timer'],
  setup (props, { emit }) {
    const auth = useAuthStore()
    const { eventAdd } = common()
    const state = reactive({
      user: {},
      patient: '',
      type: '',
      maia: ''
    })
    onMounted(() => {
      state.user = props.user
      state.patient = props.patient
      state.type = props.type
      if (auth.maia !== '') {
        state.maia = auth.maia + "?uri=" + encodeURIComponent(location.protocol + '//' + location.host + '/api/' + state.patient + '/Timeline')
      }
    })
    watch(() => props.user, (newVal) => {
      if (newVal) {
        state.user = newVal
      }
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
    const openMAIA = () => {
      window.open(state.maia)
    }
    const openQR = () => {
      emit('open-qr', window.location.href)
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
    return {
      logout,
      open,
      openActivity,
      openMAIA,
      openQR,
      openQRReader,
      openSchedule,
      openShare,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
