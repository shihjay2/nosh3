import PromiseWorker from 'promise-worker'

const syncWorker = new PromiseWorker(new Worker('sync_worker.js'))
export function sync() {
  const start = (resource) => {
    syncWorker.postMessage({resource})
  }

  return {
    start,
    cancel
  }
}


export default {
  send
}
