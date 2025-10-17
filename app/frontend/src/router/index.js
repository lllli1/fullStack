import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import EventListView from '../views/EventListView.vue';
import EventDetailView from '../views/EventDetailView.vue';
import EventCreateView from '../views/EventCreateView.vue';
import EventEditView from '../views/EventEditView.vue';

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/register', name: 'register', component: RegisterView },
  { path: '/events', name: 'events', component: EventListView },
  { path: '/event/:id', name: 'eventDetail', component: EventDetailView },
  { path: '/event/create', name: 'eventCreate', component: EventCreateView },
  { path: '/event/:id/edit', name: 'eventEdit', component: EventEditView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const publicPages = ['/login', '/register', '/'];
  const authRequired = !publicPages.includes(to.path);
  const loggedIn = localStorage.getItem('token');
  if (authRequired && !loggedIn) {
    next('/login');
  } else {
    next();
  }
});

export default router;