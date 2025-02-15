<template>
  <q-menu fit auto-close>
    <q-list dense style="min-width: 120px">
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
      <q-item v-if="state.type == 'pnosh' && state.user.role == 'patient'" clickable @click="openShare()">
        <q-item-section>
          <q-item-label>Share</q-item-label>
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
      <q-item v-if="state.type == 'pnosh' && state.maia !== ''" clickable @click="openMAIA()">
        <q-item-section>
          <q-item-label>Launch MAIA</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="auto_awesome" />
        </q-item-section>
      </q-item>
      <q-item clickable @click="openDebug()">
        <q-item-section>
          <q-item-label>Debug</q-item-label>
        </q-item-section>
        <q-item-section avatar>
          <q-icon color="primary" style="font-size: 1.5em" name="developer_mode" />
        </q-item-section>
      </q-item>
      <q-item v-if="state.type == 'pnosh'">
        <q-item-section>
          <q-toggle v-model="state.stay_logged_in" label="Keep Me Logged In" color="primary" keep-color />
        </q-item-section>
        <q-item-section avatar>
          <q-btn flat round color="primary" icon="autorenew" @click="rotateJWT()">
            <q-tooltip>Renew Session</q-tooltip>
          </q-btn>
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
  emits: ['open-activities', 'open-debug', 'open-insurance', 'open-list', 'open-page', 'open-schedule', 'open-share', 'rotate-jwt', 'set-maia', 'stop-inbox-timer'],
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
    const openDebug = () => {
      emit('open-debug')
    }
    const openInsurance = () => {
      emit('open-insurance')
    }
    const openMAIA = () => {
      window.open(state.maia)
    }
    const openSchedule = () => {
      emit('open-schedule')
    }
    const openShare = () => {
      emit('open-share')
    }
    const rotateJWT = () => {
      emit('rotate-jwt')
    }
    return {
      logout,
      open,
      openActivity,
      openDebug,
      openInsurance,
      openMAIA,
      openSchedule,
      openShare,
      rotateJWT,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
