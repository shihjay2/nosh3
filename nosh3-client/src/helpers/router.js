import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores'
import DashboardView from '@/views/DashboardView.vue'
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
    }
  ]
})

router.beforeEach(async (to) => {
  const publicPages = ['/app/login', '/app/verify']
  const authRequired = !publicPages.includes(to.path)
  const auth = useAuthStore()
  if (authRequired && !auth.user) {
    auth.returnUrl = to.fullPath
    return '/app/login'
  }
})

export default router
