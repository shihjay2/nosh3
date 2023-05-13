<template>
  <q-card v-if="state.viewer">
    <q-card-section class="bg-grey-3">
      <div class="q-pa-sm q-gutter-sm">
        <div class="row">
          <q-btn-group push>
            <q-btn push color="primary" icon="edit" clickable @click="editImage()">
              <q-tooltip>Edit</q-tooltip>
            </q-btn>
            <q-btn v-if="state.change" push color="positive" icon="visibility" clickable @click="showFHIR()">
              <q-tooltip>FHIR</q-tooltip>
            </q-btn>
            <q-btn v-if="state.change" push color="warning" icon="change_circle" clickable @click="changeImage()">
              <q-tooltip>Change</q-tooltip>
            </q-btn>
            <q-btn v-if="state.change" push color="negative" icon="delete" clickable @click="changeImage('remove')">
              <q-tooltip>Remove</q-tooltip>
            </q-btn>
          </q-btn-group>
        </div>
      </div>
    </q-card-section>
    <q-card-section>
      <q-img :src="state.data" spinner-color="white" fit="fill" position="0 0"/>
    </q-card-section>
  </q-card>
  <PDFDocument
    v-if="state.pdfViewer"
    :pdf="state.data"
    :page="state.page"
    @pdf-loaded="onPdfLoaded"
    @number-of-pages="onPdfNumberOfPages"
    @page-loaded="onPdfPageLoaded"
    @edit-pdf="onEditPdf"
    @save-pdf="onSavePdf"
  />
  <q-stepper
    v-if="state.add"
    v-model="state.step"
    vertical
    color="primary"
    animated
    @before-transition="stopVideo"
  >
    <q-step
      :name="1"
      title="Get file"
      icon="download"
      :done="state.step > 2"
    >
      <div class="row q-gutter-sm">
        <q-uploader
          :hide-upload-btn="true"
          @added="addedFn"
          :accept="state.accept"
        />
      </div>
      <q-stepper-navigation>
        <q-btn @click="state.step = 2" color="primary" label="Get snapshot instead" />
      </q-stepper-navigation>
    </q-step>
    <q-step
      :name="2"
      title="Get snapshot"
      caption="Optional"
      icon="camera"
      :done="state.step > 2"
    >
      <q-card>
        <q-card-section>
          <div class="q-pa-sm q-gutter-sm">
            <video autoplay style="display:none;width: 100% !important;height: auto !important;"></video>
            <img v-if="state.cameraImg" src="" id="camera_img" style="width: 100% !important;height: auto !important;" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <div class="q-pa-sm q-gutter-sm">
            <q-btn push icon="camera" color="red" :disable="state.captureVideoDisable" @click="captureVideo()">
              <q-tooltip>Capture</q-tooltip>
            </q-btn>
            <q-btn push icon="repeat" color="green" @click="startVideo()">
              <q-tooltip>Retake</q-tooltip>
            </q-btn>
            <q-btn push icon="save" color="primary" @click="saveVideo()">
              <q-tooltip>Save</q-tooltip>
            </q-btn>
          </div>
        </q-card-actions>
      </q-card>
      <q-stepper-navigation>
        <q-btn @click="state.step = 1" color="primary" label="Get file instead" />
      </q-stepper-navigation>
    </q-step>
  </q-stepper>
  <q-dialog v-model="state.view" persistent position="top" full-width full-height seamless>
    <PDFDocument
      :pdf="state.pdf"
      :page="state.page"
      @pdf-loaded="onPdfLoaded"
      @number-of-pages="onPdfNumberOfPages"
      @page-loaded="onPdfPageLoaded"
      @edit-pdf="onEditPdf"
      @save-pdf="onSavePdf"
    />
  </q-dialog>
  <q-dialog v-model="state.edit" persistent position="top" full-width full-height seamless>
    <TuiImageEditor
      v-if="state.edit"
      :options="state.options"
      :image="state.image"
      @add-text="onAddText"
      @mousedown="onMousedown"
      @object-activated="onObjectActivated"
      @object-added="onObjectAdded"
      @object-moved="onObjectMoved"
      @object-scaled="onObjectScaled"
      @redo-stack-changed="onRedoStackChanged"
      @text-editing="onTextEditing"
      @undo-stack-changed="onUndoStackChanged"
      @on-save="onSave"
      @on-cancel="onCancel"
    />
  </q-dialog>
  <q-dialog v-model="state.details" persistent position="top" full-width full-height seamless>
    <QFormTemplate
      v-if="state.details"
      @close-form="closeForm"
      @loading="loading"
      @reload-drawer="reloadDrawer"
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
    />
  </q-dialog>
  <q-dialog v-model="state.showPreview" persistent position="top" full-width full-height seamless>
    <q-card>
      <q-card-section>
        <textarea id="fhirpreview" v-model="state.fhir1" rows="20" cols="80" class="bg-grey-9 text-white"></textarea>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <div class="q-pa-sm q-gutter-sm">
          <q-btn push icon="cancel" color="red" @click="closeFHIR" label="Close" />
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, nextTick, reactive, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores'
import { useQuasar } from 'quasar'
import { common } from '@/logic/common'
import jsPDF from 'jspdf'
import moment from 'moment'
import objectPath from 'object-path'
import PouchDB from 'pouchdb-browser'
import QFormTemplate from './QFormTemplate.vue'
import TuiImageEditor from './TuiImageEditor.vue'
import PDFDocument from './PDFDocument.vue'
import {v4 as uuidv4} from 'uuid'

export default defineComponent({
  name: 'QFileTemplate',
  components: {
    TuiImageEditor,
    QFormTemplate,
    PDFDocument
  },
  props: {
    auth: Object,
    online: Boolean,
    couchdb: String,
    pin: String,
    resource: String,
    category: String,
    id: String,
    patient: String,
    encounter: String,
    openDetail: Boolean,
    doc_class_codes: Array,
    doc_type_codes: Array
  },
  emits: ['update-toolbar', 'loading', 'reload-drawer', 'open-detail-complete', 'close-container'],
  setup(props, { emit }) {
    const $q = useQuasar()
    const { addSchemaOptions, sync } = common()
    const state = reactive({
      fhir: {},
      fhir1: {},
      index: '',
      model: '',
      category: '',
      subcategory: '',
      data: '',
      change: false,
      accept: 'image/*,.pdf',
      step: 1,
      viewer: false,
      pdfViewer: false,
      add: false,
      loading: true,
      sending: false,
      page_limit: '',
      showPreview: false,
      // editor
      edit: false,
      options: {
        cssMaxWidth: 1000,
        cssMaxHeight: 1000
      },
      image: {},
      // camera
      cameraOptions: {
        video: true
      },
      camera: true,
      cameraImg: true,
      startVideoDisable: false,
      captureVideoDisable: true,
      dataVideo: '',
      // pdf editor
      editPdf: false,
      view: false,
      pdf: '',
      page: 1,
      totalPage: null,
      pagePng: {},
      // details
      details: false,
      detailsPending: false,
      id: '',
      provider: '',
      practitioner: '',
      resource: '',
      patient: '',
      encounter: '',
      formCategory: '',
      formIndex: '',
      default: {},
      // forms
      base: {},
      schema: {},
      docTypeCodes: [],
      docClassCodes: [],
      // db
      auth: {},
      couchdb: '',
      pin: ''
    })
    var video
    var img
    const auth = useAuthStore()
    var prefix = ''
    if (auth.instance === 'digitalocean' && auth.type === 'pnosh') {
      prefix = auth.patient + '_'
    }
    var localDB = new PouchDB(prefix + props.resource)
    onMounted(async() => {
      state.auth = props.auth
      state.online = props.online
      state.couchdb = props.couchdb
      state.pin = props.pin
      state.base = await import('@/assets/fhir/' + props.resource + '.json')
      if (props.category == 'photo') {
        state.accept = "image/*"
        state.change = true
        state.category = props.category
      }
      if (props.resource == 'document_references') {
        state.category = 'content'
        state.subcategory = 'attachment'
        state.resource = props.resource
        state.formCategory = 'all'
      }
      if (props.id == 'add') {
        state.fhir = state.base.fhir
        state.fhir.id = 'nosh_' + uuidv4()
        state.fhir._id = state.fhir.id
        // default patient
        state.fhir.subject.reference = 'Patient/' + props.patient
        // default encounter
        if (props.encounter !== '') {
          objectPath.set(state, 'fhir.context.encounter.reference', 'Encounter/' + props.encounter)
        }
        state.model = state.category + '.0'
        if (state.subcategory !== '') {
          state.model += '.' + state.subcategory
        }
        if (typeof state.base.defaultDate !== 'undefined') {
          for (var a in state.base.defaultDate) {
            var uiSchema = state.base.uiSchema.flat()
            for (var b in uiSchema) {
              if (uiSchema[b].id == state.base.defaultDate[a].id) {
                objectPath.set(state, 'fhir.' + uiSchema[b].model, moment().format(state.base.defaultDate[a].format))
              }
            }
          }
        }
        objectPath.set(state, 'fhir.' + state.base.activeField, 'current')
        state.fhir1 = JSON.stringify(state.fhir, null, "  ")
        state.detailsPending = true
        state.id = state.fhir.id
        state.viewer = false
        state.add = true
      } else {
        state.id = props.id
        var doc = await localDB.get(props.id)
        objectPath.set(state, 'fhir', doc)
        state.fhir1 = JSON.stringify(state.fhir, null, "  ")
        state.index = getIndex()
        state.model = state.category + '.' + state.index
        if (state.subcategory !== '') {
          state.model += '.' + state.subcategory
        }
        if (props.resource === 'patients') {
          state.model = state.category + '.0'
        }
        if (state.index == 0) {
          // new file
          state.viewer = false
          state.add = true
        } else {
          // existing file
          var c = state.category + '.0'
          if (state.subcategory !== '') {
            c += '.' + state.subcategory
          }
          var contentType = objectPath.get(state, 'fhir.' + c + '.contentType')
          if (contentType == 'application/pdf') {
            state.pdfViewer = true
          } else {
            state.viewer = true
          }
          state.data = 'data:' + contentType + ';base64,' + objectPath.get(state, 'fhir.' + c + '.data')
        }
      }
    })
    watch(() => props.openDetail, (newVal) => {
      if (newVal) {
        openForm()
        emit('open-detail-complete')
      }
    })
    watch(() => state.step, async(newVal) => {
      if (newVal === 2) {
        await nextTick()
        startVideo()
      }
    })
    const addedFn = (files) => {
      for (var i in files) {
        getBase64(files[i]).then(data => {
          objectPath.set(state, 'fhir.' + state.model + '.contentType', data.substr(data.indexOf(':') + 1, data.indexOf(';') - data.indexOf(':') - 1))
          objectPath.set(state, 'fhir.' + state.model + '.data', data.substr(data.indexOf(',') + 1))
          state.fhir1 = JSON.stringify(state.fhir, null, "  ")
          var contentType = objectPath.get(state, 'fhir.' + state.model + '.contentType')
          if (contentType == 'application/pdf') {
            state.pdf = data
            state.editPdf = true
            state.view = true
            emit('update-toolbar', {type: 'file', resource: props.resource, category: props.category, action: 'PDF Editor'})
          }
          if (contentType == 'image/jpeg' || contentType == 'image/gif' || contentType == 'image/png' || contentType == 'image/bmp' || contentType == 'image/tiff') {
            state.image.data = data
            state.image.name = files[i].name
            state.edit = true
            emit('update-toolbar', {type: 'file', resource: props.resource, category: props.category, action: 'Image Editor'})
          }
        }).catch((e) => {
          console.log(e)
          $q.notify({
            message: 'Failed to convert file',
            color: 'red'
          })
        })
      }
    }
    const captureVideo = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      img.src = canvas.toDataURL('image/png')
      state.dataVideo = img.src
      img.style.display = "block"
      video.style.display = "none"
    }
    const changeImage = async(type) => {
      if (type == 'remove') {
        objectPath.del(state, 'fhir.' + state.category)
        state.fhir1 = JSON.stringify(state.fhir, null, "  ")
        await sync(props.resource, false, props.patient, true, state.fhir)
        var doc = await localDB.get(props.id)
        objectPath.set(state, 'fhir', doc)
        $q.notify({
          message: 'The image was removed!',
          color: 'primary',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
        emit('reload-drawer', props.resource)
      }
      state.viewer = false
      state.add = true
    }
    const closeFHIR = () => {
      state.showPreview = false
    }
    const closeForm = (id='') => {
      state.details = false
      state.toolbarTitle = state.toolbarTitleLast
      if (state.detailsPending == true) {
        if (id !== '') {
          state.detailsPending = false
          onSave(state.data)
        }
      }
    }
    const editImage = () => {
      state.image.data = state.data
      state.image.name = 'image'
      state.edit = true
      emit('update-toolbar', {type: 'file', resource: props.resource, category: props.category, action: 'Image Editor'})
    }
    const getBase64 = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result)
      })
    }
    const getIndex = () => {
      var a = objectPath.get(state, 'fhir.' + state.category)
      if (a == undefined) {
        return 0
      } else {
        return a.length
      }
    }
    const handleError = (error) => {
			console.error('navigator.getUserMedia error: ', error)
		}
    const handleSuccess = (stream) => {
      state.captureVideoDisable = false
      video.srcObject = stream
    }
    const loading = () => {
      emit('loading')
    }
    const onAddText = (props) => {
      console.log(props)
    }
    const onCancel = () => {
      if (state.editPdf == true) {
        state.view = true
      }
      state.edit = false
      state.image = {}
    }
    const onEditPdf = (val, page, pagePng, totalPage) => {
      state.image.data = val
      state.page = page
      state.pagePng = pagePng
      state.totalPage = totalPage
      state.image.name = 'pdf_edit_page'
      state.view = false
      state.edit = true
      emit('update-toolbar', {type: 'file', resource: props.resource, category: props.category, action: 'Image Editor'})
    }
    const onMousedown = (props) => {
      console.log(props)
    }
    const onObjectActivated = (props) => {
      console.log(props)
    }
    const onObjectAdded = (props) => {
      console.log(props)
      state.loading = false
    }
    const onObjectMoved = (props) => {
      console.log(props)
    }
    const onObjectScaled = (props) => {
      console.log(props)
    }
    const onPdfLoaded = () => {
      console.log('pdf loaded')
    }
    const onPdfNumberOfPages = (val) => {
      console.log(val)
      state.page_limit = val
    }
    const onPdfPageLoaded = (val) => {
      console.log(val)
      state.loading = false
    }
    const onRedoStackChanged = (props) => {
      console.log(props)
    }
    const onSave = async(data) => {
      if (state.editPdf == true) {
        objectPath.set(state, 'pagePng.' + state.page, data)
        const img0 = new Image
        img0.onload = () => {
          var doc = new jsPDF("p", "px", [img0.height, img0.width])
          for (const [key, value] of Object.entries(state.pagePng)) {
            const img = new Image
            img.onload = () => {
              doc.addImage(img.src, "png", 0, 0, img.width, img.height)
              if (parseInt(key) === state.totalPage) {
                state.pdf = doc.output('datauristring')
                state.edit = false
                state.image = {}
                state.view = true
              } else {
                doc.addPage([img0.height, img0.width], "p")
              }
            }
            img.src = value
          }
        }
        img0.src = objectPath.get(state, 'pagePng.1')
      } else {
        objectPath.set(state, 'fhir.' + state.model + '.contentType', data.substr(data.indexOf(':') + 1, data.indexOf(';') - data.indexOf(':') - 1))
        objectPath.set(state, 'fhir.' + state.model + '.data', data.substr(data.indexOf(',') + 1))
        state.fhir1 = JSON.stringify(state.fhir, null, "  ")
        state.edit = false
        state.image = {}
        state.data = data
        state.sending = true
        await sync(props.resource, false, props.patient, true, state.fhir)
        state.sending = false
        $q.notify({
          message: 'The image was saved with success!',
          color: 'primary',
          actions: [
            { label: 'Dismiss', color: 'white', handler: () => { /* ... */ } }
          ]
        })
        state.add = false
        var contentType = objectPath.get(state, 'fhir.' + state.model + '.contentType')
        if (contentType == 'application/pdf') {
          state.page = 1
          state.pdfViewer = true
        } else {
          state.viewer = true
        }
        stopVideo()
        emit('reload-drawer', props.resource)
        if (state.detailsPending == true) {
          openForm()
        } else {
          emit('close-container')
        }
      }
    }
    const onSavePdf = (val) => {
      state.view = false
      state.editPdf = false
      onSave(val)
    }
    const onTextEditing = (props) => {
      console.log(props)
    }
    const onUndoStackChanged = (props) => {
      console.log(props)
    }
    const openForm = async() => {
      await nextTick()
      state.schema = state.base.uiSchema
      if (props.resource === 'document_references') {
        state.schema = addSchemaOptions('type', props.doc_type_codes, 'Code', 'Display', state.schema)
        state.schema = addSchemaOptions('category', props.doc_class_codes, 'Code', 'Display', state.schema)
      }
      await nextTick()
      state.details = true
    }
    const saveVideo = () => {
      state.image.data = state.dataVideo
      state.image.name = 'cameraCapture'
      state.edit = true
    }
    const showFHIR = () => {
      state.showPreview = true
    }
    const startVideo = () => {
      video = document.querySelector('video')
      img = document.querySelector('#camera_img')
      video.style.display = "block"
      navigator.mediaDevices.getUserMedia(state.cameraOptions).
        then(handleSuccess).catch(handleError)
      state.cameraImg = true
      state.startVideoDisable = true
    }
    const stopVideo = () => {
      if (video !== undefined) {
        if (video.srcObject !== null) {
          const stream = video.srcObject
          const tracks = stream.getTracks()
          tracks.forEach((track) => {
            track.stop()
          })
          video.srcObject = null
        }
      }
    }
    return {
      addedFn,
      addSchemaOptions,
      captureVideo,
      changeImage,
      closeFHIR,
      closeForm,
      editImage,
      getBase64,
      getIndex,
      handleError,
      handleSuccess,
      loading,
      onAddText,
      onCancel,
      onEditPdf,
      onMousedown,
      onObjectActivated,
      onObjectAdded,
      onObjectMoved,
      onObjectScaled,
      onPdfLoaded,
      onPdfNumberOfPages,
      onPdfPageLoaded,
      onRedoStackChanged,
      onSave,
      onSavePdf,
      onTextEditing,
      onUndoStackChanged,
      openForm,
      saveVideo,
      showFHIR,
      startVideo,
      stopVideo,
      sync,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
#fhirpreview {
  font-family:Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace;
}
</style>
