<template>
  <div class="settings-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>系统设置</span>
        </div>
      </template>
      
      <el-tabs v-model="activeTab">
        <el-tab-pane label="设备指纹" name="fingerprint">
          <el-form :model="settings.fingerprint" label-width="180px">
            <el-form-item label="启用设备指纹">
              <el-switch v-model="settings.fingerprint.enabled" />
            </el-form-item>
            <el-form-item label="自动轮换设备">
              <el-switch v-model="settings.fingerprint.rotation" />
            </el-form-item>
            <el-form-item label="轮换间隔(分钟)">
              <el-input-number v-model="settings.fingerprint.rotationInterval" :min="10" :max="1440" :step="10" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <el-tab-pane label="时间同步" name="time">
          <el-form :model="settings.timeSync" label-width="180px">
            <el-form-item label="启用时间同步">
              <el-switch v-model="settings.timeSync.enabled" />
            </el-form-item>
            <el-form-item label="自动同步">
              <el-switch v-model="settings.timeSync.autoSync" />
            </el-form-item>
            <el-form-item label="同步间隔(分钟)">
              <el-input-number v-model="settings.timeSync.syncInterval" :min="5" :max="60" :step="5" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <el-tab-pane label="日志设置" name="log">
          <el-form :model="settings.log" label-width="180px">
            <el-form-item label="最大日志大小(MB)">
              <el-input-number v-model="settings.log.maxSize" :min="1" :max="100" />
            </el-form-item>
            <el-form-item label="日志保留天数">
              <el-input-number v-model="settings.log.retentionDays" :min="1" :max="30" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      
      <div class="form-actions">
        <el-button type="primary" @click="saveSettings">保存设置</el-button>
        <el-button @click="resetSettings">重置</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('fingerprint')

const settings = ref({
  fingerprint: {
    enabled: true,
    rotation: true,
    rotationInterval: 60
  },
  timeSync: {
    enabled: true,
    autoSync: true,
    syncInterval: 30
  },
  log: {
    maxSize: 10,
    retentionDays: 7
  }
})

const loadSettings = async () => {
  if (window.electronAPI?.getGlobalConfig) {
    const result = await window.electronAPI.getGlobalConfig()
    if (result.success) {
      settings.value = { ...settings.value, ...result.config }
    }
  }
}

const saveSettings = async () => {
  if (window.electronAPI?.saveGlobalConfig) {
    const result = await window.electronAPI.saveGlobalConfig(settings.value)
    if (result.success) {
      ElMessage.success('设置已保存')
    } else {
      ElMessage.error('保存失败')
    }
  }
}

const resetSettings = () => {
  loadSettings()
  ElMessage.info('设置已重置')
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-actions {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
  text-align: center;
}
</style>
