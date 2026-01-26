<script setup>
import { ref, computed } from "vue";
import { useTodoStore } from "@/stores/todo";
import { useAuthStore } from "@/stores/auth";
import { allowRequest } from '@/utils/requestThrottle'

const todoStore = useTodoStore();
const authStore = useAuthStore();
const newTodo = ref("");
const newCategory = ref("");
const newPriority = ref("");
const filter = ref("all");
const categoryFilter = ref("");
const isRefreshing = ref(false);

const filteredTodos = computed(() => {
  let result = todoStore.todos;

  // 状态过滤
  if (filter.value === "active") {
    result = result.filter((todo) => !todo.completed);
  } else if (filter.value === "completed") {
    result = result.filter((todo) => todo.completed);
  }

  // 分类过滤
  if (categoryFilter.value) {
    result = result.filter((todo) => todo.category === categoryFilter.value);
  }

  return result;
});
// 让未完成项在前，完成项在后；同组内按优先级从高到低排序，优先级相同则按更新时间降序
const priorityValue = (p) => {
  if (!p) return 0
  if (p === 'high') return 3
  if (p === 'medium') return 2
  if (p === 'low') return 1
  return 0
}

const sortedFilteredTodos = computed(() => {
  return filteredTodos.value.slice().sort((a, b) => {
    // 未完成优先于已完成
    if ((a.completed || false) !== (b.completed || false)) {
      return (a.completed || false) ? 1 : -1
    }

    // 同完成状态下按优先级排序（high > medium > low）
    const pa = priorityValue(a.priority)
    const pb = priorityValue(b.priority)
    if (pa !== pb) return pb - pa

    // 最后按更新时间降序（较新靠前），没有则比较创建时间或 id
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : (a._id || a.id || 0))
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : (b._id || b.id || 0))
    return tb - ta
  })
})

const addTodo = () => {
  if (!canEdit.value) return
  if (newTodo.value.trim() && newCategory.value && newPriority.value) {
    todoStore.addTodo({
      text: newTodo.value.trim(),
      category: newCategory.value,
      priority: newPriority.value,
    });
    newTodo.value = "";
    newCategory.value = "";
    newPriority.value = "";
  }
};

const deleteAllCompleted = async () => {
  if (!canEdit.value) return
  const ok = window.confirm('确认删除所有已完成的待办事项吗？此操作不可撤销。')
  if (!ok) return
  try {
    await todoStore.deleteCompletedTodos()
  } catch (e) {
    // error 已在 store 中设置，额外处理可在此添加
  }
}

// 权限判断：只有特定角色可以修改（例如管理员）
const canEdit = computed(() => {
  return (
    authStore.isAuthenticated &&
    authStore.user &&
    authStore.user.role === 'admin'
  )
})

const toggleTodoWrapped = (todoId) => {
  if (!canEdit.value) return
  todoStore.toggleTodo(todoId)
}

const removeTodoWrapped = (todoId) => {
  if (!canEdit.value) return
  todoStore.removeTodo(todoId)
}

const getPriorityClass = (priority) => {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "low":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

// 刷新待办事项列表，只在用户点击刷新按钮时触发动画
const refreshTodos = async () => {
  if (isRefreshing.value) return;
  if (!allowRequest('todo-refresh')) return;
  isRefreshing.value = true;
  await todoStore.fetchTodos();
  setTimeout(() => {
    isRefreshing.value = false;
  }, 500); // 保持动画至少显示500毫秒，以便用户看到反馈
};
</script>

<template>
  <div
    class="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md p-4"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
      <h2 class="text-lg sm:text-xl font-semibold">待办事项</h2>
      <button
        @click="refreshTodos"
        class="touch-target no-hover-effect text-github-blue hover:text-blue-700"
        :class="{ 'animate-spin': isRefreshing }"
      >
        <!-- <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
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
        </svg> -->
      </button>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="todoStore.error"
      class="mb-4 p-2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md"
    >
      {{ todoStore.error }}
    </div>

    <!-- 添加新待办 -->
    <div v-if="canEdit" class="mb-6 border-b border-[var(--color-border)] pb-4">
      <div class="flex flex-col gap-2">
          <input
          v-model="newTodo"
          @keyup.enter="addTodo"
          type="text"
          placeholder="添加新待办..."
          class="w-full p-2 min-h-[44px] border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]"
        />
        <div class="flex flex-col gap-2 sm:flex-row">
          <select
            v-model="newCategory"
            class="w-full sm:w-auto p-2 min-h-[44px] border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]"
          >
            <option value="" disabled>选择分类</option>
            <option
              v-for="category in todoStore.categories"
              :key="category"
              :value="category"
            >
              {{ category }}
            </option>
          </select>
          <select
            v-model="newPriority"
            class="w-full sm:w-auto p-2 min-h-[44px] border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]"
          >
            <option value="" disabled>选择优先级</option>
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </select>
          <button
            @click="addTodo"
            class="touch-target w-full sm:w-auto no-hover-effect px-4 py-2 bg-github-blue text-white rounded-md hover:bg-blue-700"
            :disabled="todoStore.isLoading"
          >
            {{ todoStore.isLoading ? "添加中..." : "添加" }}
          </button>
          <button
            @click="deleteAllCompleted"
            class="touch-target w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            :disabled="todoStore.isLoading"
            title="一键删除所有已完成代办（仅管理员可用）"
          >
            删除已完成
          </button>
        </div>
      </div>
    </div>

    <!-- 过滤器 -->
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <div
        class="flex border border-[var(--color-border)] rounded-md overflow-hidden"
      >
        <button
          @click="filter = 'all'"
          :class="[
            'touch-target no-hover-effect px-4 py-2',
            filter === 'all'
              ? 'bg-github-blue text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800',
          ]"
        >
          全部
        </button>
        <button
          @click="filter = 'active'"
          :class="[
            'touch-target no-hover-effect px-4 py-2',
            filter === 'active'
              ? 'bg-github-blue text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800',
          ]"
        >
          未完成
        </button>
        <button
          @click="filter = 'completed'"
          :class="[
            'touch-target no-hover-effect px-4 py-2',
            filter === 'completed'
              ? 'bg-github-blue text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800',
          ]"
        >
          已完成
        </button>
      </div>

      <select
        v-model="categoryFilter"
        class="w-full sm:w-auto p-2 min-h-[44px] border border-[var(--color-border)] rounded-md bg-[var(--color-bg-primary)]"
      >
        <option value="">所有分类</option>
        <option
          v-for="category in todoStore.categories"
          :key="category"
          :value="category"
        >
          {{ category }}
        </option>
      </select>
    </div>

    <!-- 加载指示器 -->
    <div
      v-if="todoStore.isLoading && !filteredTodos.length"
      class="text-center py-4"
    >
      <div
        class="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-github-blue"
      ></div>
      <p class="mt-2 text-github-gray">加载中...</p>
    </div>

    <!-- Todo列表 -->
    <div v-else-if="filteredTodos.length">
      <transition-group name="todo-list" tag="div" class="space-y-2">
        <div
          v-for="todo in sortedFilteredTodos"
          :key="todo._id || todo.id"
          class="p-3 mb-2 border border-[var(--color-border)] rounded-md flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          :class="{ 'bg-gray-50 dark:bg-gray-800': todo.completed }"
        >
        <div class="flex flex-wrap items-center gap-2 min-w-0">
          <input
            type="checkbox"
            :checked="todo.completed"
            @change="toggleTodoWrapped(todo._id || todo.id)"
            :disabled="!canEdit"
            :title="canEdit ? '' : '只读模式：无权限修改'"
            class="h-4 w-4"
          />
          <span class="break-words" :class="{ 'line-through text-github-gray': todo.completed }">
            {{ todo.text }}
          </span>
          <span
            class="ml-2 px-2 py-0.5 text-xs rounded-full"
            :class="getPriorityClass(todo.priority)"
          >
            {{ { high: "高", medium: "中", low: "低" }[todo.priority] }}
          </span>
          <span
            class="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          >
            {{ todo.category }}
          </span>
        </div>
        <button
          v-if="canEdit"
          @click="removeTodoWrapped(todo._id || todo.id)"
          class="touch-target no-hover-effect text-red-500 hover:text-red-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
        </div>
      </transition-group>
    </div>
    <div v-else class="text-center py-4 text-github-gray">
      没有符合条件的待办事项
    </div>
  </div>
</template>

<style scoped>
.no-hover-effect,
.no-hover-effect:focus,
.no-hover-effect:active {
  filter: none !important;
  transform: none !important;
  transition: none !important;
  box-shadow: none !important;
}

.no-hover-effect:hover {
  filter: none !important;
  transform: none !important;
  transition: none !important;
  box-shadow: none !important;
}

/* 平滑移动动画：使用 FLIP 动画（Vue 的 transition-group move） */
.todo-list-move {
  transition: transform 320ms cubic-bezier(.2,.8,.2,1);
}

/* 入口/离开淡入淡出（可选，增强感知） */
.todo-list-enter-from,
.todo-list-leave-to {
  opacity: 0.01;
  transform: translateY(6px);
}
.todo-list-enter-active,
.todo-list-leave-active {
  transition: all 240ms cubic-bezier(.2,.8,.2,1);
}

.todo-list-move {
  will-change: transform;
}
</style>
