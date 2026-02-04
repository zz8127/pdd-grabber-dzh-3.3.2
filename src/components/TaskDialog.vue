<template>
  <el-dialog
    :title="isEdit ? '编辑任务' : '添加任务'"
    v-model="visible"
    width="550px"
    :close-on-click-modal="false"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
      <el-form-item label="任务名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入任务名称" />
      </el-form-item>
      
      <el-form-item label="所属账号" prop="accountId">
        <el-select v-model="form.accountId" placeholder="请选择账号" style="width: 100%">
          <el-option
            v-for="account in accounts"
            :key="account.id"
            :label="account.name"
            :value="account.id"
          />
        </el-select>
      </el-form-item>
      
      <el-form-item label="商品ID" prop="goodsId">
        <el-input v-model="form.goodsId" placeholder="请输入商品ID" />
      </el-form-item>
      
      <el-form-item label="SKU ID" prop="skuId">
        <el-input v-model="form.skuId" placeholder="请输入SKU ID" />
      </el-form-item>
      
      <el-form-item label="购买数量" prop="quantity">
        <el-input-number v-model="form.quantity" :min="1" :max="99" />
      </el-form-item>
      
      <el-form-item label="执行时间" prop="time">
        <el-time-picker
          v-model="form.time"
          placeholder="选择时间"
          format="HH:mm:ss.SSS"
          value-format="HH:mm:ss.SSS"
          style="width: 100%"
        />
      </el-form-item>
      
      <el-form-item label="启用状态">
        <el-switch v-model="form.enabled" />
      </el-form-item>
    </el-form>
    
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSubmit" :loading="submitting">
        {{ isEdit ? '保存' : '添加' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  task: Object,
  accounts: Array
})

const emit = defineEmits(['update:modelValue', 'submit'])

const visible = ref(false)
const formRef = ref(null)
const submitting = ref(false)
const isEdit = ref(false)

const form = reactive({
  id: '',
  accountId: '',
  name: '',
  goodsId: '',
  skuId: '',
  quantity: 1,
  time: '',
  enabled: true
})

const rules = {
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  accountId: [{ required: true, message: '请选择账号', trigger: 'change' }],
  goodsId: [{ required: true, message: '请输入商品ID', trigger: 'blur' }],
  skuId: [{ required: true, message: '请输入SKU ID', trigger: 'blur' }],
  time: [{ required: true, message: '请选择执行时间', trigger: 'change' }]
}

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val && props.task) {
    isEdit.value = true
    Object.assign(form, props.task)
  } else {
    isEdit.value = false
    resetForm()
  }
})

watch(() => visible.value, (val) => {
  emit('update:modelValue', val)
})

const resetForm = () => {
  form.id = ''
  form.accountId = ''
  form.name = ''
  form.goodsId = ''
  form.skuId = ''
  form.quantity = 1
  form.time = ''
  form.enabled = true
}

const handleSubmit = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  
  submitting.value = true
  try {
    emit('submit', { ...form, isEdit: isEdit.value })
    visible.value = false
  } finally {
    submitting.value = false
  }
}
</script>
