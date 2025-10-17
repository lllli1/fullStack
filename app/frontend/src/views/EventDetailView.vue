<template>
  <div class="event-detail-container" v-if="event">
    <h2>{{ event.name }}</h2>
    <p><strong>描述:</strong> {{ event.description }}</p>
    <p><strong>地点:</strong> {{ event.location }}</p>
    <p><strong>开始:</strong> {{ formatTime(event.start) }}</p>
    <p><strong>报名截止:</strong> {{ formatTime(event.close_registration) }}</p>
    <p><strong>最大参与者:</strong> {{ event.max_attendees }}</p>
    <p><strong>当前参与:</strong> {{ event.number_attending }}</p>
    <el-button v-if="canJoin" type="primary" @click="joinEvent">参加</el-button>
    <el-button v-if="isCreator" type="danger" @click="deleteEvent">删除</el-button>
    <router-link v-if="isCreator" :to="`/event/${event.event_id}/edit`" style="margin-left: 10px">
      编辑
    </router-link>

    <h3>问题列表</h3>
    <el-table :data="event.questions" stripe>
      <el-table-column prop="question" label="问题" />
      <el-table-column prop="votes" label="投票" />
      <el-table-column label="操作">
        <template #default="scope">
          <el-button size="small" @click="vote(scope.row.question_id, true)">赞成</el-button>
          <el-button size="small" @click="vote(scope.row.question_id, false)">反对</el-button>
          <el-button
            size="small"
            v-if="canDeleteQuestion(scope.row)"
            type="danger"
            @click="deleteQuestion(scope.row.question_id)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-form inline class="question-form">
      <el-form-item>
        <el-input v-model="newQuestion" placeholder="提出问题" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="askQuestion">提问</el-button>
      </el-form-item>
    </el-form>

    <h3 v-if="isCreator">参与者</h3>
    <el-table v-if="isCreator" :data="event.attendees" stripe>
      <el-table-column prop="first_name" label="名" />
      <el-table-column prop="last_name" label="姓" />
      <el-table-column prop="email" label="邮箱" />
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import api from '../utils/api';
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const event = ref(null);
const newQuestion = ref('');

const isCreator = computed(() => event.value?.creator.creator_id === authStore.user?.id);
const canJoin = computed(() => !isCreator.value);

const fetchEvent = async () => {
  try {
    const res = await api.get(`/event/${route.params.id}`);
    event.value = res.data;
  } catch (err) {
    ElMessage.error(err.response?.data?.error_message || '获取事件失败');
  }
};

const joinEvent = async () => {
  try {
    await api.post(`/event/${route.params.id}`);
    ElMessage.success('参加成功');
    fetchEvent();
  } catch (err) {
    ElMessage.error(err.response?.data?.error_message || '参加失败');
  }
};

const deleteEvent = async () => {
  try {
    await api.delete(`/event/${route.params.id}`);
    ElMessage.success('删除成功');
    router.push('/events');
  } catch (err) {
    ElMessage.error(err.response?.data?.error_message || '删除失败');
  }
};

const askQuestion = async () => {
  try {
    await api.post(`/event/${route.params.id}/question`, { question: newQuestion.value });
    newQuestion.value = '';
    ElMessage.success('提问成功');
    fetchEvent();
  } catch (err) {
    ElMessage.error(err.response?.data?.error_message || '提问失败');
  }
};

const vote = async (qid, up) => {
  try {
    if (up) {
      await api.post(`/question/${qid}/vote`);
      ElMessage.success('投票成功');
    } else {
      await api.delete(`/question/${qid}/vote`);
      ElMessage.success('反对投票成功');
    }
    fetchEvent();
  } catch (err) {
    ElMessage.error(err.response?.data?.error_message || '投票失败');
  }
};

const deleteQuestion = async (qid) => {
  try {
    await api.delete(`/question/${qid}`);
    ElMessage.success('删除问题成功');
    fetchEvent();
  } catch (err) {
    ElMessage.error(err.response?.data?.error_message || '删除失败');
  }
};

const canDeleteQuestion = (q) => {
  return q.asked_by?.user_id === authStore.user?.id || isCreator.value;
};

const formatTime = (time) => dayjs.unix(time).format('YYYY-MM-DD HH:mm');

onMounted(fetchEvent);
</script>

<style scoped>
.event-detail-container {
  max-width: 800px;
  margin: 40px auto;
  padding: 20px;
}
h2 {
  color: #409eff;
  margin-bottom: 20px;
}
p {
  margin: 10px 0;
}
.el-table {
  margin: 20px 0;
}
.question-form {
  margin-top: 20px;
}
</style>