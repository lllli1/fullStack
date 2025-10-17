<template>
  <div class="form-container">
    <h2>登录</h2>
    <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" type="email" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-button type="primary" @click="login" :loading="loading">登录</el-button>
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
const form = reactive({ email: '', password: '' });
const error = ref('');

const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] },
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

const login = async () => {
  try {
    loading.value = true;
    await formRef.value.validate();
    await authStore.login(form.email, form.password);
    ElMessage.success('登录成功');
    router.push('/events');
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