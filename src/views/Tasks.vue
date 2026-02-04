<template>
  <div class="tasks-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>任务管理</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon>
              <Plus />
            </el-icon>
            添加任务
          </el-button>
        </div>
      </template>

      <el-table :data="tasks" v-loading="loading" stripe>
        <el-table-column prop="name" label="任务名称" min-width="120" />
        <el-table-column prop="goodsId" label="商品ID" min-width="100" />
        <el-table-column prop="skuId" label="SKU ID" min-width="100" />
        <el-table-column prop="quantity" label="数量" width="80" align="center" />
        <el-table-column prop="time" label="执行时间" width="120" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下次执行" width="180">
          <template #default="{ row }">
            <span v-if="row.nextRun">{{ formatTime(row.nextRun) }}</span>
            <span v-else class="text-gray">未安排</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">
              <el-icon>
                <Edit />
              </el-icon>
              编辑
            </el-button>
            <el-button type="success" size="small" @click="handleExecute(row)">
              <el-icon>
                <VideoPlay />
              </el-icon>
              执行
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">
              <el-icon>
                <Delete />
              </el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 任务对话框 -->
    <TaskDialog v-model="dialogVisible" :task="currentTask" :accounts="accounts" @submit="handleSubmit" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Plus, Edit, Delete, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TaskDialog from '../components/TaskDialog.vue'

const tasks = ref([])
const accounts = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const currentTask = ref(null)

const loadTasks = async () => {
  loading.value = true
  try {
    if (window.electronAPI?.getAllTasks) {
      const result = await window.electronAPI.getAllTasks()
      if (result.success) {
        tasks.value = result.tasks
      }
    }
  } catch (error) {
    ElMessage.error('加载任务失败')
  } finally {
    loading.value = false
  }
}

const loadAccounts = async () => {
  try {
    if (window.electronAPI?.getAllAccounts) {
      const result = await window.electronAPI.getAllAccounts()
      if (result.success) {
        accounts.value = result.accounts.filter(a => a.enabled)
      }
    }
  } catch (error) {
    console.error('加载账号失败', error)
  }
}

const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN')
}

const handleAdd = () => {
  currentTask.value = null
  dialogVisible.value = true
}

const handleEdit = (task) => {
  currentTask.value = task
  dialogVisible.value = true
}

const handleSubmit = async (formData) => {
  try {
    if (formData.isEdit) {
      const result = await window.electronAPI.updateTask(formData.accountId, formData.id, formData)
      if (result.success) {
        ElMessage.success('任务更新成功')
        loadTasks()
      } else {
        ElMessage.error(result.message || '更新失败')
      }
    } else {
      const result = await window.electronAPI.createTask(formData.accountId, formData)
      if (result.success) {
        ElMessage.success('任务创建成功')
        loadTasks()
      } else {
        ElMessage.error(result.message || '创建失败')
      }
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleExecute = async (task) => {
  try {
    await ElMessageBox.confirm(
      `确定要立即执行任务 "${task.name}" 吗？`,
      '确认执行',
      {
        type: 'info',
        confirmButtonText: '执行',
        cancelButtonText: '取消'
      }
    )

    const result = await window.electronAPI.executeTaskNow(task.accountId, task.id)
    if (result.success) {
      ElMessage.success('任务执行成功')
    } else {
      ElMessage.error(result.message || '执行失败')
    }
  } catch {
    // 取消执行
  }
}

const handleDelete = async (task) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除任务 "${task.name}" 吗？`,
      '确认删除',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )

    const result = await window.electronAPI.deleteTask(task.accountId, task.id)
    if (result.success) {
      ElMessage.success('删除成功')
      loadTasks()
    } else {
      ElMessage.error(result.message || '删除失败')
    }
  } catch {
    // 取消删除
  }
}

onMounted(() => {
  loadTasks()
  loadAccounts()
})
</script>

<style scoped>
.tasks-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-gray {
  color: #909399;
}
</style>