<template>
  <q-card :style="state.dialogWidth">
    <q-card-section class="bg-grey-3">
      <div class="q-pa-sm q-gutter-sm">
        <div class="row">
          <q-btn-group push>
            <q-btn push color="primary" icon="undo" size="sm" :disable="state.undoDisable" clickable @click="imageUndo()">
              <q-tooltip>Undo</q-tooltip>
            </q-btn>
            <q-btn push color="primary" icon="redo" size="sm" :disable="state.redoDisable" clickable @click="imageRedo()">
              <q-tooltip>Redo</q-tooltip>
            </q-btn>
            <q-btn push color="primary" icon="rotate_90_degrees_ccw" size="sm" clickable @click="imageRotate(-90)">
              <q-tooltip>Rotate Counterclockwise 90 degrees</q-tooltip>
            </q-btn>
            <q-btn push color="primary" icon="rotate_90_degrees_cw" size="sm" clickable @click="imageRotate(90)">
              <q-tooltip>Rotate Clockwise 90 degrees</q-tooltip>
            </q-btn>
            <q-btn push color="primary" icon="crop" size="sm" clickable @click="imageCrop()">
              <q-tooltip>Crop</q-tooltip>
            </q-btn>
            <q-btn push color="primary" icon="approval" size="sm" clickable @click="imageInovke('stamp')">
              <q-tooltip>Stamp</q-tooltip>
            </q-btn>
          </q-btn-group>
        </div>
        <div class="row">
          <q-btn-toggle
            v-model="state.mode"
            color="primary"
            toggle-color="info"
            push
            size="sm"
            :options="[
              {value: 'pan', slot: 'pan'},
              {value: 'line', slot: 'line'},
              {value: 'free', slot: 'free'},
              {value: 'text', slot: 'text'},
              {value: 'rect', slot: 'rect'},
              {value: 'circle', slot: 'circle'},
            ]"
          >
          <template v-slot:pan>
            <div class="row items-center no-wrap">
              <q-tooltip>Pan</q-tooltip>
              <q-icon name="pan_tool" />
            </div>
          </template>
            <template v-slot:line>
              <div class="row items-center no-wrap">
                <q-tooltip>Line Drawing</q-tooltip>
                <q-icon name="show_chart" />
              </div>
            </template>
            <template v-slot:free>
              <div class="row items-center no-wrap">
                <q-tooltip>Free Drawing</q-tooltip>
                <q-icon name="gesture" />
              </div>
            </template>
            <template v-slot:text>
              <div class="row items-center no-wrap">
                <q-tooltip>Text</q-tooltip>
                <q-icon name="title" />
              </div>
            </template>
            <template v-slot:rect>
              <div class="row items-center no-wrap">
                <q-tooltip>Rectangle</q-tooltip>
                <q-icon name="crop_16_9" />
              </div>
            </template>
            <template v-slot:circle>
              <div class="row items-center no-wrap">
                <q-tooltip>Circle</q-tooltip>
                <q-icon name="circle" />
              </div>
            </template>
          </q-btn-toggle>
        </div>
        <div class="q-gutter-sm row" v-if="state.imageCrop">
          <q-btn-group push>
            <q-btn color="primary" icon="done" size="sm" clickable @click="imageApplyCrop()">
              <q-tooltip>Apply</q-tooltip>
            </q-btn>
            <q-btn color="primary" icon="cancel" size="sm" clickable @click="imageCancelCrop()">
              <q-tooltip>Cancel</q-tooltip>
            </q-btn>
          </q-btn-group>
        </div>
        <div class="q-gutter-sm row" v-if="state.drawActive">
          <q-input v-model="state.brushWidth" label="Brush Width" class="my-input">
            <template v-slot:append>
              <q-icon name="brush" class="cursor-pointer">
                <q-popup-proxy transition-show="scale" transition-hide="scale">
                  <q-banner>
                    <q-knob
                      show-value
                      class="text-light-blue q-ma-md"
                      v-model="state.brushWidth"
                      size="50px"
                      color="light-blue"
                    />
                  </q-banner>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-input v-model="state.brushHex" label="Brush Color" class="my-input">
            <template v-slot:append>
              <q-icon name="colorize" class="cursor-pointer" :style="'color:' + state.brushHex">
                <q-popup-proxy transition-show="scale" transition-hide="scale">
                  <q-color
                    v-model="state.brushHex"
                    no-header
                    no-footer
                  />
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-btn-group push>
            <q-btn :color="state.arrowHeadBtn" icon="arrow_upward" @click="arrowHead()">
              <q-tooltip>Arrow Head</q-tooltip>
            </q-btn>
            <q-btn :color="state.arrowTailBtn" icon="arrow_downward" @click="arrowTail()">
              <q-tooltip>Arrow Tail</q-tooltip>
            </q-btn>
          </q-btn-group>
        </div>
        <div class="q-gutter-sm row" v-if="state.textActive">
          <q-input v-model="state.fontSize" label="Font Size" class="my-input">
            <template v-slot:append>
              <q-icon name="format_size" class="cursor-pointer">
                <q-popup-proxy transition-show="scale" transition-hide="scale">
                  <q-banner>
                    <q-knob
                      show-value
                      class="text-light-blue q-ma-md"
                      v-model="state.fontSize"
                      size="50px"
                      color="light-blue"
                    />
                  </q-banner>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-input v-model="state.fontHex" label="Font Color" class="my-input">
            <template v-slot:append>
              <q-icon name="colorize" class="cursor-pointer" :style="'color:' + state.fontHex">
                <q-popup-proxy transition-show="scale" transition-hide="scale">
                  <q-color
                    v-model="state.fontHex"
                    no-header
                    no-footer
                  />
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-btn-group push>
            <q-btn :color="state.fontBoldBtn" icon="format_bold" @click="fontBold()">
              <q-tooltip>Bold</q-tooltip>
            </q-btn>
            <q-btn :color="state.fontItalicBtn" icon="format_italic" @click="fontItalic()">
              <q-tooltip>Italic</q-tooltip>
            </q-btn>
            <q-btn :color="state.fontUnderlineBtn" icon="format_underlined" @click="fontUnderline()">
              <q-tooltip>Underline</q-tooltip>
            </q-btn>
            <q-btn :color="state.fontStrikethroughBtn" icon="format_strikethrough" @click="fontStrikethrough()">
              <q-tooltip>Strikethrough</q-tooltip>
            </q-btn>
          </q-btn-group>
        </div>
        <div class="q-gutter-sm row" v-if="state.shapeActive">
          <q-checkbox v-model="state.shapeFillTransparent" label="Transparent Fill" class="my-input"/>
          <q-input v-model="state.shapeFillHex" label="Fill Color" class="my-input">
            <template v-slot:append>
              <q-icon name="colorize" class="cursor-pointer" :style="'color:' + state.shapeFillHex">
                <q-popup-proxy transition-show="scale" transition-hide="scale">
                  <q-color
                    v-model="state.shapeFillHex"
                    no-header
                    no-footer
                  />
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-input v-model="state.shapeStrokeHex" label="Stroke Color" class="my-input">
            <template v-slot:append>
              <q-icon name="colorize" class="cursor-pointer" :style="'color:' + state.shapeStrokeHex">
                <q-popup-proxy transition-show="scale" transition-hide="scale">
                  <q-color
                    v-model="state.shapeStrokeHex"
                    no-header
                    no-footer
                  />
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
          <q-input v-model="state.shapeStrokeWidth" label="Stroke Width" class="my-input">
            <template v-slot:append>
              <q-icon name="brush" class="cursor-pointer">
                <q-popup-proxy transition-show="scale" transition-hide="scale">
                  <q-banner>
                    <q-knob
                      show-value
                      class="text-light-blue q-ma-md"
                      v-model="state.shapeStrokeWidth"
                      size="50px"
                      color="light-blue"
                    />
                  </q-banner>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>
        <div class="q-gutter-sm row">
          <q-btn push icon="cancel" color="red" size="sm" @click="onCancel()" label="Cancel" />
          <q-btn push icon="save" color="primary" size="sm" @click="onSave()" label="Save" />
          <q-circular-progress v-if="state.sending" indeterminate size="1em" color="light-blue" class="q-ma-md" />
        </div>
      </div>
    </q-card-section>
    <q-card-section>
      <div class="q-pa-sm q-gutter-sm">
        <q-scroll-area :style="state.scroll">
          <div class="row no-wrap">
            <div ref="tuiImageEditor" style="width:100%;height:100%;" class="tui-image-editor"></div>
          </div>
        </q-scroll-area>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
import { defineComponent, reactive, ref, onMounted, watch } from "vue"
import { useQuasar } from 'quasar'
import ImageEditor from 'tui-image-editor'
import objectPath from 'object-path'

export default defineComponent({
  name: 'TuiImageEditor',
  props: {
    options: Object,
    image: Object
  },
  emits: ['add-text', 'mousedown', 'object-activated', 'object-added', 'object-moved', 'object-scaled', 'redo-stack-changed', 'text-editing', 'undo-stack-changed', 'clear-invoke', 'on-save', 'on-cancel'],
  setup(props, { emit }) {
    const $q = useQuasar()
    const state = reactive({
      options: {},
      palette: [],
      mode: 'pan',
      scroll: '',
      dialogWidth: '',
      sending: false,
      undoDisable: false,
      redoDisable: false,
      // draw
      brushHex: '#000000',
      brushWidth: 12,
      arrowHead: false,
      arrowHeadBtn: 'primary',
      arrowTail: false,
      arrowTailBtn: 'primary',
      drawOptions: {},
      drawActive: false,
      // text
      fontHex: '#000000',
      fontSize: 12,
      fontBold: false,
      fontBoldBtn: 'primary',
      fontItalic: false,
      fontItalicBtn: 'primary',
      fontUnderline: false,
      fontUnderlineBtn: 'primary',
      fontStrikethrough: false,
      fontStrikethroughBtn: 'primary',
      textOptions: {},
      addTextOptions: {},
      textActive: false,
      // shape
      shapeFillHex: '#000000',
      shapeFillTransparent: true,
      shapeStrokeHex: '#000000',
      shapeStrokeWidth: 6,
      shapeActive: false,
      shapeOptions: {},
      activeObjectId: '',
    })
    const tuiImageEditor = ref(null)
    var editorInstance
    onMounted(() => {
      state.options = props.options
      state.dialogWidth = 'max-width:'
      state.dialogWidth += $q.screen.width - 10 + 'px;width:'
      state.dialogWidth += $q.screen.width - 20 + 'px;'
      state.scroll = 'height:'
      if ($q.screen.lt.sm) {
        state.scroll += $q.screen.height - 80 + 'px;max-width:'
        state.scroll += $q.screen.width - 30 + 'px;'
      } else {
        state.scroll += $q.screen.height - 80 + 'px;max-width:'
        state.scroll += $q.screen.width - 30 + 'px;'
      }
      editorInstance = new ImageEditor(tuiImageEditor.value, props.options)
      editorInstance.loadImageFromURL(props.image.data, props.image.name).then(() => {
        resizeEditor()
      })
      // resizeEditor()
      addEventListener()
      state.drawOptions = {
        width: state.brushWidth,
        color: hexToRGBa(state.brushHex, 0.5)
      }
      state.textOptions = {
        fill: state.fontHex,
        fontFamily: 'Arial',
        fontSize: state.fontSize,
        fontStyle: 'normal',
        fontWeight: 'normal'
      }
      state.shapeOptions = {
        fill: 'transparent',
        stroke: hexToRGBa(state.shapeStrokeHex, 0.5),
        strokeWidth: state.shapeStrokeWidth
      }
    })
    watch(() => state.mode, (newVal) => {
      editorInstance.stopDrawingMode()
      state.drawActive = false
      state.textActive = false
      state.shapeActive = false
      if (newVal !== 'pan') {
        if (newVal == 'rect' || newVal == 'circle') {
          state.shapeActive = true
          editorInstance.startDrawingMode('SHAPE')
          editorInstance.setDrawingShape(newVal, state.shapeOptions)
          // editorInstance.addShape(newVal, state.shapeOptions)
        } else if (newVal == 'text') {
          state.textActive = true
          editorInstance.startDrawingMode('TEXT')
        } else {
          state.drawActive = true
          if (newVal == 'free') {
            editorInstance.startDrawingMode('FREE_DRAWING', state.drawOptions)
          } else {
            editorInstance.startDrawingMode('LINE_DRAWING', state.drawOptions)
          }
        }
      }
    })
    watch(() => state.brushWidth, (newVal) => {
      editorInstance.stopDrawingMode()
      objectPath.set(state, 'drawOptions.width', newVal)
      if (state.mode == 'free') {
        editorInstance.startDrawingMode('FREE_DRAWING', state.drawOptions)
      } else {
        editorInstance.startDrawingMode('LINE_DRAWING', state.drawOptions)
      }
    })
    watch(() => state.fontSize, (newVal) => {
      objectPath.set(state, 'textOptions.fontSize', newVal)
      editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
    })
    watch(() => state.brushHex, (newVal) => {
      editorInstance.stopDrawingMode()
      objectPath.set(state, 'drawOptions.color', hexToRGBa(newVal, 0.5))
      if (state.mode == 'free') {
        editorInstance.startDrawingMode('FREE_DRAWING', state.drawOptions)
      } else {
        editorInstance.startDrawingMode('LINE_DRAWING', state.drawOptions)
      }
    })
    watch(() => state.fontHex, (newVal) => {
      objectPath.set(state, 'textOptions.fill', hexToRGBa(newVal, 0.5))
      editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
    })
    watch(() => state.shapeFillHex, (newVal) => {
      if (!state.shapeFillTransparent) {
        objectPath.set(state, 'shapeOptions.fill', hexToRGBa(newVal, 0.5))
        if (state.activeObjectId !== '') {
          editorInstance.setDrawingShape(state.mode, state.shapeOptions)
        } else {
          editorInstance.changeShape(state.activeObjectId, state.shapeOptions)
        }
      }
    })
    watch(() => state.shapeFillTransparent, (newVal) => {
      if (newVal) {
        objectPath.set(state, 'shapeOptions.fill', 'transparent')
      } else {
        objectPath.set(state, 'shapeOptions.fill', hexToRGBa(state.shapeFillHex, 0.5))
      }
      if (state.activeObjectId !== '') {
        editorInstance.setDrawingShape(state.mode, state.shapeOptions)
      } else {
        editorInstance.changeShape(state.activeObjectId, state.shapeOptions)
      }
    })
    watch(() => state.shapeStrokeHex, (newVal) => {
      objectPath.set(state, 'shapeOptions.stroke', hexToRGBa(newVal, 0.5))
      if (state.activeObjectId !== '') {
        editorInstance.setDrawingShape(state.mode, state.shapeOptions)
      } else {
        editorInstance.changeShape(state.activeObjectId, state.shapeOptions)
      }
    })
    watch(() => state.shapeStrokeWidth, (newVal) => {
      objectPath.set(state, 'shapeOptions.strokeWidth', newVal)
      if (state.activeObjectId !== '') {
        editorInstance.setDrawingShape(state.mode, state.shapeOptions)
      } else {
        editorInstance.changeShape(state.activeObjectId, state.shapeOptions)
      }
    })
    const addEventListener = () => {
      editorInstance.on({
        objectAdded: (objectProps) => {
          emit('object-added', objectProps)
        },
        undoStackChanged: (length) => {
          if (length) {
            state.undoDisable = false
          } else {
            state.undoDisable = true
          }
          resizeEditor()
          emit('undo-stack-changed', length)
        },
        redoStackChanged: (length) => {
          if (length) {
            state.redoDisable = false
          } else {
            state.redoDisable = true
          }
          resizeEditor()
          emit('undo-stack-changed', length)
        },
        objectScaled: (obj) => {
          if (obj.type === 'i-text') {
            state.fontSize = obj.fontSize
          }
          emit('object-scaled', obj)
        },
        addText: (pos) => {
          objectPath.set(state, 'addTextOptions.styles', state.textOptions)
          objectPath.set(state, 'addTextOptions.position', pos.originPosition)
          editorInstance.addText('Double Click', state.addTextOptions).then((objectProps) => {
            emit('add-text', objectProps)
          })
        },
        objectActivated: (obj) => {
          state.activeObjectId = obj.id
          state.drawActive = false
          state.shapeActive = false
          state.textActive = false
          if (obj.type === 'rect' || obj.type === 'circle' ) {
            state.shapeActive = true
            editorInstance.startDrawingMode('SHAPE')
          } else if (obj.type === 'icon') {
            // showSubMenu('icon');
            // setIconToolbar(obj);
            // activateIconMode();
          } else if (obj.type === 'i-text') {
            state.textActive = true
            editorInstance.startDrawingMode('TEXT')
          }
          emit('object-activated', obj)
        },
        mousedown: (event, originPointer) => {
          emit('mousedown', event, originPointer)
        },
      })
    }
    const arrowHead = () => {
      editorInstance.stopDrawingMode()
      if (state.arrowHead) {
        state.arrowHead = false
        state.arrowHeadBtn = 'primary'
        objectPath.del(state, 'drawOptions.arrowType.head')
        if (state.mode == 'free') {
          editorInstance.startDrawingMode('FREE_DRAWING', state.drawOptions)
        } else {
          editorInstance.startDrawingMode('LINE_DRAWING', state.drawOptions)
        }
      } else {
        state.arrowHead = true
        state.arrowHeadBtn = 'info'
        objectPath.set(state, 'drawOptions.arrowType.head', 'chevron')
        if (state.mode == 'free') {
          editorInstance.startDrawingMode('FREE_DRAWING', state.drawOptions)
        } else {
          editorInstance.startDrawingMode('LINE_DRAWING', state.drawOptions)
        }
      }
    }
    const arrowTail = () => {
      editorInstance.stopDrawingMode()
      if (state.arrowTail) {
        state.arrowTail = false
        state.arrowTailBtn = 'primary'
        objectPath.del(state, 'drawOptions.arrowType.tail')
        if (state.mode == 'free') {
          editorInstance.startDrawingMode('FREE_DRAWING', state.drawOptions)
        } else {
          editorInstance.startDrawingMode('LINE_DRAWING', state.drawOptions)
        }
      } else {
        state.arrowTail = true
        state.arrowTailBtn = 'info'
        objectPath.set(state, 'drawOptions.arrowType.tail', 'chevron')
        if (state.mode == 'free') {
          editorInstance.startDrawingMode('FREE_DRAWING', state.drawOptions)
        } else {
          editorInstance.startDrawingMode('LINE_DRAWING', state.drawOptions)
        }
      }
    }
    const base64ToBlob = (data) => {
      const rImageType = /data:(image\/.+);base64,/;
      let mimeString = ''
      let raw, uInt8Array, i, rawLength
      raw = data.replace(rImageType, function (header, imageType) {
        mimeString = imageType
        return ''
      })
      raw = atob(raw)
      rawLength = raw.length
      uInt8Array = new Uint8Array(rawLength) // eslint-disable-line
      for (i = 0; i < rawLength; i += 1) {
        uInt8Array[i] = raw.charCodeAt(i)
      }
      return new Blob([uInt8Array], { type: mimeString })
    }
    const fontBold = () => {
      if (state.fontBold) {
        state.fontBold = false
        state.fontBoldBtn = 'primary'
        objectPath.set(state, 'textOptions.fontWeight', 'normal')
        editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
      } else {
        state.fontBold = true
        state.fontBoldBtn = 'info'
        objectPath.set(state, 'textOptions.fontWeight', 'bold')
        editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
      }
    }
    const fontItalic = () => {
      if (state.fontItalic) {
        state.fontItalic = false
        state.fontItalicBtn = 'primary'
        objectPath.set(state, 'textOptions.fontStyle', 'normal')
        editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
      } else {
        state.fontItalic = true
        state.fontItalicBtn = 'info'
        objectPath.set(state, 'textOptions.fontStyle', 'italic')
        editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
      }
    }
    const fontStrikethrough = () => {
      if (state.fontStrikethrough) {
        state.fontStrikethrough = false
        state.fontStrikethroughBtn = 'primary'
        objectPath.del(state, 'textOptions.textDecoration')
        editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
      } else {
        state.fontStrikethrough = true
        state.fontStrikethroughBtn = 'info'
        state.fontUnderline = false
        state.fontUnderlineBtn = 'primary'
        objectPath.set(state, 'textOptions.textDecoration', 'line-through')
        editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
      }
    }
    const fontUnderline = () => {
      if (state.fontUnderline) {
        state.fontUnderline = false
        state.fontUnderlineBtn = 'primary'
        objectPath.del(state, 'textOptions.textDecoration')
        editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
      } else {
        state.fontUnderline = true
        state.fontUnderlineBtn = 'info'
        state.fontStrikethrough = false
        state.fontStrikethroughBtn = 'primary'
        objectPath.set(state, 'textOptions.textDecoration', 'underline')
        editorInstance.changeTextStyle(state.activeObjectId, state.textOptions)
      }
    }
    const getRootElement = () => {
      return tuiImageEditor.value
    }
    const hexToRGBa = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      const a = alpha || 1
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
    }
    const imageApplyCrop = () => {
      editorInstance.crop(editorInstance.getCropzoneRect()).then(() => {
        editorInstance.stopDrawingMode()
        resizeEditor()
      })
      state.imageCrop = false
      state.image = true
    }
    const imageCancelCrop = () => {
      editorInstance.stopDrawingMode()
      state.imageCrop = false
      state.image = true
    }
    const imageCrop = () => {
      editorInstance.startDrawingMode('CROPPER')
      state.image = false
      state.imageCrop = true
    }
    const imageRedo = () => {
      editorInstance.discardSelection()
      editorInstance.redo()
    }
    const imageRotate = (deg) => {
      editorInstance.rotate(deg)
    }
    const imageStamp = () => {
      let file
      let imgUrl
      file = event.target.files[0]
      if (file) {
        imgUrl = URL.createObjectURL(file)
        editorInstance.loadImageFromURL(editorInstance.toDataURL(), 'FilterImage').then(() => {
          editorInstance.addImageObject(imgUrl).then((objectProps) => {
            URL.revokeObjectURL(file)
            console.log(objectProps)
          })
        })
      }
    }
    const imageUndo = () => {
      editorInstance.discardSelection()
      editorInstance.undo()
    }
    const onCancel = () => {
      emit('on-cancel')
    }
    const onSave = () => {
      state.sending = true
      const base64 = editorInstance.toDataURL()
      emit('on-save', base64)
    }
    const resizeEditor = () => {
      const editor = document.querySelector('.tui-image-editor')
      const container = document.querySelector('.tui-image-editor-canvas-container')
      const height = parseFloat(container.style.maxHeight)
      const width = parseFloat(container.style.maxWidth)
      editor.style.height = height + 'px'
      editor.style.width = width + 'px'
    }
    return {
      addEventListener,
      arrowHead,
      arrowTail,
      base64ToBlob,
      fontBold,
      fontItalic,
      fontStrikethrough,
      fontUnderline,
      getRootElement,
      hexToRGBa,
      imageApplyCrop,
      imageCancelCrop,
      imageCrop,
      imageRedo,
      imageRotate,
      imageStamp,
      imageUndo,
      onCancel,
      onSave,
      resizeEditor,
      state,
      tuiImageEditor
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.my-input {
  max-width: 120px
}
</style>
