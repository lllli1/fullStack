<template>
  <div class="form-container">
    <h2>创建事件</h2>
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input v-model="form.description" type="textarea" />
      </el-form-item>
      <el-form-item label="地点" prop="location">
        <el-input v-model="form.location" />
      </el-form-item>
      <el-form-item label="开始时间" prop="start">
        <el-date-picker v-model="form.start" type="datetime" value-format="X" />
      </el-form-item>
      <el-form-item label="报名截止" prop="close_registration">
        <el-date-picker v-model="form.close_registration" type="datetime" value-format="X" />
      </el-form-item>
      <el-form-item label="最大参与者" prop="max_attendees">
        <el-input-number v-model="form.max_attendees" :min="1" />
      </el-form-item>
      <el-button type="primary" @click="createEvent">创建</el-button>
    </el-form>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import api from '../utils/api';
import { ElMessage } from 'element-plus';

const router = useRouter();
const formRef = ref(null);
const form = reactive({
  name: '',
  description: '',
  location: '',
  start: null,
  close_registration: null,
  max_attendees: 1,
});

const rules = {
  name: [{ required: true, message: '请输入事件名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入描述', trigger: 'blur' }],
  location: [{ required: true, message: '请输入地点', trigger: 'blur' }],
  start: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  close_registration: [{ required: true, message: '请选择报名截止时间', trigger: 'change' }],
  max_attendees: [{ required: true, message: '请输入最大参与者人数', trigger: 'change' }],
};

const createEvent = async () => {
  try {
    await formRef.value.validate();
    await api.post('/events', form);
    ElMessage.success('事件创建成功');
    router.push('/events');
  } catch (err) {
    ElMessage.error(err.response?.data?.error_message || '创建失败');
  }
};
</script>

<style scoped>
.form-container {
  max-width: 500px;
  margin: 40px auto;
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
}
h2 {
  text-align: center;
  color: #409eff;
  margin-bottom: 20px;
}
</style>