<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { allowRequest } from '@/utils/requestThrottle'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores/project'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import { useConfigStore } from '@/stores/config'
import ProfileSidebar from '@/components/ProfileSidebar.vue'
import RepoCard from '@/components/RepoCard.vue'
import { useSidebarStore } from '@/stores/sidebar'
import axios from 'axios'

const projectStore = useProjectStore()
const profileStore = useProfileStore()
const authStore = useAuthStore()
const configStore = useConfigStore()
const { profile } = storeToRefs(profileStore)
const tagFilter = ref('')
const languageFilter = ref('')
const searchQuery = ref('')
// 使用 ref 存储 GitHub 用户名,允许用户临时修改
const githubUsername = ref(profile.value.github_username)
const githubToken = ref('')
const showTokenInput = ref(false)
const hasConfiguredToken = ref(false)
const isEditingToken = ref(false)
const sidebarStore = useSidebarStore()
const isCollapsed = computed(() => sidebarStore.isCollapsed)
const isLoadingToken = ref(false)
const isLoadingProjects = ref(false)
const isPreheating = ref(!!(typeof window !== 'undefined' && window.__DATA_PREHEATING))
const isRefreshing = ref(false)
const refreshMessage = ref({ show: false, text: "", isError: false })
let messageTimer = null
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const showMessage = (text, isError = false) => {
    if (messageTimer) clearTimeout(messageTimer)
    refreshMessage.value = { show: true, text, isError }
    messageTimer = setTimeout(() => { refreshMessage.value.show = false }, 1500)
}

// 监听全局预热状态变化
if (typeof window !== 'undefined') {
    const checkPreheating = () => {
        isPreheating.value = !!(window.__DATA_PREHEATING)
    }
    // 使用定时器监听（简单粗暴但有效）
    const preheatingTimer = setInterval(checkPreheating, 100)
    onUnmounted(() => clearInterval(preheatingTimer))
}

// 计算最后更新时间的友好显示
const lastUpdateTime = computed(() => {
    if (!projectStore.lastFetchTime) return '未获取过数据'

    const lastFetch = new Date(parseInt(projectStore.lastFetchTime))
    const now = new Date()
    const diff = Math.floor((now - lastFetch) / 1000) // 差异秒数

    if (diff < 60) return '刚刚'
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`

    // 格式化日期
    return lastFetch.toLocaleString()
})

// 从 config store 加载 GitHub Token
const loadGitHubTokenFromServer = async () => {
    try {
        isLoadingToken.value = true;
        // 使用 config store 而不是直接调用 API
        await configStore.checkVersionAndUpdate()
        
        if (configStore.githubToken) {
            githubToken.value = configStore.githubToken;
            hasConfiguredToken.value = true;
            isEditingToken.value = false;
            
            // 智能加载：只在必要时才调用 API
            // 1. 没有缓存数据时，显示 loading
            // 2. 缓存已过期时，静默刷新
            if (projectStore.projects.length === 0) {
                isLoadingProjects.value = true;
                loadGitHubRepos().finally(() => isLoadingProjects.value = false);
            } else if (projectStore.shouldRefresh()) {
                // 缓存过期，静默刷新
                loadGitHubRepos();
            } else {
                // console.log('使用有效的缓存数据，最后更新于:', new Date(parseInt(projectStore.lastFetchTime)).toLocaleString())
            }
        }
    } catch (error) {
        console.error('加载 GitHub Token 失败:', error);
        hasConfiguredToken.value = false;
    } finally {
        isLoadingToken.value = false;
    }
};

// 将 GitHub Token 保存到服务器
const saveGitHubTokenToServer = async (token) => {
    try {
        // 使用 config store 的更新方法
        const success = await configStore.updateGithubToken(token)
        if (success) {
            githubToken.value = configStore.githubToken
            hasConfiguredToken.value = true;
            isEditingToken.value = false;
            // 保存成功后立即刷新
            await loadGitHubRepos();
        }
    } catch (error) {
        console.error('保存GitHub Token失败:', error);
    }
};

// 修改加载GitHub仓库函数（使用共享请求单例 + 5s 防抖）
const loadGitHubRepos = async () => {
    if (isRefreshing.value) return
    // allowRequest 内部默认 5000ms
    if (!allowRequest('projects-refresh')) {
        showMessage('请勿频繁刷新（5秒内最多一次）', false)
        return
    }

    isRefreshing.value = true
    try {
        if (githubUsername.value) {
            await projectStore.fetchGitHubRepos(githubUsername.value, githubToken.value, { useSharedPromise: true })
        }
        showMessage("数据加载成功！", false)
    } catch (error) {
        showMessage(`加载失败: ${error.message}`, true)
    } finally {
        isRefreshing.value = false
    }
}

// 强制刷新函数（赋予最高优先级，无视并发保护）
const forceRefreshGitHubRepos = async () => {
    if (isRefreshing.value) return;
    if (!allowRequest('projects-refresh')) {
        showMessage('请勿频繁刷新（5秒内最多一次）', false)
        return;
    }
    isRefreshing.value = true;

    try {
        if (githubUsername.value) {
            console.log("🔄 手动强制刷新项目数据...")
            await projectStore.forceRefreshGitHubRepos(githubUsername.value, githubToken.value)
            console.log("✅ 强制刷新完成")
        }
        showMessage("数据刷新成功！", false)
    } catch (error) {
        showMessage(`刷新失败: ${error.message}`, true)
    } finally {
        isRefreshing.value = false;
    }
}

// 应用GitHub Token
const applyGitHubToken = async () => {
    if (githubToken.value) {
        // 只保存到服务器，不保存到localStorage
        await saveGitHubTokenToServer(githubToken.value);
        showTokenInput.value = false;
    }
};

// 开始编辑新令牌
const startEditToken = () => {
    isEditingToken.value = true;
    githubToken.value = '';
};

// 取消编辑
const cancelEditToken = () => {
    isEditingToken.value = false;
    githubToken.value = '';
};

// 清除缓存并重新加载（已移除，功能合并到刷新按钮）

// 切换令牌输入框的显示/隐藏
const toggleTokenInput = () => {
    showTokenInput.value = !showTokenInput.value;
    isEditingToken.value = false;
    // 如果隐藏输入框，重新从服务器加载Token
    if (!showTokenInput.value) {
        loadGitHubTokenFromServer();
    }
}

const filteredProjects = computed(() => {
    let result = projectStore.projects

    // 按标签过滤
    if (tagFilter.value) {
        result = result.filter(project => project.tags.includes(tagFilter.value))
    }

    // 按语言过滤
    if (languageFilter.value) {
        result = result.filter(project => project.language === languageFilter.value)
    }

    // 按搜索查询过滤
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase().trim()
        result = result.filter(project =>
            project.name.toLowerCase().includes(query) ||
            project.description.toLowerCase().includes(query)
        )
    }

    // 按星标降序排序
    return result.slice().sort((a, b) => b.stars - a.stars)
})
// 分页：每页项目数
const itemsPerPage = 3
const currentPage = ref(1)

const totalPages = computed(() => {
    return Math.max(1, Math.ceil(filteredProjects.value.length / itemsPerPage))
})

const paginatedProjects = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage
    return filteredProjects.value.slice(start, start + itemsPerPage)
})

// 当过滤条件或数据变化时，确保页码有效并重置到第一页
watch([filteredProjects], () => {
    if (currentPage.value > totalPages.value) currentPage.value = totalPages.value
    // 如果当前不在第一页且过滤条件改变，回到第一页更符合用户预期
    if (currentPage.value !== 1) currentPage.value = 1
})

// 监听 profile.github_username 的变化,同步到本地 githubUsername
watch(() => profile.value.github_username, (newUsername) => {
    if (newUsername && newUsername !== githubUsername.value) {
        githubUsername.value = newUsername
    }
})

// 修改onMounted钩子
onMounted(async () => {
    // 先尝试从服务器加载令牌
    await loadGitHubTokenFromServer();
});

// 监听 configStore.githubToken 变化，及时更新本地状态
watch(() => configStore.githubToken, (newToken) => {
    if (newToken) {
        githubToken.value = newToken;
        hasConfiguredToken.value = true;
    } else {
        hasConfiguredToken.value = false;
    }
}, { immediate: true });
</script>

<template>
    <div class="container mx-auto px-4 py-6 md:py-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6"
            :class="{ 'md:grid-cols-[300px_1fr]': !isCollapsed, 'md:grid-cols-[auto_1fr]': isCollapsed }">
            <!-- 侧边栏 -->
            <div>
                <ProfileSidebar />
            </div>

            <!-- 主内容区 -->
            <div>
                <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
                    <h1 class="text-xl sm:text-2xl font-bold">项目</h1>

                    <!-- GitHub用户名输入 -->
                    <div class="flex flex-col gap-3 w-full sm:flex-row sm:flex-wrap sm:items-center">
                        <input v-model="githubUsername" type="text" placeholder="GitHub用户名"
                            class="w-full sm:w-56 md:w-64 p-2 min-h-[44px] border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]" />

                        <!-- 钥匙图标：所有用户可见；已登录用户可点击编辑/更新令牌 -->
                        <button v-if="authStore.isAuthenticated" @click="toggleTokenInput" type="button"
                            class="touch-target px-3 py-2 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-md border border-[var(--color-border)] hover:bg-gray-200 dark:hover:bg-gray-800"
                            :title="hasConfiguredToken ? 'GitHub访问令牌已配置（点击修改）' : 'GitHub访问令牌（未配置）'">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                                stroke="currentColor" :class="{ 'text-green-500': hasConfiguredToken }">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </button>

                        <!-- 未登录用户：显示静态状态图标（绿色表示已由管理员配置），不可交互 -->
                        <div v-else class="touch-target px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                            :title="hasConfiguredToken ? '管理员已配置 GitHub 访问令牌' : 'GitHub 访问令牌未配置'">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                                stroke="currentColor" :class="{ 'text-green-500': hasConfiguredToken }">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>

                        <button @click="forceRefreshGitHubRepos"
                            class="touch-target w-full sm:w-auto px-4 py-2 bg-github-blue text-white rounded-md hover:bg-blue-700 cursor-pointer"
                            :disabled="isRefreshing">
                            <span v-if="isRefreshing">刷新中...</span>
                            <span v-else>刷新</span>
                        </button>
                    </div>
                </div>

                <!-- 刷新状态消息 -->
                <div v-if="refreshMessage.show" class="mb-4">
                    <div
                        :class="[
                        'p-3 rounded-md',
                        refreshMessage.isError
                            ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        ]">
                        {{ refreshMessage.text }}
                    </div>
                </div>

                <!-- 最后更新时间 -->
                <div v-if="projectStore.lastFetchTime" class="text-sm text-github-gray mb-4 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>最后更新: {{ lastUpdateTime }}</span>
                </div>

                <!-- GitHub令牌输入框 -->
                <div v-if="showTokenInput"
                    class="mb-4 p-3 bg-[var(--color-bg-secondary)] rounded-md border border-[var(--color-border)]">
                    <div class="flex flex-col space-y-2">
                        <label for="github-token" class="text-sm font-medium">
                            GitHub访问令牌 <span class="text-xs text-gray-500">(解决API限制问题)</span>
                        </label>

                        <!-- 已配置令牌状态 -->
                        <div v-if="hasConfiguredToken && !isEditingToken" class="flex flex-col space-y-2">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-500 mr-2"
                                        viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd"
                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                            clip-rule="evenodd" />
                                    </svg>
                                    <span class="text-green-600 font-medium">GitHub令牌已配置</span>
                                </div>
                                <div class="flex gap-2">
                                    <button @click="startEditToken"
                                        class="touch-target px-4 py-2 text-sm bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-700">
                                        更新令牌
                                    </button>
                                </div>
                            </div>
                            <p class="text-xs text-gray-500">
                                令牌已安全地存储在服务器中。出于安全考虑，不会显示现有令牌的值。如需更改，请点击"更新令牌"按钮。
                            </p>
                        </div>

                        <!-- 令牌输入表单 -->
                        <div v-else class="flex flex-col space-y-2">
                                <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <input id="github-token" v-model="githubToken" type="password"
                                        placeholder="输入GitHub个人访问令牌"
                                    class="w-full sm:flex-1 p-2 min-h-[44px] border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]" />
                                    <button @click="applyGitHubToken"
                                    class="touch-target w-full sm:w-auto px-4 py-2 bg-github-blue text-white rounded-md hover:bg-blue-700">
                                    应用
                                    </button>
                                    <button v-if="isEditingToken" @click="cancelEditToken"
                                    class="touch-target w-full sm:w-auto px-4 py-2 text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
                                    取消
                                    </button>
                                </div>
                            <p class="text-xs text-gray-500">
                                如果遇到API限制错误，请<a href="https://github.com/settings/tokens" target="_blank"
                                    class="text-github-blue hover:underline">创建个人访问令牌</a>（无需勾选任何权限）。令牌将安全存储在服务器中。
                            </p>
                        </div>
                    </div>
                </div>

                <!-- 错误提示 -->
                <p v-if="projectStore.error" class="mt-2 text-red-500 text-sm mb-4">
                    {{ projectStore.error }}
                </p>

                <!-- 加载状态（包括预热期间显示） -->
                <div v-if="projectStore.loading || isLoadingProjects || (isPreheating && projectStore.projects.length === 0)" class="flex justify-center my-10">
                    <div class="animate-spin h-8 w-8 border-4 border-github-blue border-t-transparent rounded-full">
                    </div>
                </div>

                <!-- 提示用户加载数据 -->
                    <div v-else-if="!isPreheating && (isLoadingProjects || (projectStore.projects.length === 0 && !projectStore.lastFetchTime))"
                    class="text-center py-10">
                    <p class="text-github-gray mb-4">尚未加载任何项目数据</p>
                    <button @click="loadGitHubRepos"
                        class="touch-target px-4 py-2 bg-github-blue text-white rounded-md hover:bg-blue-700 cursor-pointer"
                        :disabled="isRefreshing">
                        从GitHub获取仓库
                    </button>
                </div>

                <!-- 过滤器和搜索 -->
                <div v-else-if="projectStore.projects.length > 0" class="mb-6 flex flex-col space-y-4">
                    <input v-model="searchQuery" type="text" placeholder="搜索项目..."
                        class="p-2 min-h-[44px] w-full border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]" />

                    <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <div class="w-full sm:w-auto">
                            <select v-model="languageFilter"
                                class="w-full sm:w-auto p-2 min-h-[44px] border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]">
                                <option value="">所有语言</option>
                                <option v-for="language in projectStore.languages" :key="language" :value="language">
                                    {{ language }}
                                </option>
                            </select>
                        </div>

                        <div class="w-full sm:w-auto">
                            <select v-model="tagFilter"
                                class="w-full sm:w-auto p-2 min-h-[44px] border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]">
                                <option value="">所有标签</option>
                                <option v-for="tag in projectStore.tags" :key="tag" :value="tag">
                                    {{ tag }}
                                </option>
                            </select>
                        </div>

                        <button v-if="languageFilter || tagFilter || searchQuery"
                            @click="languageFilter = ''; tagFilter = ''; searchQuery = ''"
                            class="touch-target w-full sm:w-auto px-4 py-2 text-sm border border-[var(--color-border)] rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                            清除过滤
                        </button>
                    </div>
                </div>

                <!-- 项目列表（仅在非预热且非加载时显示） -->
                <div v-if="!projectStore.loading && !isLoadingProjects && filteredProjects.length" class="space-y-4">
                    <RepoCard v-for="project in paginatedProjects" :key="project.id" :project="project" />

                    <!-- 分页器 -->
                    <div class="flex flex-wrap items-center justify-center gap-2 mt-4">
                        <button @click="currentPage = 1" :disabled="currentPage === 1"
                            class="touch-target px-3 py-2 border rounded-md" title="首页">首页</button>

                        <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1"
                            class="touch-target px-3 py-2 border rounded-md" title="上一页">上一页</button>

                        <div class="flex flex-wrap items-center gap-1">
                            <button v-for="p in totalPages" :key="p" @click="currentPage = p"
                                :class="['touch-target px-3 py-2 rounded-md', currentPage === p ? 'bg-github-blue text-white' : 'border']">
                                {{ p }}
                            </button>
                        </div>

                        <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages"
                            class="touch-target px-3 py-2 border rounded-md" title="下一页">下一页</button>

                        <button @click="currentPage = totalPages" :disabled="currentPage === totalPages"
                            class="touch-target px-3 py-2 border rounded-md" title="尾页">尾页</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
