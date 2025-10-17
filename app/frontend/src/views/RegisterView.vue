<template>
  <div class="form-container">
    <h2>注册</h2>
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
      <el-form-item label="名" prop="first_name">
        <el-input v-model="form.first_name" />
      </el-form-item>
      <el-form-item label="姓" prop="last_name">
        <el-input v-model="form.last_name" />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" type="email" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-button type="primary" @click="register" :loading="loading">注册</el-button>
    </el-form>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';

const authStore = useAuthStore();
const router = useRouter();
const formRef = ref(null);
const loading = ref(false);
const form = reactive({ first_name: '', last_name: '', email: '', password: '' });
const error = ref('');

const rules = {
  first_name: [{ required: true, message: '请输入名字', trigger: 'blur' }],
  last_name: [{ required: true, message: '请输入姓氏', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 36, message: '密码长度需为8-36位', trigger: ['blur', 'change'] },
    {
      pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,36}$/,
      message: '密码需包含大小写字母、数字和特殊字符',
      trigger: ['blur', 'change'],
    },
  ],
};

const register = async () => {
  try {
    loading.value = true;
    await formRef.value.validate();
    await authStore.register(form.first_name, form.last_name, form.email, form.password);
    ElMessage.success('注册成功，请登录');
    router.push('/login');
  } catch (err) {
    error.value = err;
    ElMessage.error(error.value);
  } finally {
    loading.value = false;
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
.error {
  color: red;
  text-align: center;
  margin-top: 10px;
}
</style>