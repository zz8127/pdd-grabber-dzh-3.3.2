<template>
  <div class="accounts-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>账号管理</span>
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            添加账号
          </el-button>
        </div>
      </template>
      
      <el-table :data="accounts" v-loading="loading" stripe>
        <el-table-column prop="name" label="账号名称" min-width="120" />
        <el-table-column prop="pdduid" label="用户ID" min-width="100" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="统计" width="150" align="center">
          <template #default="{ row }">
            <el-tooltip content="成功/失败">
              <div class="stats">
                <span class="success">{{ row.statistics?.success || 0 }}</span>
                <span class="divider">/</span>
                <span class="fail">{{ row.statistics?.fail || 0 }}</span>
              </div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button-group>
              <el-button type="primary" size="small" @click="handleEdit(row)" title="编辑">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button type="success" size="small" @click="handleLogin(row)" title="登录">
                <el-icon><Key /></el-icon>
              </el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)" title="删除">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <!-- 账号对话框 -->
    <AccountDialog
      v-model="dialogVisible"
      :account="currentAccount"
      @submit="handleSubmit"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Plus, Edit, Delete, Key } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AccountDialog from '../components/AccountDialog.vue'

const accounts = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const currentAccount = ref(null)

const loadAccounts = async () => {
  loading.value = true
  try {
    if (window.electronAPI?.getAllAccounts) {
      const result = await window.electronAPI.getAllAccounts()
      if (result.success) {
        accounts.value = result.accounts
      }
    }
  } catch (error) {
    ElMessage.error('加载账号失败')
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  currentAccount.value = null
  dialogVisible.value = true
}

const handleEdit = (account) => {
  currentAccount.value = account
  dialogVisible.value = true
}

const handleSubmit = async (formData) => {
  try {
    if (formData.isEdit) {
      // 更新账号
      const result = await window.electronAPI.updateAccount(formData.id, formData)
      if (result.success) {
        ElMessage.success('账号更新成功')
        loadAccounts()
      } else {
        ElMessage.error(result.message || '更新失败')
      }
    } else {
      // 创建账号
      const result = await window.electronAPI.createAccount(formData)
      if (result.success) {
        ElMessage.success('账号创建成功')
        loadAccounts()
      } else {
        ElMessage.error(result.message || '创建失败')
      }
    }
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

const handleLogin = async (account) => {
  try {
    const result = await window.electronAPI.openLoginWindow(account.id)
    if (result.success) {
      ElMessage.success('登录窗口已打开')
    }
  } catch (error) {
    ElMessage.error('打开登录窗口失败')
  }
}

const handleDelete = async (account) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除账号 "${account.name}" 吗？`,
      '确认删除',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    )
    
    const result = await window.electronAPI.deleteAccount(account.id)
    if (result.success) {
      ElMessage.success('删除成功')
      loadAccounts()
    } else {
      ElMessage.error(result.message || '删除失败')
    }
  } catch {
    // 取消删除
  }
}

onMounted(() => {
  loadAccounts()
})
</script>

<style scoped>
.accounts-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.stats .success {
  color: #67C23A;
  font-weight: 600;
}

.stats .fail {
  color: #F56C6C;
  font-weight: 600;
}

.stats .divider {
  color: #909399;
}
</style>
