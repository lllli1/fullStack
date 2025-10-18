<template>
  <div class="p-4 max-w-3xl mx-auto" v-if="loaded">
    <h1 class="text-2xl font-bold mb-4">编辑活动</h1>

    <div class="space-y-4">
      <div>
        <label class="block text-sm mb-1">名称</label>
        <input v-model="name" class="border rounded p-2 w-full" />
      </div>

      <div>
        <label class="block text-sm mb-1">描述</label>
        <textarea v-model="description" class="border rounded p-2 w-full" rows="4"></textarea>
      </div>

      <div>
        <label class="block text-sm mb-1">地点</label>
        <input v-model="location" class="border rounded p-2 w-full" />
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
        <input v-model.number="max_attendees" type="number" min="1" class="border rounded p-2 w-full" />
      </div>

      <!-- 类别多选 -->
      <div>
        <label class="block text-sm mb-1">类别（可多选）</label>
        <select multiple v-model="selectedCategories" class="border rounded p-2 w-full" size="6">
          <option v-for="c in categoriesAll" :key="c.category_id" :value="c.category_id">
            {{ c.name }}
          </option>
        </select>
        <p class="text-xs text-gray-500 mt-1">
          想清空所有类别：保存时会把类别设置为空数组；<br />
          若不想修改类别，请在保存前勾掉“修改类别”开关。
        </p>
        <label class="inline-flex items-center gap-2 mt-2 text-sm">
          <input type="checkbox" v-model="willUpdateCategories" />
          修改类别
        </label>
      </div>

      <div class="flex gap-3">
        <button :disabled="saving" @click="save" class="px-4 py-2 rounded bg-blue-600 text-white">
          {{ saving ? '保存中…' : '保存' }}
        </button>
        <router-link :to="`/event/${id}`" class="px-4 py-2 rounded border">返回详情</router-link>
      </div>
    </div>
  </div>
  <div v-else class="p-4 text-gray-500">加载中…</div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const id = Number(route.params.id);

const BASE = 'http://localhost:3333';
const token = localStorage.getItem('session_token') || '';
const headers = token ? { 'X-Authorization': token } : {};

const loaded = ref(false);
const saving = ref(false);

// 基本字段
const name = ref('');
const description = ref('');
const location = ref('');
const max_attendees = ref(50);
const startLocal = ref('');
const closeLocal = ref('');
const startSec = ref(0);
const closeSec = ref(0);

// 时间本地 <-> 秒
watch(startLocal, v => { startSec.value = v ? Math.floor(new Date(v).getTime() / 1000) : 0; });
watch(closeLocal, v => { closeSec.value = v ? Math.floor(new Date(v).getTime() / 1000) : 0; });

// 类别
const categoriesAll = ref([]);       // 下拉可选
const selectedCategories = ref([]);  // number[]
const willUpdateCategories = ref(true);

onMounted(async () => {
  try {
    // 先拉类别
    const { data: catData } = await axios.get(`${BASE}/categories`);
    categoriesAll.value = Array.isArray(catData) ? catData : [];

    // 拉详情
    const { data } = await axios.get(`${BASE}/event/${id}`, { headers });
    name.value = data?.name || '';
    description.value = data?.description || '';
    location.value = data?.location || '';
    max_attendees.value = data?.max_attendees ?? 50;

    // 秒 -> 本地时间
    startLocal.value = data?.start ? new Date(data.start * 1000).toISOString().slice(0, 16) : '';
    closeLocal.value = data?.close_registration ? new Date(data.close_registration * 1000).toISOString().slice(0, 16) : '';

    // 预选类别（过滤掉 null）
    selectedCategories.value = (data?.categories || [])
      .map(c => c?.category_id)
      .filter(n => Number.isInteger(n) && n > 0);

    loaded.value = true;
  } catch (e) {
    console.error(e);
    alert('加载失败');
  }
});

async function save() {
  const payload = {};
  if (name.value?.trim()) payload.name = name.value.trim();
  if (description.value?.trim() !== undefined) payload.description = description.value.trim();
  if (location.value?.trim()) payload.location = location.value.trim();
  if (startSec.value) payload.start = startSec.value;
  if (closeSec.value) payload.close_registration = closeSec.value;
  if (Number.isFinite(max_attendees.value)) payload.max_attendees = Number(max_attendees.value);

  // 是否更新类别
  if (willUpdateCategories.value) {
    const cats = selectedCategories.value
      .map(n => Number(n))
      .filter(n => Number.isInteger(n) && n > 0);
    // 想清空就传 []，不想改就不带这个字段（把 willUpdateCategories 关掉）
    payload.categories = cats;
  }

  try {
    saving.value = true;
    await axios.patch(`${BASE}/event/${id}`, payload, { headers });
    alert('保存成功');
    window.location.href = `/event/${id}`;
  } catch (e) {
    console.error(e);
    alert('保存失败');
  } finally {
    saving.value = false;
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