<template>
  <div class="logs-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>系统日志</span>
          <div class="header-actions">
            <el-select v-model="logType" placeholder="日志类型" style="width: 150px; margin-right: 10px">
              <el-option label="全部" value="all" />
              <el-option label="系统" value="system" />
              <el-option label="任务" value="task" />
              <el-option label="请求" value="request" />
              <el-option label="错误" value="error" />
            </el-select>
            <el-button type="primary" @click="refreshLogs">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
            <el-button @click="clearLogs">
              <el-icon><Delete /></el-icon>
              清空
            </el-button>
          </div>
        </div>
      </template>
      
      <div class="log-container" v-loading="loading">
        <div 
          v-for="(log, index) in filteredLogs" 
          :key="index" 
          class="log-item"
          :class="log.level"
        >
          <span class="log-time">{{ log.time }}</span>
          <el-tag :type="getLogLevelType(log.level)" size="small" class="log-level">
            {{ log.level }}
          </el-tag>
          <span class="log-category">[{{ log.category }}]</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Refresh, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const logs = ref([])
const loading = ref(false)
const logType = ref('all')

const filteredLogs = computed(() => {
  if (logType.value === 'all') return logs.value
  return logs.value.filter(log => log.category === logType.value || log.level === logType.value)
})

const getLogLevelType = (level) => {
  const map = {
    info: 'info',
    success: 'success',
    warning: 'warning',
    error: 'danger',
    debug: 'info'
  }
  return map[level] || 'info'
}

const refreshLogs = async () => {
  loading.value = true
  try {
    if (window.electronAPI?.getLogs) {
      const result = await window.electronAPI.getLogs()
      if (result.success) {
        logs.value = result.logs
      }
    }
  } finally {
    loading.value = false
  }
}

const clearLogs = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有日志吗？', '提示', {
      type: 'warning'
    })
    
    if (window.electronAPI?.clearLogs) {
      const result = await window.electronAPI.clearLogs()
      if (result.success) {
        logs.value = []
        ElMessage.success('日志已清空')
      }
    }
  } catch {
    // 取消
  }
}

onMounted(() => {
  refreshLogs()
})
</script>

<style scoped>
.logs-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
}

.log-container {
  max-height: 600px;
  overflow-y: auto;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 10px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.log-item {
  padding: 4px 8px;
  border-radius: 2px;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.log-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.log-time {
  color: #858585;
  min-width: 140px;
}

.log-level {
  min-width: 60px;
  text-align: center;
}

.log-category {
  color: #9cdcfe;
  min-width: 100px;
}

.log-message {
  color: #d4d4d4;
  flex: 1;
}

.log-item.success .log-message {
  color: #7ee787;
}

.log-item.warning .log-message {
  color: #ffa657;
}

.log-item.error .log-message {
  color: #ff7b72;
}
</style>
