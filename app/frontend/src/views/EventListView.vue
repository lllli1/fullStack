<template>
  <div class="event-list-container">
    <h2>事件列表</h2>
    <el-form inline>
      <el-form-item>
        <el-input v-model="search.q" placeholder="搜索事件名" clearable />
      </el-form-item>
      <el-form-item>
        <el-select v-model="search.status" placeholder="状态" clearable>
          <el-option label="我的事件" value="MY_EVENTS" />
          <el-option label="参加的事件" value="ATTENDING" />
          <el-option label="开放事件" value="OPEN" />
          <el-option label="归档事件" value="ARCHIVE" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchEvents">搜索</el-button>
      </el-form-item>
    </el-form>
    <el-table :data="events" stripe>
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="location" label="地点" />
      <el-table-column prop="start" label="开始时间" :formatter="formatTime" />
      <el-table-column label="操作">
        <template #default="scope">
          <router-link :to="`/event/${scope.row.event_id}`">详情</router-link>
          <router-link
            v-if="scope.row.creator.creator_id === authStore.user?.id"
            :to="`/event/${scope.row.event_id}/edit`"
            style="margin-left: 10px"
          >
            编辑
          </router-link>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :page-size="search.limit"
      layout="prev, pager, next"
      :total="total"
      @current-change="fetchEvents"
      class="pagination"
    />
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import api from '../utils/api';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

const authStore = useAuthStore();
const events = ref([]);
const total = ref(0);
const page = ref(1);
const search = reactive({ q: '', status: '', limit: 20, offset: 0 });

const fetchEvents = async () => {
  try {
    search.offset = (page.value - 1) * search.limit;
    const params = { ...search };
    const res = await api.get('/search', { params });
    events.value = res.data.events || res.data;
    total.value = res.data.total || 0;
  } catch (err) {
    ElMessage.error(err.response?.data?.error_message || '获取事件失败');
  }
};

const formatTime = (row) => dayjs.unix(row.start).format('YYYY-MM-DD HH:mm');

fetchEvents();
</script>

<style scoped>
.event-list-container {
  max-width: 1200px;
  margin: 40px auto;
  padding: 20px;
}
h2 {
  color: #409eff;
  margin-bottom: 20px;
}
.el-table {
  margin-bottom: 20px;
}
.pagination {
  display: flex;
  justify-content: center;
}
</style>