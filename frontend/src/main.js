import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useProfileStore } from './stores/profile'
import { useTodoStore } from './stores/todo'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)

// 使用 store 前需要先安装 pinia 到 app
const profileStore = useProfileStore()
const todoStore = useTodoStore()

// 初始化本地缓存并异步校验版本（不阻塞渲染）
profileStore.initFromLocal && profileStore.initFromLocal()
todoStore.initFromLocal && todoStore.initFromLocal()

app.mount('#app')
