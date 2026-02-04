<template>
  <el-container class="layout-container">
    <!-- 头部 -->
    <el-header class="layout-header gradient-bg">
      <div class="header-content">
        <div class="logo">
          <el-icon class="logo-icon" :size="28"><ShoppingCart /></el-icon>
          <div class="logo-text">
            <h1>拼多多多账号抢购助手</h1>
            <span class="version">v3.3.2</span>
          </div>
        </div>
        
        <div class="header-actions">
          <el-tag :type="connectionStatus.type" effect="dark" class="status-tag">
            <el-icon><CircleCheck v-if="connectionStatus.online" /><CircleClose v-else" /></el-icon>
            {{ connectionStatus.text }}
          </el-tag>
          
          <el-tooltip content="时间同步">
            <el-button 
              type="primary" 
              :icon="Clock" 
              circle 
              size="small"
              @click="syncTime"
              :loading="syncing"
            />
          </el-tooltip>
          
          <el-tooltip content="系统设置">
            <el-button 
              type="info" 
              :icon="Setting" 
              circle 
              size="small"
              @click="$router.push('/settings')"
            />
          </el-tooltip>
        </div>
      </div>
    </el-header>
    
    <el-container class="main-container">
      <!-- 侧边栏 -->
      <el-aside width="220px" class="layout-aside">
        <el-menu
          :default-active="$route.path"
          router
          class="layout-menu"
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
        >
          <el-menu-item v-for="route in menuRoutes" :key="route.path" :index="route.path">
            <el-icon>
              <component :is="route.meta.icon" />
            </el-icon>
            <span>{{ route.meta.title }}</span>
          </el-menu-item>
        </el-menu>
        
        <!-- 统计信息 -->
        <div class="aside-stats">
          <el-divider />
          <div class="stats-item">
            <span class="stats-label">账号数</span>
            <span class="stats-value">{{ stats.accountCount }}</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">任务数</span>
            <span class="stats-value">{{ stats.taskCount }}</span>
          </div>
          <div class="stats-item">
            <span class="stats-label">成功率</span>
            <span class="stats-value" :class="getSuccessRateClass">{{ stats.successRate }}%</span>
          </div>
        </div>
      </el-aside>
      
      <!-- 主内容区 -->
      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { 
  ShoppingCart, 
  CircleCheck, 
  CircleClose, 
  Clock, 
  Setting,
  Odometer,
  User,
  List,
  Lightning,
  TrendCharts,
  Document
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()

// 菜单路由
const menuRoutes = [
  { path: '/dashboard', meta: { title: '控制台', icon: 'Odometer' } },
  { path: '/accounts', meta: { title: '账号管理', icon: 'User' } },
  { path: '/tasks', meta: { title: '任务管理', icon: 'List' } },
  { path: '/quick-buy', meta: { title: '快速抢购', icon: 'Lightning' } },
  { path: '/performance', meta: { title: '性能监控', icon: 'TrendCharts' } },
  { path: '/settings', meta: { title: '系统设置', icon: 'Setting' } },
  { path: '/logs', meta: { title: '日志查看', icon: 'Document' } }
]

// 连接状态
const connectionStatus = ref({
  online: true,
  type: 'success',
  text: '已连接'
})

// 同步状态
const syncing = ref(false)

// 统计数据
const stats = ref({
  accountCount: 0,
  taskCount: 0,
  successRate: 0
})

// 成功率样式
const getSuccessRateClass = computed(() => {
  const rate = stats.value.successRate
  if (rate >= 80) return 'success'
  if (rate >= 50) return 'warning'
  return 'danger'
})

// 时间同步
const syncTime = async () => {
  syncing.value = true
  try {
    // 调用主进程的时间同步
    if (window.electronAPI?.syncTime) {
      const result = await window.electronAPI.syncTime()
      if (result.success) {
        ElMessage.success(`时间同步成功，偏移量: ${result.offset}ms`)
      } else {
        ElMessage.error(`时间同步失败: ${result.message}`)
      }
    }
  } catch (error) {
    ElMessage.error('时间同步出错')
  } finally {
    syncing.value = false
  }
}

// 加载统计数据
const loadStats = async () => {
  try {
    if (window.electronAPI?.getGlobalStats) {
      const result = await window.electronAPI.getGlobalStats()
      if (result.success) {
        stats.value = {
          accountCount: result.stats.totalAccounts || 0,
          taskCount: result.stats.totalTasks || 0,
          successRate: calculateSuccessRate(result.stats)
        }
      }
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

// 计算成功率
const calculateSuccessRate = (stats) => {
  const total = stats.totalSuccess + stats.totalFail
  if (total === 0) return 0
  return Math.round((stats.totalSuccess / total) * 100)
}

onMounted(() => {
  loadStats()
  // 每30秒刷新一次统计
  setInterval(loadStats, 30000)
})
</script>

<style scoped>
.layout-container {
  height: 100vh;
  overflow: hidden;
}

.layout-header {
  height: 60px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  color: white;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  background: rgba(255, 255, 255, 0.2);
  padding: 8px;
  border-radius: 8px;
}

.logo-text h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.logo-text .version {
  font-size: 12px;
  opacity: 0.8;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.main-container {
  height: calc(100vh - 60px);
  position: relative;
}

.layout-aside {
  background: #304156;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 60px;
  height: calc(100vh - 60px);
  width: 220px;
  z-index: 100;
}

.layout-menu {
  border-right: none;
  flex: 1;
  overflow-y: auto;
}

.aside-stats {
  padding: 16px;
  color: #bfcbd9;
  background: #304156;
}

.stats-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.stats-value {
  font-weight: 600;
  color: #409EFF;
}

.stats-value.success {
  color: #67C23A;
}

.stats-value.warning {
  color: #E6A23C;
}

.stats-value.danger {
  color: #F56C6C;
}

.layout-main {
  padding: 20px;
  background: #f5f7fa;
  overflow-y: auto;
  margin-left: 220px;
  height: calc(100vh - 60px);
}

/* 路由切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
