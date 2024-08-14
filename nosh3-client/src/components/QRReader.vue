<template>
  <div class="q-pa-md q-gutter-md">
    <qrcode-stream :paused="state.paused" @detect="onDetect" @camera-on="onCameraOn" @camera-off="onCameraOff" @error="onError">
      <div v-show="state.showScanConfirmation" class="scan-confirmation">
        <q-icon name="check" color="teal" size="4.4em" />
      </div>
    </qrcode-stream>
  </div>
  <q-dialog v-model="state.showPreview" persistent position="top" full-width full-height seamless>
    <q-card>
      <q-card-section>
        <q-banner :class="state.classVerified">{{ state.textVerified }}</q-banner>
      </q-card-section>
      <q-card-section>
        <div>
          <span v-for="data in state.content" :key="data.key">
            <QInfoTemplate
              :data="data"
              :style="state.base.uiListContent.contentStyle"
            />
          </span>
        </div>
      </q-card-section>
      <q-card-section v-if="state.preview">
        <textarea id="fhirpreview" v-model="state.fhir" rows="20" cols="80" class="bg-grey-9 text-white"></textarea>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <div class="q-pa-sm q-gutter-sm">
          <q-btn push icon="check" color="positive" @click="completeOrder" :label="state.complete" />
          <q-btn push icon="cancel" color="negative" @click="closeFHIR" label="Close" />
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { defineComponent, reactive, onMounted } from 'vue'
import { common } from '@/logic/common'
import axios from 'axios'
import jsum from 'jsum'
import objectPath from 'object-path'
import { SiweMessage } from '@spruceid/ssx'
import { QrcodeStream, QrcodeDropZone, QrcodeCapture } from 'vue-qrcode-reader'

export default defineComponent({
  name: 'QRReader',
  components: {
    QrcodeStream,
    // QrcodeDropZone,
    // QrcodeCapture
  },
  props: {
    resource: String,
    fhir_url: String
  },
  emits: ['loading', 'save-oidc'],
  
  setup(props, { emit }) {
    const state = reactive({
      paused: false,
      token: '',
      result: '',
      showScanConfirmation: '',
      showPreview: false,
      fhir: '',
      preview: false,
      classVerified: 'bg-negative text-white',
      textVerified: '',
      base: {},
      content: [],
      complete: '',
      doc: {}
    })
    const { fhirReplace } = common()
    onMounted(async() => {
      
    })
    const closeFHIR = () => {
      state.showPreview = false
    }
    const completeOrder = async() => {

    }
    const onCameraOff = () => {
      state.showScanConfirmation = true
    }
    const onCameraOn = () => {
      state.showScanConfirmation = false
    }
    const onDetect = async(detectedCodes) => {
      state.result = JSON.stringify(detectedCodes.map(code => code.rawValue))
      state.paused = true
      try {
        const presentation = await axios.get(state.result)
        const opts = {headers: {Authorization: 'Bearer ' + presentation.data.token.access_token.value, Accept: 'application/json'}}
        state.token = presentation.data.token.access_token.value
        try {
          const doc = await axios.get(presentation.data.location, opts)
          state.doc = doc
          // get signature
          const provenance = doc.entry.find(a => a.resource.resourceType == 'Provenance')
          if (objectPath.has(provenance, 'resource.signature.0.data')) {
            const signature = objectPath.get(provenance, 'resource.signature.0.data')
            const signature_json = Buffer.from(signature, 'base64').toString()
            const signature_obj = JSON.parse(signature_json)
            if (objectPath.has(signature_obj, 'signature')) {
              const siweMessage = new SiweMessage(signature_obj.message)
              const status = await siweMessage.verify({signature: signature_obj.signature})
              if (status) {
                // verify hash
                if (objectPath.has(signature_obj, 'hash')) {
                  let comp_doc = null
                  let comp_doc_type = ''
                  const medication_request = doc.entry.find(b => b.resource.resourceType == 'MedicationRequest')
                  const service_request = doc.entry.find(c => c.resource.resourceType == 'ServiceRequest')
                  if (medication_request !== undefined) {
                    comp_doc = medication_request
                    state.base = await import('@/assets/fhir/medication_requests.json')
                    state.complete = 'Medication Request Completed'
                    comp_doc_type = 'Medication Request'
                  }
                  if (service_request !== undefined) {
                    comp_doc = service_request
                    state.base = await import('@/assets/fhir/service_requests.json')
                    state.complete = 'Service Request Completed'
                    comp_doc_type = 'Service Request'
                  }
                  if (comp_doc !== null) {
                    const hash = jsum.digest(comp_doc, 'SHA256', 'hex')
                    if (hash === objectPath.get(signature_obj, 'hash')) {
                      state.preview = true
                      state.fhir = comp_doc
                      state.content = fhirReplace('content', state.base, state.fhir, state.base.uiSchema.flat())
                      state.textVerified = comp_doc_type + ' has a valid signature and hash has been matched to verify authenticity!'
                      state.classVerified = 'bg-positive text-white'
                      state.showPreview = true
                    } else {
                      state.textVerified = 'Hash does not match'
                      console.log('hash does not match')
                    }
                  } else {
                    state.textVerified = 'No FHIR Document found'
                    state.showPreview = true
                    console.log('no doc')
                  }
                } else {
                  state.textVerified = 'No hash value to compare'
                  state.showPreview = true
                  console.log('no hash')
                }
              } else {
                state.textVerified = 'Invalid Sign-in With Ethereum (SIWE) signature'
                state.showPreview = true
                console.log('invalid siwe signature')
              }
            } else {
              state.textVerified = 'No Sign-in With Ethereum (SIWE) signature found'
              state.showPreview = true
              console.log('no siwe signature')
            }
          } else {
            state.textVerified = 'No signature found'
            state.showPreview = true
            console.log('no signature')
          }
        } catch (e) {
          state.textVerified = 'Problem retreiving resource'
          state.showPreview = true
        }
      } catch (e) {
        state.textVerified = 'Problem retrieving presentation'
        state.showPreview = true
      }
      await timeout(500)
      state.paused = false
    }
    const onError = () => {
      console.error
    }
    const timeout = () => {
      return new Promise((resolve) => {
        window.setTimeout(resolve, ms)
      })
    }
    
    return {
      completeOrder,
      closeFHIR,
      onCameraOff,
      onCameraOn,
      onDetect,
      onError,
      state,
      timeout
    }
  }
})
</script>
<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.scan-confirmation {
  position: absolute;
  width: 100%;
  height: 100%;

  background-color: rgba(255, 255, 255, 0.8);

  display: flex;
  flex-flow: row nowrap;
  justify-content: center;
}
#fhirpreview {
  font-family:Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New, monospace;
}
</style>
