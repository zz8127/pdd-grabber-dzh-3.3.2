<template>
  <div class="quick-buy-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>快速抢购</span>
          <el-tag type="warning">立即执行模式</el-tag>
        </div>
      </template>
      
      <el-form :model="form" label-width="120px">
        <el-form-item label="选择账号">
          <el-select v-model="form.accountId" placeholder="请选择账号" style="width: 300px">
            <el-option 
              v-for="account in accounts" 
              :key="account.id" 
              :label="account.name" 
              :value="account.id" 
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="商品ID">
          <el-input v-model="form.goodsId" placeholder="请输入商品ID" style="width: 300px" />
        </el-form-item>
        
        <el-form-item label="SKU ID">
          <el-input v-model="form.skuId" placeholder="请输入SKU ID" style="width: 300px" />
        </el-form-item>
        
        <el-form-item label="购买数量">
          <el-input-number v-model="form.quantity" :min="1" :max="99" />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" size="large" @click="startQuickBuy" :loading="loading">
            <el-icon><Lightning /></el-icon>
            立即抢购
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Lightning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const accounts = ref([])
const loading = ref(false)

const form = ref({
  accountId: '',
  goodsId: '',
  skuId: '',
  quantity: 1
})

const loadAccounts = async () => {
  if (window.electronAPI?.getAllAccounts) {
    const result = await window.electronAPI.getAllAccounts()
    if (result.success) {
      accounts.value = result.accounts.filter(a => a.enabled)
    }
  }
}

const startQuickBuy = async () => {
  if (!form.value.accountId || !form.value.goodsId) {
    ElMessage.warning('请填写完整信息')
    return
  }
  
  loading.value = true
  try {
    if (window.electronAPI?.quickBuy) {
      const result = await window.electronAPI.quickBuy(form.value)
      if (result.success) {
        ElMessage.success('抢购成功！')
      } else {
        ElMessage.error(result.message || '抢购失败')
      }
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAccounts()
})
</script>

<style scoped>
.quick-buy-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
