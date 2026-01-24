<script setup>
import { useProfileStore } from "@/stores/profile";
import { storeToRefs } from "pinia";
import HomeSidebar from "@/components/HomeSidebar.vue";
import { onMounted, ref } from "vue";
import { allowRequest } from '@/utils/requestThrottle'
import { useTodoStore } from "@/stores/todo";
import { useSidebarStore } from "@/stores/sidebar";

const profileStore = useProfileStore();
const todoStore = useTodoStore();
const { profile } = storeToRefs(profileStore);
const sidebarStore = useSidebarStore();

// 手动刷新相关状态
const isRefreshing = ref(false);
const refreshMessage = ref({ show: false, text: "", isError: false });
let messageTimer = null;

const showMessage = (text, isError = false) => {
    if (messageTimer) clearTimeout(messageTimer);
    refreshMessage.value = { show: true, text, isError };
    messageTimer = setTimeout(() => { refreshMessage.value.show = false }, 1500);
};

// 打字效果相关状态
const currentText = ref("");
const isTyping = ref(false);
const typingLines = [
  // 关联上个人资料中的名称字段
  `Hi there, I'm ${profile.value.name || 'Dango-F'}!`,
  "Focusing on Spatial Intelligence.",
  "Exploring Embodied Intelligence."
];

// 打字效果函数
const typeWriter = async () => {
  if (isTyping.value) return;
  isTyping.value = true;

  while (true) { // 无限循环
    for (let lineIndex = 0; lineIndex < typingLines.length; lineIndex++) {
      const line = typingLines[lineIndex];

      // 打字效果：逐字显示
      for (let i = 0; i < line.length; i++) {
        currentText.value += line[i];
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 退格效果：逐字删除
      for (let i = line.length; i > 0; i--) {
        currentText.value = currentText.value.slice(0, -1);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // 如果不是最后一行，等待一段时间再开始下一行
      if (lineIndex < typingLines.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 循环结束后等待一段时间再重新开始
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
};

// 手动刷新数据函数
const refreshData = async () => {
  if (isRefreshing.value) return;
  if (!allowRequest('home-refresh')) {
    showMessage('请勿频繁刷新（5秒内最多一次）', false);
    return;
  }
  isRefreshing.value = true;

  try {
    // 强刷新：profile + todos 均直接从后端拉取（跳过 localStorage 优先逻辑）
    const hasTodosLocal = !!localStorage.getItem('todos')
    // console.log('[手动刷新] 强刷新触发：local todos exists=', hasTodosLocal)
    const jobs = []
    if (profileStore.fetchProfile) jobs.push(profileStore.fetchProfile())
    if (todoStore.fetchTodos) jobs.push(todoStore.fetchTodos())
    await Promise.allSettled(jobs)

    // 强刷新后重置 30 分钟版本检查门（防止随后短时间内重复触发版本校验）
    try {
      const now = Date.now()
      // profile
      if (profileStore && profileStore.markVersionCheckedNow) {
        profileStore.markVersionCheckedNow()
      } else {
        localStorage.setItem('profile_last_version_check', String(now))
      }
      // todos
      if (todoStore && todoStore.markVersionCheckedNow) {
        todoStore.markVersionCheckedNow()
      } else {
        localStorage.setItem('todos_last_version_check', String(now))
      }
    } catch (e) {
      console.error('[手动刷新] 重置 30 分钟门失败:', e)
    }

    showMessage("数据刷新成功！", false);
  } catch (error) {
    showMessage(`刷新失败: ${error.message}`, true);
  } finally {
    isRefreshing.value = false;
  }
};

// 初始化
onMounted(async () => {
  // 启动打字效果
  typeWriter();
});

</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div
      class="grid grid-cols-1 md:grid-cols-4 gap-6"
      :class="{ 'md:grid-cols-[300px_1fr]': true }"
    >
      <!-- 侧边栏 - 主页使用特殊的永不折叠的侧边栏 -->
      <div>
        <HomeSidebar />
      </div>

      <!-- 主内容区 -->
      <div>
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">
            欢迎来到{{ profile.name }}的个人网站
          </h1>
          <button
            @click="refreshData"
            class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center cursor-pointer"
            :disabled="isRefreshing"
          >
            <svg
              v-if="isRefreshing"
              class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span v-else class="mr-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </span>
            刷新
          </button>
        </div>

        <!-- 刷新状态消息 -->
        <div v-if="refreshMessage.show" class="mb-4">
          <div
            :class="[
              'p-3 rounded-md',
              refreshMessage.isError
                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
            ]"
          >
            <div class="flex items-center">
              <svg
                v-if="refreshMessage.isError"
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{{ refreshMessage.text }}</span>
            </div>
          </div>
        </div>

        <!-- 最近文章 -->
        <section class="mb-10">
          <!-- 博客功能已移除，此区块不再展示 -->
        </section>

        <!-- GitHub README 风格展示 -->
        <section class="text-center">
          <!-- 动态打字效果标题 -->
          <div class="mb-8">
            <div class="text-4xl font-bold mb-2 h-16 flex items-center justify-center">
              <span class="text-github-blue">{{ currentText }}</span>
              <span v-if="isTyping" class="animate-pulse">|</span>
            </div>
            <p class="text-lg text-gray-800 dark:text-gray-200 mb-2">
              Master's Student in Computer Applied Technology
            </p>
            <p class="text-sm text-gray-700 dark:text-gray-300">
              University of Chinese Academy of Sciences (UCAS) - School of Engineering Science (ES)
            </p>
            <p class="text-sm text-gray-700 dark:text-gray-300 mt-1">
              Research Interests: Spatial Intelligence & Embodied Intelligence
            </p>
          </div>

          <!-- GitHub 统计卡片 -->
          <div class="flex flex-col md:flex-row justify-center items-center gap-4 mb-8">
            <img
              :src="`https://github-readme-stats.vercel.app/api?username=${profile.github_username || 'Dango-F'}&show_icons=true&theme=tokyonight&hide_border=true&bg_color=00000000`"
              class="h-48 rounded-lg shadow-lg"
              alt="GitHub Stats"
            />
            <img
              :src="`https://github-readme-stats.vercel.app/api/top-langs/?username=${profile.github_username || 'Dango-F'}&layout=compact&theme=tokyonight&hide_border=true&bg_color=00000000`"
              class="h-44 rounded-lg shadow-lg"
              alt="Top Languages"
            />
          </div>

          <!-- 技能徽章区域 -->
          <div class="mb-8">
            <h3 class="text-xl font-semibold mb-4">Tech Stack</h3>
            <div class="flex flex-wrap justify-center gap-2">
              <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
              <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch" />
              <img src="https://img.shields.io/badge/C%2B%2B-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white" alt="C++" />
              <img src="https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vue.js&logoColor=4FC08D" alt="Vue.js" />
            </div>
          </div>

          <!-- 贡献图动画 -->
          <div class="mb-8">
            <h3 class="text-xl font-semibold mb-4">Contribution</h3>
            <div class="flex justify-center">
              <picture class="max-w-full">
                <source
                  media="(prefers-color-scheme: dark)"
                  :srcset="`https://raw.githubusercontent.com/${profile.github_username || 'Dango-F'}/${profile.github_username || 'Dango-F'}/output/github-contribution-grid-snake-dark.svg`"
                />
                <source
                  media="(prefers-color-scheme: light)"
                  :srcset="`https://raw.githubusercontent.com/${profile.github_username || 'Dango-F'}/${profile.github_username || 'Dango-F'}/output/github-contribution-grid-snake.svg`"
                />
                <img
                  :src="`https://raw.githubusercontent.com/${profile.github_username || 'Dango-F'}/${profile.github_username || 'Dango-F'}/output/github-contribution-grid-snake.svg`"
                  alt="github contribution grid snake animation"
                  class="rounded-lg shadow-lg max-w-full h-auto"
                />
              </picture>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
