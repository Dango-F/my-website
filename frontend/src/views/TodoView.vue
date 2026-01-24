<script setup>
import Todo from '@/components/Todo.vue'
import ProfileSidebar from '@/components/ProfileSidebar.vue'
import { useSidebarStore } from '@/stores/sidebar'
import { computed } from 'vue'
import { useTodoStore } from '@/stores/todo'
import { allowRequest } from '@/utils/requestThrottle'
import { ref } from 'vue'

const sidebarStore = useSidebarStore()
const isCollapsed = computed(() => sidebarStore.isCollapsed)
const todoStore = useTodoStore()

const isRefreshing = ref(false)
const refreshMessage = ref({ show: false, text: "", isError: false })
const refreshTodos = async () => {
    if (isRefreshing.value) return;
    if (!allowRequest('todos-refresh')) {
        refreshMessage.value = { show: true, text: '请勿频繁刷新（5秒内最多一次）', isError: false };
        setTimeout(() => { refreshMessage.value.show = false }, 1500);
        return;
    }
    isRefreshing.value = true;

    try {
        await todoStore.fetchTodos()
        refreshMessage.value = {
            show: true,
            text: "数据刷新成功！",
            isError: false,
        };
        setTimeout(() => {
            refreshMessage.value.show = false;
        }, 1500);
    } catch (error) {
        refreshMessage.value = {
            show: true,
            text: `刷新失败: ${error.message}`,
            isError: true,
        };
    } finally {
        isRefreshing.value = false;
    }
}
</script>

<template>
    <div class="container mx-auto px-4 py-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6"
            :class="{ 'md:grid-cols-[300px_1fr]': !isCollapsed, 'md:grid-cols-[auto_1fr]': isCollapsed }">
            <!-- 侧边栏 -->
            <div>
                <ProfileSidebar />
            </div>

            <!-- 主内容区 -->
            <div>
                <div class="flex justify-between items-center mb-6">
                    <h1 class="text-2xl font-bold">待办事项</h1>
                    <button @click="refreshTodos" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center cursor-pointer" :disabled="isRefreshing">
                        <svg v-if="isRefreshing" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span v-else>刷新</span>
                    </button>
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
            </div>
        </div>
    </div>
</template>