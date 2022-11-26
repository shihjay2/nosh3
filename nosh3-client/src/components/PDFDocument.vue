<template>
  <q-card :style="state.dialogWidth">
    <q-card-section class="bg-grey-3">
      <div class="q-pa-sm q-gutter-sm">
        <q-pagination
          v-if="state.pagination"
          v-model="state.currentPage"
          :max="state.numberOfPages"
          input
        />
        <q-btn push color="primary" icon="edit" size="sm" clickable @click="editPdf()">
          <q-tooltip>Edit Page</q-tooltip>
        </q-btn>
        <q-btn push color="primary" icon="save" size="sm" clickable @click="savePdf()">
          <q-tooltip>Save PDF</q-tooltip>
        </q-btn>
      </div>
    </q-card-section>
    <q-card-section>
      <q-scroll-area :style="state.scroll">
        <div class="vue-pdf-main" ref="parentWrapperRef">
          <div class="vue-pdf" ref="pdfWrapperRef">
            <div class="vue-pdf__wrapper" ref="canvasWrapperRef">
              <canvas ref="canvasRef"></canvas>
              <div class="vue-pdf__wrapper-annotation-layer" ref="annotationLayerRef"></div>
            </div>
          </div>
        </div>
      </q-scroll-area>
      <div v-if="state.pagePngDiv" ref="parentWrapperRef1">
        <div class="vue-pdf" ref="pdfWrapperRef1"></div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
import { defineComponent, onMounted, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { changeDpiDataUrl } from 'changedpi'
import objectPath from 'object-path'
import * as pdfjsLib from 'pdfjs-dist/webpack'

export default defineComponent({
  name: 'PDFDocument',
  props: {
    pdf: {
      type: String,
      required: true
    },
    page: {
      type: Number,
      required: true
    }
  },
  emits: ['pdf-loaded', 'number-of-pages', 'page-loaded', 'edit-pdf', 'save-pdf'],
  setup(props, { emit }) {
    const $q = useQuasar()
    const annotationLayerRef = ref()
    const canvasRef = ref()
    const canvasWrapperRef = ref()
    const pageContainer = ref()
    const parentWrapperRef = ref()
    const pdfWrapperRef = ref()
    const pdfWrapperRef1 = ref()
    var pdf = null
    const state = reactive({
      pagination: false,
      numberOfPages: 0,
      currentPage: 1,
      pagePng: {},
      pagePngDiv: true,
      dialogWidth: '',
      scroll: ''
    })
    onMounted(() => {
      state.currentPage = props.page
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
      load()
    })
    watch(() => state.currentPage, (newVal) => {
      if (pdf !== null) {
        render(newVal)
      }
    })
    const editPdf = () => {
      emit('edit-pdf', objectPath.get(state, 'pagePng.' + state.currentPage), state.currentPage, state.pagePng, state.numberOfPages)
    }
    const load = async() => {
      pdf = await pdfjsLib.getDocument(props.pdf).promise
      state.numberOfPages = pdf.numPages
      state.pagination = true
      var pages = [...Array(pdf.numPages + 1).keys()].slice(1)
      await Promise.all(
        pages.map(async (page) => {
          const pdfpage = await pdf.getPage(page)
          const pdfWrapperEl = pdfWrapperRef1.value
          const canvasWrapper = document.createElement('div')
          canvasWrapper.classList.add('vue-pdf__wrapper')
          const canvas = document.createElement('canvas')
          canvas.id = `pdf-canvas-page-${page}`
          canvasWrapper.appendChild(canvas)
          pdfWrapperEl.appendChild(canvasWrapper)
          const initViewport = pdfpage.getViewport({ scale: 1 })
          const canvasWrapperStyles = window.getComputedStyle(canvasWrapper)
          const canvasWrapperWidth = parseFloat(canvasWrapperStyles.width)
          const scale = canvasWrapperWidth / initViewport.width
          const viewport = pdfpage.getViewport({scale})
          canvas.height = viewport.height
          canvas.width = viewport.width
          await pdfpage.render({
            canvasContext: canvas.getContext('2d'),
            viewport
          }).promise
          const dataURL = canvas.toDataURL()
          const dataURL1 = changeDpiDataUrl(dataURL, 150)
          objectPath.set(state, 'pagePng.' + page, dataURL1)
        })
      )
      state.pagePngDiv = false
      render(state.currentPage)
    }
    const render = async(pageNum) => {
      const page = await pdf.getPage(pageNum)
      const canvasWrapper = canvasWrapperRef.value
      const annotationLayer = annotationLayerRef.value
      const canvas = canvasRef.value
      const initViewport = page.getViewport({ scale: 1 })
      const canvasWrapperStyles = window.getComputedStyle(canvasWrapper)
      const canvasWrapperWidth = parseFloat(canvasWrapperStyles.width)
      const scale = canvasWrapperWidth / initViewport.width
      const viewport = page.getViewport({scale})
      canvas.height = viewport.height
      canvas.width = viewport.width
      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport
      }).promise
      const annotationData = await page.getAnnotations()
      const canvasOffsetLeft = (canvasWrapper).offsetLeft
      const canvasOffsetTop = (canvasWrapper).offsetTop
      annotationLayer.style.cssText = `left: ${canvasOffsetLeft}px; top: ${canvasOffsetTop}px; height: ${viewport.height}px; width: ${viewport.width}px;`
      pdfjsLib.AnnotationLayer.render({
        viewport: viewport.clone({ dontFlip: true }),
        div: annotationLayer,
        annotations: annotationData,
        page: page,
        linkService: '',
        downloadManager: '',
        renderInteractiveForms: false
      })
    }
    const savePdf = () => {
      emit('save-pdf', props.pdf)
    }
    return {
      editPdf,
      load,
      render,
      savePdf,
      annotationLayerRef,
      canvasRef,
      canvasWrapperRef,
      pageContainer,
      parentWrapperRef,
      pdfWrapperRef,
      pdfWrapperRef1,
      props,
      state
    }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
.vue-pdf {
  &__wrapper {
    position: relative;
    padding: 20px;
    &-annotation-layer {
      position: absolute;
      .linkAnnotation {
        position: absolute;
        a {
          width: 100%;
          height: 100%;
          display: inline-block;
        }
      }
    }
  }
}
</style>
