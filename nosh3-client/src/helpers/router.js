import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores'
import axios from 'axios'
import DashboardView from '@/views/DashboardView.vue'
import ErrorView from '@/views/ErrorView.vue'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import VerifyView from '@/views/VerifyView.vue'

export const router = createRouter({
  history: createWebHistory(),
  linkActiveClass: 'active',
  routes: [
    {
      path: '/app/chart/:id',
      component: HomeView
    },
    {
      path: '/app/dashboard',
      component: DashboardView
    },
    {
      path: '/app/login',
      component: LoginView
    },
    {
      path: '/app/verify',
      component: VerifyView
    },
    {
      path: '/app/error',
      component: ErrorView
    }
  ]
})

router.beforeEach(async (to) => {
  const publicPages = ['/app/login', '/app/verify', '/app/error']
  const authRequired = !publicPages.includes(to.path)
  let auth = null
  const config = await axios.get(window.location.origin + '/auth/config')
  console.log(config.data)
  console.log(to.path)
  console.log(authRequired)
  if (config.data.instance === 'digitalocean' && config.data.type === 'pnosh') {
    if (authRequired) {
      if (to.path !== '/app/dashboard') {
        localStorage.setItem('auth_id', to.path.split("/").pop())
        auth = useAuthStore(to.path.split("/").pop())
        if (!auth.user) {
          auth.returnUrl = to.fullPath
          return '/app/login'
        }
      } else {
        return '/app/error'
      }
    } else {
      if (localStorage.getItem('auth_id') === null) {
        // console.log(auth.returnUrl)
        return '/app/error'
      }
    }
  } else {
    localStorage.setItem('auth_id', 'auth')
    auth = useAuthStore('auth')
    if (authRequired && !auth.user) {
      auth.returnUrl = to.fullPath
      return '/app/login'
    }
  }
})

export default router
