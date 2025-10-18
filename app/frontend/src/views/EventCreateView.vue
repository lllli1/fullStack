<template>
  <div class="p-4 max-w-3xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">创建活动</h1>

    <div class="space-y-4">
      <div>
        <label class="block text-sm mb-1">名称</label>
        <input v-model="form.name" class="border rounded p-2 w-full" placeholder="活动名称" />
      </div>

      <div>
        <label class="block text-sm mb-1">描述</label>
        <textarea v-model="form.description" class="border rounded p-2 w-full" rows="4" placeholder="活动描述"></textarea>
      </div>

      <div>
        <label class="block text-sm mb-1">地点</label>
        <input v-model="form.location" class="border rounded p-2 w-full" placeholder="活动地点" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm mb-1">开始时间</label>
          <input v-model="startLocal" type="datetime-local" class="border rounded p-2 w-full" />
        </div>
        <div>
          <label class="block text-sm mb-1">报名截止</label>
          <input v-model="closeLocal" type="datetime-local" class="border rounded p-2 w-full" />
        </div>
      </div>

      <div>
        <label class="block text-sm mb-1">人数上限</label>
        <input v-model.number="form.max_attendees" type="number" min="1" class="border rounded p-2 w-full" />
      </div>

      <!-- 类别（可多选） -->
      <div>
        <label class="block text-sm mb-1">类别（可多选）</label>
        <select multiple v-model="selectedCategories" class="border rounded p-2 w-full" size="6">
          <option v-for="c in categoriesAll" :key="c.category_id" :value="c.category_id">
            {{ c.name }}
          </option>
        </select>
        <p class="text-xs text-gray-500 mt-1">按住 Ctrl / ⌘ 可多选；不选则创建为未分类。</p>
      </div>

      <div class="flex gap-3">
        <button :disabled="submitting" @click="submit" class="px-4 py-2 rounded bg-blue-600 text-white">
          {{ submitting ? '提交中…' : '创建' }}
        </button>
        <router-link to="/events" class="px-4 py-2 rounded border">返回列表</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';

const BASE = 'http://localhost:3333';
const token = localStorage.getItem('session_token') || '';
const headers = token ? { 'X-Authorization': token } : {};

const form = ref({
  name: '',
  description: '',
  location: '',
  start: 0,                 // 秒级
  close_registration: 0,    // 秒级
  max_attendees: 50
});

const startLocal = ref('');
const closeLocal = ref('');

// 本地时间 <-> 秒级时间戳
watch(startLocal, v => { form.value.start = v ? Math.floor(new Date(v).getTime() / 1000) : 0; });
watch(closeLocal, v => { form.value.close_registration = v ? Math.floor(new Date(v).getTime() / 1000) : 0; });

const categoriesAll = ref([]);      // [{category_id, name}]
const selectedCategories = ref([]); // number[]
const submitting = ref(false);

onMounted(async () => {
  // 拉取类别下拉
  const { data } = await axios.get(`${BASE}/categories`);
  categoriesAll.value = Array.isArray(data) ? data : [];
});

async function submit() {
  if (!form.value.name?.trim()) return alert('请填写活动名称');
  if (!form.value.start || !form.value.close_registration) return alert('请填写开始时间与报名截止');

  const payload = {
    name: form.value.name?.trim(),
    description: form.value.description?.trim() || '',
    location: form.value.location?.trim() || '',
    start: form.value.start,
    close_registration: form.value.close_registration,
    max_attendees: Number(form.value.max_attendees) || 1
  };

  // 仅当选择了数字 id 时传 categories，避免把 'undefined' 当字符串传给后端
  const cats = selectedCategories.value
    .map(n => Number(n))
    .filter(n => Number.isInteger(n) && n > 0);

  if (cats.length > 0) payload.categories = cats;

  try {
    submitting.value = true;
    await axios.post(`${BASE}/events`, payload, { headers });
    alert('创建成功');
    // 视具体路由调整
    window.location.href = '/events';
  } catch (e) {
    console.error(e);
    alert('创建失败');
  } finally {
    submitting.value = false;
  }
}
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