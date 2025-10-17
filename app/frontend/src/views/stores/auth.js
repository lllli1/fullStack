import { defineStore } from 'pinia';
import axios from 'axios';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: null,
  }),
  actions: {
    async login(email, password) {
      try {
        const res = await axios.post('http://localhost:3333/login', { email, password });
        this.token = res.data.session_token;
        this.user = { id: res.data.user_id };
        localStorage.setItem('token', this.token);
      } catch (err) {
        throw err.response?.data?.error_message || '登录失败';
      }
    },
    async register(first_name, last_name, email, password) {
      try {
        await axios.post('http://localhost:3333/users', { first_name, last_name, email, password });
      } catch (err) {
        throw err.response?.data?.error_message || '注册失败';
      }
    },
    async logout() {
      try {
        await axios.post('http://localhost:3333/logout', {}, {
          headers: { 'X-Authorization': this.token },
        });
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
      } catch (err) {
        console.error('注销失败', err);
      }
    },
  },
});