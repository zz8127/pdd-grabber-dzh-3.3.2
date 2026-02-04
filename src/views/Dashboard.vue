<template>
  <div class="dashboard-page">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card class="welcome-card">
          <h2>欢迎使用拼多多多账号抢购助手</h2>
          <p>当前版本: v3.3.2 | UI框架: Vue 3 + Element Plus</p>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" class="stats-row">
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-icon blue">
            <el-icon :size="40"><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.accounts }}</div>
            <div class="stat-label">账号数量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-icon green">
            <el-icon :size="40"><List /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.tasks }}</div>
            <div class="stat-label">任务数量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card">
          <div class="stat-icon orange">
            <el-icon :size="40"><CircleCheck /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.successRate }}%</div>
            <div class="stat-label">成功率</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { User, List, CircleCheck } from '@element-plus/icons-vue'

const stats = ref({
  accounts: 0,
  tasks: 0,
  successRate: 0
})

onMounted(async () => {
  // 加载统计数据
  if (window.electronAPI?.getGlobalStats) {
    const result = await window.electronAPI.getGlobalStats()
    if (result.success) {
      stats.value = {
        accounts: result.stats.totalAccounts || 0,
        tasks: result.stats.totalTasks || 0,
        successRate: result.stats.totalSuccess + result.stats.totalFail > 0
          ? Math.round((result.stats.totalSuccess / (result.stats.totalSuccess + result.stats.totalFail)) * 100)
          : 0
      }
    }
  }
})
</script>

<style scoped>
.dashboard-page {
  padding: 20px;
}

.welcome-card {
  text-align: center;
  padding: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  margin-bottom: 20px;
}

.welcome-card h2 {
  margin-bottom: 10px;
  font-size: 28px;
}

.stats-row {
  margin-top: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
}

.stat-icon {
  width: 80px;
  height: 80px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  color: white;
}

.stat-icon.blue {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.green {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-icon.orange {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}
</style>
