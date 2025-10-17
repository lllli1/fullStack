<template>
  <div class="home-container">
    <h1>欢迎来到事件管理系统</h1>
    <p>请登录或注册以管理您的活动，或浏览公开事件。</p>
    <el-button type="primary" v-if="!isLoggedIn" @click="$router.push('/register')">立即注册</el-button>
    <el-button type="info" v-if="!isLoggedIn" @click="$router.push('/login')">登录</el-button>
    <el-button type="success" v-if="isLoggedIn" @click="$router.push('/events')">查看事件</el-button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const isLoggedIn = computed(() => !!authStore.token);
</script>

<style scoped>
.home-container {
  text-align: center;
  padding: 40px;
}
h1 {
  color: #409eff;
  margin-bottom: 20px;
}
p {
  font-size: 16px;
  margin-bottom: 20px;
}
.el-button {
  margin: 0 10px;
}
</style>