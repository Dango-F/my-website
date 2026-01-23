<script setup>
import Todo from '@/components/Todo.vue'
import ProfileSidebar from '@/components/ProfileSidebar.vue'
import { useSidebarStore } from '@/stores/sidebar'
import { computed } from 'vue'
import { useTodoStore } from '@/stores/todo'

const sidebarStore = useSidebarStore()
const isCollapsed = computed(() => sidebarStore.isCollapsed)
const todoStore = useTodoStore()

const refreshTodos = async () => {
    if (todoStore.isLoading) return
    await todoStore.fetchTodos()
}
</script>

<template>
    <div class="container mx-auto px-4 py-6">
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
                    <button @click="refreshTodos" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center" :disabled="todoStore.isLoading">
                        <svg v-if="todoStore.isLoading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span v-else>刷新</span>
                    </button>
                </div>
                <Todo />
            </div>
        </div>
    </div>
</template>