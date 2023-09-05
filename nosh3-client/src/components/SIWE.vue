<template>
  <div class="q-pa-md q-gutter-md">
    <q-btn class="full-width q-pa-md" push icon="wallet" color="primary" label="Select Wallet" @click="connectWallet()" />
    <q-btn class="full-width q-pa-md" push icon="replay" color="primary" label="Sign-in With Etherium" @click="signInWithEthereum()" />
  </div>
</template>

<script>
import { defineComponent, reactive, ref, onMounted, watch } from 'vue'
import { common } from '@/logic/common'
import axios from 'axios'
import Case from 'case'
import Fuse from 'fuse.js'
import objectPath from 'object-path'
import pluralize from 'pluralize'
import {v4 as uuidv4} from 'uuid'

import { useAuthStore } from '@/stores'
import { SSX, SiweMessage } from '@spruceid/ssx';

export default defineComponent({
  name: 'SIWE',
  props: {
    resource: String,
    fhir_url: String
  },
  emits: ['loading', 'save-oidc'],
  setup(props, { emit }) {
    const { fetchJSON } = common()
    const state = reactive({
      
    })
    const auth = useAuthStore()
    onMounted(async() => {
      const ssx = new SSX();
      await ssx.signIn();
      const address = ssx.userAuthorization.address();
      const chainId = ssx.userAuthorization.chainId();
      const domain = window.location.host;
      const origin = window.location.origin;
      const statement = 'Sign this ' + Case.pascal(pluralize.singular(props.resource));
      const resource_url = origin + '/review/' + objectPath.get(doc, 'interact_nonce.value')
      const resource_arr = [];
      resource_arr.push(resource_url);
      for (var a of pending) {
        for (var b of objectPath.get(a, 'locations')) {
          resource_arr.push(b);
        }
      }
      const siwemessage = new SiweMessage({
        domain,
        address,
        statement,
        uri: origin,
        version: '1',
        chainId,
        resources: resource_arr
      });
      const siwemessage_prep = siwemessage.prepareMessage();
      const sig = await ssx.userAuthorization.signMessage(siwemessage_prep);
      const message = siwemessage_prep.replace(/(?:\r\n|\r|\n)/g, '\n');
      objectPath.set(doc, 'siwe', {sig, message});
      objectPath.set(doc, 'pending_resources', pending);
      objectPath.set(doc, 'request_date', moment().format());
    })

    const connectWallet = () => {
      provider.send('eth_requestAccounts', [])
        .catch(() => console.log('user rejected request'))
    }

    const createSiweMessage = (address, statement) => {
      const message = new SiweMessage({
        domain,
        address,
        statement,
        uri: origin,
        version: '1',
        chainId: '1',
        resources: [props.fhir_url]
      })
      return message.prepareMessage()
    }

    const signInWithEthereum = async() => {
      const signer = await provider.getSigner()
      const message = createSiweMessage(
        signer.address, 
        props.doc
      )
      console.log(await signer.signMessage(message));
    }



    watch(() => state.filter, async(newVal) => {
      if (newVal !== '') {
        state.data = []
        state.bluebutton = false
        const keys = ['resource.name']
        const fuse = new Fuse(state.epic, {keys: keys})
        var result = fuse.search(newVal)
        for (var a of result) {
          state.data.push(a.item)
        }
      } else {
        state.bluebutton = true
        state.data = state.epic
      }
    })
    
    
    return {
      connectWallet,
      signInWithEthereum,
      state
    }
  }
})
</script>
<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss">
</style>
