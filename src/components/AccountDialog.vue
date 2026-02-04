<template>
  <el-dialog
    :title="isEdit ? '编辑账号' : '添加账号'"
    v-model="visible"
    width="600px"
    :close-on-click-modal="false"
  >
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
      <el-form-item label="账号名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入账号名称" />
      </el-form-item>
      
      <el-form-item label="用户ID (PDDUID)" prop="pdduid">
        <el-input v-model="form.pdduid" placeholder="请输入PDDUID" />
      </el-form-item>
      
      <el-form-item label="Cookie" prop="cookie">
        <el-input
          v-model="form.cookie"
          type="textarea"
          :rows="3"
          placeholder="请输入Cookie"
        />
      </el-form-item>
      
      <el-form-item label="User-Agent">
        <el-input
          v-model="form.userAgent"
          type="textarea"
          :rows="2"
          placeholder="请输入User-Agent"
        />
      </el-form-item>
      
      <el-form-item label="Anti-Content">
        <el-input v-model="form.antiContent" placeholder="请输入Anti-Content" />
      </el-form-item>
      
      <el-form-item label="默认地址ID">
        <el-input v-model="form.defaultAddressId" placeholder="请输入默认地址ID" />
      </el-form-item>
      
      <el-form-item label="默认拼团ID">
        <el-input v-model="form.defaultGroupId" placeholder="请输入默认拼团ID" />
      </el-form-item>
      
      <el-form-item label="默认活动ID">
        <el-input v-model="form.defaultActivityId" placeholder="请输入默认活动ID" />
      </el-form-item>
      
      <el-form-item label="请求设置">
        <el-row :gutter="10">
          <el-col :span="8">
            <el-input-number v-model="form.requestSettings.requestCount" :min="1" :max="50" label="请求次数" />
          </el-col>
          <el-col :span="8">
            <el-input-number v-model="form.requestSettings.requestInterval" :min="0" :max="5000" label="间隔(ms)" />
          </el-col>
          <el-col :span="8">
            <el-input-number v-model="form.requestSettings.maxRequestTime" :min="1000" :max="60000" label="最大时间(ms)" />
          </el-col>
        </el-row>
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
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: Boolean,
  account: Object
})

const emit = defineEmits(['update:modelValue', 'submit'])

const visible = ref(false)
const formRef = ref(null)
const submitting = ref(false)
const isEdit = ref(false)

const form = reactive({
  id: '',
  name: '',
  pdduid: '',
  cookie: '',
  userAgent: '',
  antiContent: '',
  defaultAddressId: '',
  defaultGroupId: '',
  defaultActivityId: '',
  requestSettings: {
    requestCount: 10,
    requestInterval: 100,
    maxRequestTime: 5000
  },
  enabled: true
})

const rules = {
  name: [{ required: true, message: '请输入账号名称', trigger: 'blur' }],
  pdduid: [{ required: true, message: '请输入PDDUID', trigger: 'blur' }],
  cookie: [{ required: true, message: '请输入Cookie', trigger: 'blur' }]
}

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val && props.account) {
    isEdit.value = true
    Object.assign(form, props.account)
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
  form.name = ''
  form.pdduid = ''
  form.cookie = ''
  form.userAgent = ''
  form.antiContent = ''
  form.defaultAddressId = ''
  form.defaultGroupId = ''
  form.defaultActivityId = ''
  form.requestSettings = {
    requestCount: 10,
    requestInterval: 100,
    maxRequestTime: 5000
  }
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
