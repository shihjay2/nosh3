<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title id="logo" class="absolute-center">
          Nosh
        </q-toolbar-title>
      </q-toolbar>
    </q-header>
    <q-page-container>
      <div class="q-pa-md row items-start q-gutter-md fixed-center">
        <q-card>
          <q-card-section>
            <div class="text-h6 text-center">An error has occured.</div>
          </q-card-section>
          <q-card-section>
            <q-list>
              <q-item>
                <q-item-section avatar>
                  <q-avatar color="red" text-color="white" icon="safety_check" />
                </q-item-section>
                <q-item-section>
                  That's all we know.
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </q-page-container>
  </q-layout>
</template>
<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ErrorView',
})
</script>
<style scoped lang="scss">
#logo{
  font-family: 'Pacifico', arial, serif;
  font-size: 30px;
  text-shadow: 4px 4px 4px #aaa;
  vertical-align: middle;
}
</style>