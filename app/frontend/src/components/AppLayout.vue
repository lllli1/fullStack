<template>
  <el-container>
    <el-header>
      <el-menu mode="horizontal">
        <el-menu-item index="1"><router-link to="/">首页</router-link></el-menu-item>
        <el-menu-item index="2"><router-link to="/events">事件列表</router-link></el-menu-item>
        <el-menu-item index="3" v-if="isLoggedIn"><router-link to="/event/create">创建事件</router-link></el-menu-item>
        <el-menu-item index="4" v-if="!isLoggedIn"><router-link to="/login">登录</router-link></el-menu-item>
        <el-menu-item index="5" v-if="!isLoggedIn"><router-link to="/register">注册</router-link></el-menu-item>
        <el-menu-item index="6" v-if="isLoggedIn" @click="logout">注销</el-menu-item>
      </el-menu>
    </el-header>
    <el-main>
      <router-view></router-view>
    </el-main>
  </el-container>
</template>

<script setup>
import { computed } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const isLoggedIn = computed(() => !!authStore.token);

const logout = () => {
  authStore.logout();
  window.location.href = '/';
};
</script>