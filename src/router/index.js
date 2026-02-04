import { createRouter, createWebHashHistory } from 'vue-router'
import Layout from '../layouts/MainLayout.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '控制台', icon: 'Odometer' }
      },
      {
        path: '/accounts',
        name: 'Accounts',
        component: () => import('../views/Accounts.vue'),
        meta: { title: '账号管理', icon: 'User' }
      },
      {
        path: '/tasks',
        name: 'Tasks',
        component: () => import('../views/Tasks.vue'),
        meta: { title: '任务管理', icon: 'List' }
      },
      {
        path: '/quick-buy',
        name: 'QuickBuy',
        component: () => import('../views/QuickBuy.vue'),
        meta: { title: '快速抢购', icon: 'Lightning' }
      },
      {
        path: '/performance',
        name: 'Performance',
        component: () => import('../views/Performance.vue'),
        meta: { title: '性能监控', icon: 'TrendCharts' }
      },
      {
        path: '/settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: '系统设置', icon: 'Setting' }
      },
      {
        path: '/logs',
        name: 'Logs',
        component: () => import('../views/Logs.vue'),
        meta: { title: '日志查看', icon: 'Document' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
