import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import FileToolsView from '../views/FileToolsView.vue'
import NotesView from '../views/NotesView.vue'
import SettingsView from '../views/SettingsView.vue'
import AboutView from '../views/AboutView.vue'

const routes = [
  { path: '/', component: DashboardView },
  { path: '/file-tools', component: FileToolsView },
  { path: '/notes', component: NotesView },
  { path: '/settings', component: SettingsView },
  { path: '/about', component: AboutView },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router