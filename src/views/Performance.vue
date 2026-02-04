<template>
  <div class="performance-page">
    <el-row :gutter="20">
      <!-- 性能概览卡片 -->
      <el-col :span="6" v-for="card in overviewCards" :key="card.title">
        <el-card class="overview-card hover-card" :body-style="{ padding: '20px' }">
          <div class="card-content">
            <div class="card-icon" :style="{ background: card.color }">
              <el-icon :size="24" color="white">
                <component :is="card.icon" />
              </el-icon>
            </div>
            <div class="card-info">
              <div class="card-title">{{ card.title }}</div>
              <div class="card-value" :style="{ color: card.color }">
                {{ card.value }}
                <span class="card-unit">{{ card.unit }}</span>
              </div>
              <div class="card-trend" :class="card.trend > 0 ? 'up' : 'down'">
                <el-icon v-if="card.trend > 0"><ArrowUp /></el-icon>
                <el-icon v-else><ArrowDown /></el-icon>
                {{ Math.abs(card.trend) }}%
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="chart-row">
      <!-- 内存使用图表 -->
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>内存使用趋势</span>
              <el-radio-group v-model="timeRange" size="small">
                <el-radio-button label="1h">1小时</el-radio-button>
                <el-radio-button label="6h">6小时</el-radio-button>
                <el-radio-button label="24h">24小时</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <v-chart class="chart" :option="memoryChartOption" autoresize />
        </el-card>
      </el-col>

      <!-- 请求成功率图表 -->
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>请求成功率</span>
              <el-tag :type="successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'danger'">
                {{ successRate }}%
              </el-tag>
            </div>
          </template>
          <v-chart class="chart" :option="successRateChartOption" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="chart-row">
      <!-- 请求延迟分布 -->
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>请求延迟分布</span>
            </div>
          </template>
          <v-chart class="chart" :option="latencyChartOption" autoresize />
        </el-card>
      </el-col>

      <!-- 任务执行统计 -->
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span>任务执行统计</span>
            </div>
          </template>
          <v-chart class="chart" :option="taskChartOption" autoresize />
        </el-card>
      </el-col>
    </el-row>

    <!-- 实时监控表格 -->
    <el-row class="table-row">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>实时监控指标</span>
              <el-button type="primary" size="small" @click="refreshData">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>
          <el-table :data="metricsData" style="width: 100%" v-loading="loading">
            <el-table-column prop="metric" label="指标" width="200">
              <template #default="{ row }">
                <el-icon class="metric-icon">
                  <component :is="row.icon" />
                </el-icon>
                {{ row.metric }}
              </template>
            </el-table-column>
            <el-table-column prop="current" label="当前值" width="150">
              <template #default="{ row }">
                <span :class="getValueClass(row)">{{ row.current }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="average" label="平均值" width="150" />
            <el-table-column prop="peak" label="峰值" width="150" />
            <el-table-column prop="min" label="最小值" width="150" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status" size="small">{{ getStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="trend" label="趋势">
              <template #default="{ row }">
                <div class="trend-bar">
                  <el-progress 
                    :percentage="row.trend" 
                    :color="getTrendColor(row.trend)"
                    :show-text="false"
                    :stroke-width="8"
                  />
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 告警配置 -->
    <el-row class="alert-row">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>告警阈值配置</span>
              <el-button type="primary" size="small" @click="saveAlertConfig">
                保存配置
              </el-button>
            </div>
          </template>
          <el-form :model="alertConfig" label-width="180px">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="内存使用率告警阈值">
                  <el-slider v-model="alertConfig.memoryThreshold" :max="100" show-input />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="请求延迟告警阈值(ms)">
                  <el-input-number v-model="alertConfig.latencyThreshold" :min="100" :max="10000" :step="100" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="成功率告警阈值(%)">
                  <el-slider v-model="alertConfig.successRateThreshold" :max="100" show-input />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { 
  Cpu, 
  Memo, 
  Timer, 
  TrendCharts,
  ArrowUp,
  ArrowDown,
  Refresh,
  Warning,
  CircleCheck
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 注册 ECharts 组件
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent
])

// 状态
const loading = ref(false)
const timeRange = ref('1h')
const successRate = ref(95)

// 概览卡片数据
const overviewCards = ref([
  { title: '内存使用', value: 256, unit: 'MB', trend: -5, color: '#409EFF', icon: 'Memo' },
  { title: 'CPU占用', value: 12, unit: '%', trend: 2, color: '#67C23A', icon: 'Cpu' },
  { title: '平均延迟', value: 150, unit: 'ms', trend: -8, color: '#E6A23C', icon: 'Timer' },
  { title: '请求总数', value: 12580, unit: '', trend: 15, color: '#F56C6C', icon: 'TrendCharts' }
])

// 监控指标数据
const metricsData = ref([
  { metric: '堆内存使用', icon: 'Memo', current: '156 MB', average: '142 MB', peak: '280 MB', min: '98 MB', status: 'success', trend: 65 },
  { metric: 'RSS内存', icon: 'Memo', current: '256 MB', average: '240 MB', peak: '320 MB', min: '180 MB', status: 'success', trend: 72 },
  { metric: '请求成功率', icon: 'CircleCheck', current: '95.2%', average: '93.8%', peak: '98.5%', min: '89.2%', status: 'success', trend: 95 },
  { metric: '平均延迟', icon: 'Timer', current: '150ms', average: '165ms', peak: '450ms', min: '80ms', status: 'warning', trend: 45 },
  { metric: '并发请求数', icon: 'TrendCharts', current: '12', average: '8', peak: '25', min: '1', status: 'success', trend: 48 },
  { metric: '错误率', icon: 'Warning', current: '0.8%', average: '1.2%', peak: '5.5%', min: '0.1%', status: 'success', trend: 15 }
])

// 告警配置
const alertConfig = ref({
  memoryThreshold: 80,
  latencyThreshold: 500,
  successRateThreshold: 90
})

// 内存使用图表配置
const memoryChartOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross' }
  },
  legend: {
    data: ['堆内存', 'RSS内存']
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: generateTimeLabels()
  },
  yAxis: {
    type: 'value',
    name: 'MB',
    axisLabel: {
      formatter: '{value} MB'
    }
  },
  series: [
    {
      name: '堆内存',
      type: 'line',
      smooth: true,
      data: generateRandomData(100, 200, 20),
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
            { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
          ]
        }
      },
      lineStyle: { color: '#409EFF' },
      itemStyle: { color: '#409EFF' }
    },
    {
      name: 'RSS内存',
      type: 'line',
      smooth: true,
      data: generateRandomData(200, 300, 20),
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
          ]
        }
      },
      lineStyle: { color: '#67C23A' },
      itemStyle: { color: '#67C23A' }
    }
  ]
}))

// 成功率图表配置
const successRateChartOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    formatter: '{b}: {c}%'
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: generateTimeLabels(10)
  },
  yAxis: {
    type: 'value',
    min: 80,
    max: 100,
    axisLabel: {
      formatter: '{value}%'
    }
  },
  series: [{
    type: 'bar',
    data: generateRandomData(85, 99, 10),
    itemStyle: {
      color: (params) => {
        const value = params.value
        if (value >= 95) return '#67C23A'
        if (value >= 85) return '#E6A23C'
        return '#F56C6C'
      },
      borderRadius: [4, 4, 0, 0]
    }
  }]
}))

// 延迟分布图表配置
const latencyChartOption = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)'
  },
  legend: {
    orient: 'vertical',
    left: 'left'
  },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    avoidLabelOverlap: false,
    itemStyle: {
      borderRadius: 10,
      borderColor: '#fff',
      borderWidth: 2
    },
    label: {
      show: true,
      formatter: '{b}\n{c}次'
    },
    data: [
      { value: 450, name: '< 100ms', itemStyle: { color: '#67C23A' } },
      { value: 320, name: '100-300ms', itemStyle: { color: '#409EFF' } },
      { value: 180, name: '300-500ms', itemStyle: { color: '#E6A23C' } },
      { value: 50, name: '> 500ms', itemStyle: { color: '#F56C6C' } }
    ]
  }]
}))

// 任务统计图表配置
const taskChartOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' }
  },
  legend: {
    data: ['成功', '失败']
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00']
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      name: '成功',
      type: 'bar',
      stack: 'total',
      data: [120, 80, 150, 200, 180, 250, 100],
      itemStyle: { color: '#67C23A' }
    },
    {
      name: '失败',
      type: 'bar',
      stack: 'total',
      data: [10, 5, 15, 20, 12, 25, 8],
      itemStyle: { color: '#F56C6C' }
    }
  ]
}))

// 生成时间标签
function generateTimeLabels(count = 20) {
  const labels = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5 * 60000)
    labels.push(time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0'))
  }
  return labels
}

// 生成随机数据
function generateRandomData(min, max, count) {
  return Array.from({ length: count }, () => 
    Math.floor(Math.random() * (max - min + 1)) + min
  )
}

// 获取数值样式
const getValueClass = (row) => {
  if (row.metric.includes('内存') && parseInt(row.current) > 200) return 'warning-text'
  if (row.metric.includes('延迟') && parseInt(row.current) > 300) return 'warning-text'
  if (row.metric.includes('成功率') && parseFloat(row.current) < 90) return 'danger-text'
  return ''
}

// 获取状态文本
const getStatusText = (status) => {
  const map = { success: '正常', warning: '警告', danger: '异常' }
  return map[status] || status
}

// 获取趋势颜色
const getTrendColor = (trend) => {
  if (trend >= 80) return '#67C23A'
  if (trend >= 50) return '#E6A23C'
  return '#F56C6C'
}

// 刷新数据
const refreshData = async () => {
  loading.value = true
  try {
    // 模拟数据刷新
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 更新概览卡片
    overviewCards.value.forEach(card => {
      if (card.title === '内存使用') card.value = Math.floor(Math.random() * 100) + 200
      if (card.title === 'CPU占用') card.value = Math.floor(Math.random() * 30) + 5
      if (card.title === '平均延迟') card.value = Math.floor(Math.random() * 200) + 50
      if (card.title === '请求总数') card.value += Math.floor(Math.random() * 50)
    })
    
    ElMessage.success('数据已刷新')
  } finally {
    loading.value = false
  }
}

// 保存告警配置
const saveAlertConfig = () => {
  ElMessage.success('告警配置已保存')
}

// 定时刷新
let refreshInterval

onMounted(() => {
  refreshInterval = setInterval(() => {
    // 自动刷新数据
    overviewCards.value.forEach(card => {
      if (card.title === '内存使用') {
        const change = (Math.random() - 0.5) * 10
        card.value = Math.max(100, Math.min(400, card.value + change))
      }
    })
  }, 5000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.performance-page {
  padding-bottom: 20px;
}

.overview-card {
  margin-bottom: 20px;
}

.card-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.card-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-info {
  flex: 1;
}

.card-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.card-value {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 4px;
}

.card-unit {
  font-size: 14px;
  font-weight: normal;
  margin-left: 4px;
}

.card-trend {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.card-trend.up {
  color: #67C23A;
}

.card-trend.down {
  color: #F56C6C;
}

.chart-row {
  margin-top: 10px;
}

.chart-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart {
  height: 300px;
}

.table-row {
  margin-top: 10px;
}

.metric-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.warning-text {
  color: #E6A23C;
  font-weight: 600;
}

.danger-text {
  color: #F56C6C;
  font-weight: 600;
}

.trend-bar {
  width: 100%;
}

.alert-row {
  margin-top: 20px;
}
</style>
