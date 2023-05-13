<template>
  <q-toolbar class="bg-grey-2 text-primary" inset>
    <q-btn-group push flat rounded>
        <q-btn icon="event" :label="getToday()" clickable>
          <q-popup-proxy ref="qDateProxy" transition-show="scale" transition-hide="scale">
            <q-date v-model="state.selectedDate" mask="YYYY-MM-DD">
              <div class="row items-center justify-end">
                <q-btn v-close-popup label="Close" flat round />
              </div>
            </q-date>
          </q-popup-proxy>
        </q-btn>
        <q-btn icon="navigate_before" clickable @click="onPrev()">
          <q-tooltip>Previous</q-tooltip>
        </q-btn>
        <q-btn icon="today" clickable @click="onToday()">
          <q-tooltip>Today</q-tooltip>
        </q-btn>
        <q-btn icon="navigate_next" clickable @click="onNext()">
          <q-tooltip>Next</q-tooltip>
        </q-btn>
      </q-btn-group>
      <q-btn-toggle
        v-model="state.view"
        flat
        rounded
        toggle-color="info"
        push
        :options="[
          {value: 'day', slot: 'day'},
          {value: 'week', slot: 'week'},
          {value: 'month', slot: 'month'}
        ]"
      >
      <template v-slot:day>
        <div class="row items-center no-wrap">
          <q-tooltip>Day</q-tooltip>
          <q-icon name="calendar_view_day" />
        </div>
      </template>
        <template v-slot:week>
          <div class="row items-center no-wrap">
            <q-tooltip>Week</q-tooltip>
            <q-icon name="calendar_view_week" />
          </div>
        </template>
        <template v-slot:month>
          <div class="row items-center no-wrap">
            <q-tooltip>Month</q-tooltip>
            <q-icon name="calendar_view_month" />
          </div>
        </template>
      </q-btn-toggle>
  </q-toolbar>
  <q-card>
    <q-card-section>
      <q-calendar-day
        v-if="state.view == 'day'"
        ref="calendar"
        v-model="state.selectedDate"
        view="day"
        short-weekday-label
        :weekdays="[0,1,2,3,4,5,6]"
        :interval-minutes="15"
        :interval-count="96"
        :interval-height="15"
        :date-header="state.dateHeader"
        :weekday-align="state.weekdayAlign"
        :date-align="state.dateAlign"
        animated
        bordered
        @change="onChange"
        @moved="onMoved"
        @click-date="onClickDate"
        @click-time="onClickTime"
        @click-interval="onClickInterval"
        @click-head-intervals="onClickHeadIntervals"
        @click-head-day="onClickHeadDay"
      >
        <template #day-body="{ scope: { timeStartPos, timeDurationHeight } }">
          <template
            v-for="event in state.eventsMapped"
            :key="event.id"
          >
            <q-badge
              v-if="event.time !== undefined"
              class="nosh-event"
              :class="badgeClasses(event, 'body')"
              :style="badgeStyles(event, 'body', timeStartPos, timeDurationHeight)"
              @click="onClickEvent(event)"
            >
              <div class="title q-calendar__ellipsis">
                <q-icon v-if="event.icon" :name="event.icon" class="q-mr-xs"></q-icon>
                {{ event.title }}
                <q-tooltip>{{ event.time + ' - ' + event.details }}</q-tooltip>
              </div>
            </q-badge>
          </template>
        </template>
        <template #day-container="{ scope: { days }}">
          <template v-if="hasDate(days)">
            <div class="day-view-current-time-indicator" :style="style()"></div>
            <div class="day-view-current-time-line" :style="style()"></div>
          </template>
        </template>
      </q-calendar-day>
      <q-calendar-day
        v-if="state.view == 'week'"
        ref="calendar"
        v-model="state.selectedDate"
        view="week"
        short-weekday-label
        :weekdays="[0,1,2,3,4,5,6]"
        :interval-minutes="15"
        :interval-count="96"
        :interval-height="15"
        :date-header="state.dateHeader"
        :weekday-align="state.weekdayAlign"
        :date-align="state.dateAlign"
        animated
        bordered
        @change="onChange"
        @moved="onMoved"
        @click-date="onClickDate"
        @click-time="onClickTime"
        @click-interval="onClickInterval"
        @click-head-intervals="onClickHeadIntervals"
        @click-head-day="onClickHeadDay"
      >
        <template #day-body="{ scope: { timeStartPos, timeDurationHeight } }">
          <template
            v-for="event in state.eventsMapped"
            :key="event.id"
          >
            <div
              v-if="event.time !== undefined"
              class="nosh-event"
              :class="badgeClasses(event, 'body')"
              :style="badgeStyles(event, 'body', timeStartPos, timeDurationHeight)"
              @click="onClickEvent(event)"
            >
              <span class="title q-calendar__ellipsis">
                {{ event.title }}
                <q-tooltip>{{ event.details }}</q-tooltip>
              </span>
            </div>
          </template>
        </template>
        <template #day-container="{ scope: { days }}">
          <template v-if="hasDate(days)">
            <div class="day-view-current-time-indicator" :style="style()"></div>
            <div class="day-view-current-time-line" :style="style()"></div>
          </template>
        </template>
      </q-calendar-day>
      <q-calendar-month
        v-if="state.view == 'month'"
        ref="calendar"
        v-model="state.selectedDate"
        :view="state.view"
        short-weekday-label
        :day-min-height="60"
        :day-height="0"
        animated
        bordered
        focusable
        hoverable
        @change="onChange"
        @moved="onMoved"
        @click-date="onClickDate"
        @click-time="onClickTime"
        @click-interval="onClickInterval"
        @click-head-intervals="onClickHeadIntervals"
        @click-head-day="onClickHeadDay"
      >
        <template #day="{ scope: { timeStartPos, timeDurationHeight } }">
          <template
            v-for="event in state.eventsMapped"
            :key="event.id"
          >
            <div
              v-if="event.time !== undefined"
              class="nosh-event"
              :class="badgeClasses(event, 'body')"
              :style="badgeStyles(event, 'body', timeStartPos, timeDurationHeight)"
              @click="onClickEvent(event)"
            >
              <span class="title q-calendar__ellipsis">
                {{ event.title }}
                <q-tooltip>{{ event.details }}</q-tooltip>
              </span>
            </div>
          </template>
        </template>
      </q-calendar-month>
    </q-card-section>
  </q-card>
  <q-dialog v-model="state.details" persistent position="top" full-width full-height seamless>
    <QFormTemplate
      v-if="state.details"
      @close-form="closeForm"
      @loading="loading"
      :auth="state.auth"
      :online="state.online"
      :couchdb="state.couchdb"
      :pin="state.pin"
      :id="state.id"
      :patient="state.patient"
      :provider="state.provider"
      :practitioner="state.practitioner"
      :encounter="state.encounter"
      :resource="state.resource"
      :category="state.formCategory"
      :index="state.formIndex"
      :default="state.default"
      :base="state.base"
      :schema="state.schema"
      :key="state.key"
      :sub_schema="state.sub_schema"
    />
  </q-dialog>
  <q-dialog v-model="state.tasks">
    <q-card>
      <q-btn v-if="state.statusEvent == 'booked'" flat push icon="check" color="info" clickable @click="changeStatus('checked-in')" label="Appointment Check-in" class="full-width" />
      <q-btn v-if="state.statusEvent == 'booked'" flat push icon="close" color="negative" clickable @click="changeStatus('cancelled')" label="Appointment Cancelled" class="full-width" />
      <q-btn v-if="state.statusEvent == 'booked'" flat push icon="close" color="warning" clickable @click="changeStatus('noshow')" label="Appointment No Showed" class="full-width" />
      <q-btn v-if="state.statusEvent == 'checked-in'" flat push icon="check" color="primary" clickable @click="changeStatus('fulfilled')" label="Appointment Start" class="full-width" />
      <q-btn flat push icon="edit" color="green" clickable @click="editEvent()" label="Edit Appointment Details" class="full-width" />
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, reactive, ref, nextTick, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores'
import { common } from '@/logic/common'
import { addToDate, parseTimestamp, isBetweenDates, today, parsed, parseDate, parseTime } from '@quasar/quasar-ui-qcalendar/src/Timestamp.js'
import { QCalendarDay } from '@quasar/quasar-ui-qcalendar/dist/QCalendarDay.esm.js'
import { QCalendarMonth } from '@quasar/quasar-ui-qcalendar/dist/QCalendarMonth.esm.js'
import { useQuasar } from 'quasar'
import Case from 'case'
import moment from 'moment'
import objectPath from 'object-path'
import PouchDB from 'pouchdb-browser'
import PouchDBFind from 'pouchdb-find'
import QFormTemplate from './QFormTemplate.vue'
import '@quasar/quasar-ui-qcalendar/src/QCalendarVariables.sass'
import '@quasar/quasar-ui-qcalendar/src/QCalendarTransitions.sass'
import '@quasar/quasar-ui-qcalendar/src/QCalendarDay.sass'
import '@quasar/quasar-ui-qcalendar/src/QCalendarMonth.sass'
PouchDB.plugin(PouchDBFind)

export default defineComponent({
  name: 'QScheduleTemplate',
  props: {
    auth: Object,
    online: Boolean,
    couchdb: String,
    pin: String,
    encounter: String,
    patient: String,
    resource: String,
    provider: Boolean,
    service_types: Array,
    service_categories: Array,
    type: String
  },
  components: {
    QCalendarDay,
    QCalendarMonth,
    QFormTemplate
  },
  emits: ['close-container', 'loading', 'open-form', 'reload-drawer', 'update-toolbar' ],
  setup(props, { emit }) {
    const $q = useQuasar()
    const { addSchemaOptions, loadSelect, removeTags, sync } = common()
    const calendar = ref(null)
    const state = reactive({
      view: 'day',
      selectedDate: today(),
      currentTimeStamp: {},
      currentDate: '',
      currentTime: '',
      timeStartPos: '',
      dateAlign: 'center',
      weekdayAlign: 'center',
      dateHeader: 'stacked',
      events: [],
      eventsMapped: [],
      // form
      tasks: false,
      details: false,
      id: 'add',
      patient: '',
      provider: false,
      practitioner: '',
      encounter: '',
      resource: 'appointments',
      formCategory: 'all',
      formIndex: '',
      default: {},
      chosenEvent: {},
      statusEvent: '',
      // forms
      base: {},
      schema: {},
      key: '',
      sub_schema: {},
      fhir: {},
      auth: {},
      online: true,
      couchdb: '',
      pin: ''
    })
    const auth = useAuthStore()
    var prefix = ''
    if (auth.instance === 'digitalocean' && auth.type === 'pnosh') {
      prefix = auth.patient + '_'
    }
    var localDB = new PouchDB(prefix + props.resource)
    onMounted(async() => {
      state.base = await import('@/assets/fhir/' + props.resource + '.json')
      state.data = props.data
      state.patient = props.patient
      state.resource = props.resource
      state.provider = props.provider
      state.auth = props.auth
      state.online = props.online
      state.couchdb = props.couchdb
      state.pin = props.pin
      state.events = []
      adjustCurrentTime()
    })
    watch(() => state.view, (newVal) => {
      console.log(newVal)
    })
    const adjustCurrentTime = () => {
      const now = parseDate(new Date())
      state.currentDate = now.date
      state.currentTime = now.time
      state.timeStartPos = calendar.value.timeStartPos(state.currentTime, false)
    }
    const badgeClasses = (event, type) => {
      const isHeader = type === 'header'
      return {
        [ `text-white bg-${ event.bgcolor }` ]: true,
        'full-width': !isHeader && (!event.side || event.side === 'full'),
        'left-side': !isHeader && event.side === 'left',
        'right-side': !isHeader && event.side === 'right',
        'rounded-border': true
      }
    }
    const badgeStyles = (event, type, timeStartPos = undefined, timeDurationHeight = undefined) => {
      const s = {}
      if (timeStartPos && timeDurationHeight) {
        s.top = timeStartPos(event.time) + 'px'
        s.height = timeDurationHeight(event.duration) + 'px'
      }
      s['align-items'] = 'flex-start'
      return s
    }
    const changeStatus = async(status) => {
      var doc = await localDB.get(state.chosenEvent.id)
      objectPath.set(state, 'fhir', doc)
      objectPath.set(state, 'fhir.status', status)
      emit('loading')
      await sync(props.resource, false, props.patient, true, state.fhir)
      emit('loading')
      $q.notify({
        message: 'Appointment status changed to ' + Case.title(status) + '!',
        color: 'primary',
        actions: [
          { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
        ]
      })
      state.tasks = false
      if (status == 'fulfilled') {
        // create encounter
        const defaults = {}
        var userDB = new PouchDB(prefix + 'users')
        var result = await userDB.find({
          selector: {'reference': {$eq: state.fhir.participant[1].actor[0].reference }, _id: {"$gte": null}}
        })
        if (result.docs.length > 0) {
          objectPath.set(defaults, 'class', result.docs[0].defaults.class)
          objectPath.set(defaults, 'type', result.docs[0].defaults.type)
        }
        objectPath.set(defaults, 'serviceType', state.fhir.serviceType[0].coding[0].code)
        objectPath.set(defaults, 'participant', state.fhir.participant[1].actor[0].reference)
        objectPath.set(defaults, 'reasonCode', state.fhir.reasonCode[0].text)
        objectPath.set(defaults, 'periodStart', moment(state.fhir.start).format('YYYY-MM-DD'))
        emit('open-form', 'add', 'encounters', 'new', '', defaults)
      } else {
        await getEvents(state.currentTimeStamp)
      }
    }
    const closeForm = async() => {
      state.id = 'add'
      state.details = false
      await getEvents(state.currentTimeStamp)
    }
    const editEvent = () => {
      state.id = state.chosenEvent.id
      console.log(state.chosenEvent.status)
      openForm()
    }
    const eventsMap = () => {
      const map = {}
      state.events.forEach(event => {
        if (!map[ event.date ]) {
          map[ event.date ] = []
        }
        map[ event.date ].push(event)
        if (event.days) {
          let timestamp = parseTimestamp(event.date)
          let days = event.days
          do {
            timestamp = addToDate(timestamp, { day: 1 })
            if (!map[ timestamp.date ]) {
              map[ timestamp.date ] = []
            }
            map[ timestamp.date ].push(event)
          } while (--days > 0)
        }
      })
      return map
    }
    const getCurrentDay = (day) => {
      const newDay = new Date()
      newDay.setDate(day)
      const tm = parseDate(newDay)
      return tm.date
    }
    const getDuration = (a, b) => {
      var c = moment(b)
      var d = moment(a)
      return c.diff(d, 'minutes')
    }
    const getEvents = async(dt) => {
      // pull events from specific day from PouchDB
      state.eventsMapped = []
      var start = moment(dt).format('YYYY-MM-DD HH:mm')
      var end = moment(dt).add(1, 'd').format('YYYY-MM-DD HH:mm')
      var result = await localDB.find({
        selector: {
          $and: [
            { start: {$gte: start}},
            { start: {$lt: end} }
          ]
        }
      })
      if (result.docs.length > 0) {
        for (var a in result.docs) {
          var b = {
            id: result.docs[a].id,
            title: getTitle(result.docs[a].participant),
            details: result.docs[a].reasonCode[0].text,
            date: moment(result.docs[a].start).format('YYYY-MM-DD'),
            time: moment(result.docs[a].start).format('HH:mm'),
            duration: getDuration(result.docs[a].start, result.docs[a].end),
            bgcolor: 'teal',
            icon: 'fas fa-user-injured',
            status: result.docs[a].status
          }
          for (var c in state.base.types) {
            if (state.base.types[c].codes.includes(result.docs[a].serviceType[0].coding[0].code)) {
              b.bgcolor = state.base.types[c].color
              b.icon = 'fas fa-' + state.base.types[c].icon
            }
          }
          state.events.push(b)
        }
      }
      const map = eventsMap()
      const events = map[ dt ] || []
      if (events.length > 0) {
        if (events.length === 1) {
          events[0].side = 'full'
        } else {
          // check if the two events overlap and if so, select
          // left or right side alignment to prevent overlap
          const startTime = addToDate(parsed(events[0].date), { minute: parseTime(events[0].time) })
          const endTime = addToDate(startTime, { minute: events[0].duration })
          const startTime2 = addToDate(parsed(events[1].date), { minute: parseTime(events[1].time) })
          const endTime2 = addToDate(startTime2, { minute: events[1].duration })
          if (isBetweenDates(startTime2, startTime, endTime, true) || isBetweenDates(endTime2, startTime, endTime, true)) {
            events[0].side = 'left'
            events[1].side = 'right'
          } else {
            events[0].side = 'full'
            events[1].side = 'full'
          }
        }
        console.log(state.eventsMapped)
        state.eventsMapped = events
        console.log(state.eventsMapped)
      }
    }
    const getTitle = (data) => {
      for (var a in data) {
        var b = data[a].actor[0].reference.split('/')
        if (b[0] == 'Patient' && props.provider == true) {
          return data[a].actor[0].display
        }
        if (b[0] == 'Practitioner' && props.provider !== true) {
          return data[a].actor[0].display
        }
      }
    }
    const getToday = () => {
      return moment(state.selectedDate).format('dddd, MMMM Do YYYY')
    }
    const hasDate = (days) => {
      return state.currentDate
        ? days.find(day => day.date === state.currentDate)
        : false
    }
    const loading = () => {
      emit('loading')
    }
    const onChange = async(data) => {
      state.currentTimeStamp = data.start
      await getEvents(data.start)
    }
    const onClickDate = (data) => {
      console.log(data)
    }
    const onClickEvent = (event) => {
      state.chosenEvent = event
      state.statusEvent = event.status
      state.tasks = true
    }
    const onClickHeadDay = (data) => {
      console.log(data)
    }
    const onClickHeadIntervals = (data) => {
      console.log(data)
    }
    const onClickInterval = (data) => {
      console.log(data)
    }
    const onClickTime = (data) => {
      console.log(data)
      // set appointment here
      state.default.start = round(moment(data.scope.timestamp.date + ' ' + data.scope.timestamp.time, 'YYYY-MM-DD HH:mm'), 15, 'minutes')
      state.id = 'add'
      openForm()
    }
    const onMoved = (data) => {
      console.log(data)
    }
    const onNext = () => {
      calendar.value.next()
    }
    const onPrev = () => {
      calendar.value.prev()
    }
    const onToday = () => {
      calendar.value.moveToToday()
    }
    const openForm = async() => {
      state.schema = state.base.uiSchema
      state.schema = addSchemaOptions('serviceType', props.service_types, 'Code', 'Display', state.schema)
      state.schema = await loadSelect('patients', 'patient', state.schema)
      state.schema = await loadSelect('practitioners', 'practitioner', state.schema)
      state.schema = addSchemaOptions('serviceCategory', props.service_categories, 'Code', 'Display', state.schema)
      await nextTick()
      state.details = true
      state.tasks = false
    }
    const round = (date, interval, unit) => {
      const duration = moment.duration(interval, unit)
      const comp = interval/2
      if (date.format('m') < comp) {
        return moment(Math.floor((+date) / (+duration)) * (+duration)).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      } else {
        return moment(Math.ceil((+date) / (+duration)) * (+duration)).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      }
    }
    const scrollToEvent = (event) => {
      calendar.value.scrollToTime(event.time, 350)
    }
    const style = () => {
      return {
        top: state.timeStartPos + 'px'
      }
    }
    return {
      addSchemaOptions,
      adjustCurrentTime,
      badgeClasses,
      badgeStyles,
      changeStatus,
      closeForm,
      editEvent,
      eventsMap,
      getCurrentDay,
      getDuration,
      getEvents,
      getTitle,
      getToday,
      hasDate,
      loading,
      loadSelect,
      onChange,
      onClickDate,
      onClickEvent,
      onClickHeadDay,
      onClickHeadIntervals,
      onClickInterval,
      onClickTime,
      onMoved,
      onNext,
      onPrev,
      onToday,
      openForm,
      removeTags,
      round,
      scrollToEvent,
      style,
      sync,
      state,
      calendar
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style src="@quasar/quasar-ui-qcalendar/dist/QCalendarDay.min.css"></style>
<style src="@quasar/quasar-ui-qcalendar/dist/QCalendarMonth.min.css"></style>
<style scoped lang="sass">
.day-view-current-time-indicator
  position: absolute
  left: -5px
  height: 10px
  width: 10px
  margin-top: -4px
  background-color: rgba(0, 0, 255, .5)
  border-radius: 50%

.day-view-current-time-line
  position: absolute
  left: 5px
  border-top: rgba(0, 0, 255, .5) 2px solid
  width: calc(100% - 5px)

.nosh-event
  position: absolute
  font-size: 12px
  justify-content: center
  margin: 0 1px
  text-overflow: ellipsis
  overflow: hidden
  cursor: pointer

.title
  position: relative
  display: flex
  justify-content: center
  align-items: center
  height: 100%

.text-white
  color: white

.bg-blue
  background: blue

.bg-green
  background: green

.bg-orange
  background: orange

.bg-red
  background: red

.bg-teal
  background: teal

.bg-grey
  background: grey

.bg-purple
  background: purple

.full-width
  left: 0
  width: calc(100% - 2px)

.left-side
  left: 0
  width: calc(50% - 3px)

.right-side
  left: 50%
  width: calc(50% - 3px)

.rounded-border
  border-radius: 2px
</style>
