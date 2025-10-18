<template>
  <div class="p-4 max-w-5xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">活动列表</h1>

    <!-- 筛选区 -->
    <div class="flex flex-wrap gap-3 items-center mb-4">
      <input v-model="q" class="border rounded p-2 flex-1 min-w-[220px]" placeholder="按名称搜索…" />

      <select v-model="status" class="border rounded p-2">
        <option value="">全部状态</option>
        <option value="OPEN">开放中</option>
        <option value="MY_EVENTS">我创建的</option>
        <option value="ATTENDING">我报名的</option>
        <option value="ARCHIVE">已归档</option>
      </select>

      <!-- 类别筛选 -->
      <select v-model="categoryId" class="border rounded p-2">
        <option :value="null">全部类别</option>
        <option v-for="c in categoriesAll" :key="c.category_id" :value="c.category_id">
          {{ c.name }}
        </option>
      </select>

      <button @click="runSearch" class="px-3 py-2 rounded bg-blue-600 text-white">搜索</button>
    </div>

    <!-- 列表 -->
    <ul>
      <li v-for="e in events" :key="e.event_id" class="border-b py-3">
        <div class="flex items-center justify-between">
          <router-link :to="`/event/${e.event_id}`" class="font-medium hover:underline">
            {{ e.name }}
          </router-link>
          <div class="text-xs text-gray-500">{{ ts(e.start) }}</div>
        </div>
        <div class="text-sm text-gray-600">{{ e.location }}</div>
        <!-- 注意：/search 不返回 categories，别在列表上显示类别；详情页展示 -->
      </li>
    </ul>

    <!-- 翻页（可选） -->
    <div class="mt-4 flex items-center gap-2">
      <button class="px-3 py-2 border rounded" :disabled="offset === 0" @click="prev">上一页</button>
      <button class="px-3 py-2 border rounded" :disabled="events.length < limit" @click="next">下一页</button>
      <span class="text-sm text-gray-500">每页 {{ limit }} 条</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const BASE = 'http://localhost:3333';
const token = localStorage.getItem('session_token') || '';
const headers = token ? { 'X-Authorization': token } : {};

const q = ref('');
const status = ref('');
const categoryId = ref(null); // number | null
const categoriesAll = ref([]);

const limit = ref(20);
const offset = ref(0);
const events = ref([]);

onMounted(async () => {
  // 拉类别
  const { data } = await axios.get(`${BASE}/categories`);
  categoriesAll.value = Array.isArray(data) ? data : [];
  await runSearch();
});

async function runSearch() {
  const params = { limit: limit.value, offset: offset.value };
  if (q.value) params.q = q.value;
  if (status.value) params.status = status.value;

  // 仅在选择具体数字 id 时才加上 category，避免传 'undefined'
  if (typeof categoryId.value === 'number') {
    params.category = categoryId.value;
  }

  try {
    const { data } = await axios.get(`${BASE}/search`, { params, headers });
    events.value = Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(e);
    alert('搜索失败');
  }
}

function next() {
  offset.value += limit.value;
  runSearch();
}
function prev() {
  offset.value = Math.max(0, offset.value - limit.value);
  runSearch();
}

function ts(sec) {
  if (!sec) return '-';
  try {
    return new Date(sec * 1000).toLocaleString();
  } catch {
    return '-';
  }
}
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