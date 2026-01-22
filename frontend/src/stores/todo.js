import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import todoService from '@/services/todoService'

export const useTodoStore = defineStore('todo', () => {
    const todos = ref([]);
    const isLoading = ref(false);
    const error = ref(null);
    const lastFetchTime = ref(0);
    const todosVersion = ref(localStorage.getItem('todos_version') || null)
    // 上次执行版本校验的时间（用于防抖，单位：ms）
    const lastVersionCheck = ref(Number(localStorage.getItem('todos_last_version_check') || 0))

    // 添加默认分类列表
    const defaultCategories = ['工作', '学习', '生活', '娱乐', '其他']

    const categories = computed(() => {
        const categorySet = new Set(defaultCategories)
        todos.value.forEach(todo => categorySet.add(todo.category))
        return [...categorySet]
    })

    const priorities = computed(() => ['high', 'medium', 'low'])

    // 从服务器获取所有待办事项
    const fetchTodos = async () => {
        isLoading.value = true;
        error.value = null;
        try {
            const fetchedTodos = await todoService.getAllTodos();
            todos.value = fetchedTodos;
            lastFetchTime.value = Date.now();
            // 使用服务器数据中的最新 updatedAt 作为版本，避免 Date.now() 导致不匹配
            try {
                localStorage.setItem('todos', JSON.stringify(todos.value));
                // 找出 fetchedTodos 中最大的 updatedAt
                let maxTs = 0
                for (const t of fetchedTodos) {
                    if (t && t.updatedAt) {
                        const ts = new Date(t.updatedAt).getTime()
                        if (ts > maxTs) maxTs = ts
                    }
                }
                const ver = maxTs ? String(maxTs) : String(Date.now())
                localStorage.setItem('todos_version', ver)
                todosVersion.value = ver
            } catch (e) {
                console.error('保存 todos 到 localStorage 失败:', e)
            }
        } catch (err) {
            error.value = '获取待办事项失败';
            console.error(err);
            // 如果API失败，尝试从本地存储获取
            const localTodos = JSON.parse(localStorage.getItem('todos')) || [];
            todos.value = localTodos;
        } finally {
            isLoading.value = false;
        }
    }

    const addTodo = async (todo) => {
        isLoading.value = true;
        error.value = null;
        try {
            const newTodo = await todoService.createTodo({
                text: todo.text,
                completed: false,
                priority: todo.priority,
                category: todo.category
            });
            todos.value.unshift(newTodo);
        } catch (err) {
            error.value = '添加待办事项失败';
            console.error(err);
            // 如果API失败，使用本地存储作为备份
            const newId = todos.value.length ? Math.max(...todos.value.map(t => t.id || 0)) + 1 : 1;
            const localTodo = {
                id: newId,
                text: todo.text,
                completed: false,
                priority: todo.priority,
                category: todo.category
            };
            todos.value.unshift(localTodo);
            saveTodosLocally();
        } finally {
            isLoading.value = false;
        }
    }

    const toggleTodo = async (id) => {
        const todo = todos.value.find(todo => todo._id === id || todo.id === id);
        if (!todo) return;

        // 乐观更新UI，立即更新界面
        todo.completed = !todo.completed;

        try {
            // 发送API请求，但不设置全局加载状态
            if (todo._id) {
                await todoService.toggleTodoComplete(todo._id, todo.completed);
            } else {
                throw new Error('No _id available');
            }
        } catch (err) {
            // 如果API失败，恢复界面状态
            todo.completed = !todo.completed;
            error.value = '更新待办事项状态失败';
            console.error(err);
            // 使用本地存储作为备份
            saveTodosLocally();
            // 显示错误3秒后自动清除
            setTimeout(() => {
                if (error.value === '更新待办事项状态失败') {
                    error.value = null;
                }
            }, 3000);
        }
    }

    const removeTodo = async (id) => {
        // 查找待办事项（可能是本地或API获取的）
        const todo = todos.value.find(todo => todo._id === id || todo.id === id);
        if (!todo) return;

        // 保存待办索引和副本，用于恢复
        const index = todos.value.findIndex(t => t._id === id || t.id === id);
        const todoBackup = { ...todo };

        // 乐观UI更新，立即从界面移除
        if (index !== -1) {
            todos.value.splice(index, 1);
        }

        try {
            // 发送API请求，但不设置全局加载状态
            if (todoBackup._id) {
                await todoService.deleteTodo(todoBackup._id);
            } else {
                throw new Error('No _id available');
            }
        } catch (err) {
            // 如果API失败，恢复界面状态
            if (index !== -1) {
                todos.value.splice(index, 0, todoBackup);
            }
            error.value = '删除待办事项失败';
            console.error(err);
            // 使用本地存储作为备份
            saveTodosLocally();
            // 显示错误3秒后自动清除
            setTimeout(() => {
                if (error.value === '删除待办事项失败') {
                    error.value = null;
                }
            }, 3000);
        }
    }

    const updateTodo = async (id, updates) => {
        // 查找待办事项（可能是本地或API获取的）
        const todo = todos.value.find(todo => todo._id === id || todo.id === id);
        if (!todo) return;

        // 保存原始状态用于恢复
        const originalTodo = { ...todo };

        // 乐观UI更新，立即更新界面
        Object.assign(todo, updates);

        try {
            if (todo._id) {
                // 如果有_id，说明是从API获取的
                await todoService.updateTodo(todo._id, updates);
            } else {
                throw new Error('No _id available');
            }
        } catch (err) {
            // 如果API失败，恢复界面状态
            Object.assign(todo, originalTodo);
            error.value = '更新待办事项失败';
            console.error(err);
            // 使用本地存储作为备份
            saveTodosLocally();
            // 显示错误3秒后自动清除
            setTimeout(() => {
                if (error.value === '更新待办事项失败') {
                    error.value = null;
                }
            }, 3000);
        }
    }

    // 本地存储备份方法
    const saveTodosLocally = () => {
        try {
            localStorage.setItem('todos', JSON.stringify(todos.value));
            const ver = String(Date.now())
            localStorage.setItem('todos_version', ver)
            todosVersion.value = ver
            // console.log('[todos] 已保存到 localStorage，todos_version=', todosVersion.value)
        } catch (e) {
            console.error('保存 todos 到 localStorage 失败:', e)
        }
    }

    // 初始化：从 localStorage 恢复并异步校验版本
    const loadTodosFromLocal = () => {
        try {
            const stored = localStorage.getItem('todos')
            if (stored) {
                todos.value = JSON.parse(stored)
                console.log('[缓存] todos：已从 localStorage 恢复用于渲染，todos_version=', localStorage.getItem('todos_version'))
            }
        } catch (e) {
            console.error('解析本地 todos 失败:', e)
        }
    }

    const checkVersionAndUpdate = async () => {
        // 30 分钟防抖：如果上次校验在 30 分钟之内则跳过
        try {
            const now = Date.now()
            const debounceMs = 30 * 60 * 1000 // 30 分钟
            if (lastVersionCheck.value && now - Number(lastVersionCheck.value) < debounceMs) {
                const hasLocal = !!localStorage.getItem('todos')
                console.log('[缓存] todos：30分钟内已检查，跳过版本校验，使用 localStorage=', hasLocal)
                return
            }
            // 标记为已检查（防止短时间重复触发）
            lastVersionCheck.value = now
            localStorage.setItem('todos_last_version_check', String(now))
        } catch (e) {
            // 若防抖逻辑异常，不影响后续流程
            console.error('todos 防抖检查错误:', e)
        }
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
            const hasLocal = !!localStorage.getItem('todos')
            const resp = await axios.get(`${API_URL}/version`)
            if (resp.data && resp.data.success) {
                const serverTodosVer = resp.data.data.todos
                if (!todosVersion.value || String(todosVersion.value) !== String(serverTodosVer)) {
                    console.log('[缓存] todos：版本不一致，准备从服务器拉取最新数据 (local exists=', hasLocal, ')')
                    await fetchTodos()
                } else {
                    console.log('[缓存] todos：版本一致，使用 localStorage 渲染')
                }
            }
        } catch (e) {
            console.error('比较 todos 版本失败:', e)
            const hasLocal = !!localStorage.getItem('todos')
            // if (hasLocal) console.log('[缓存] todos：版本比较失败，回退使用 localStorage')
        }
    }

    const initFromLocal = () => {
        loadTodosFromLocal()
        setTimeout(() => {
            checkVersionAndUpdate()
        }, 0)
    }

    // 检查是否需要刷新（5秒内不重复请求）
    const shouldRefresh = () => {
        const now = Date.now()
        const refreshInterval = 5000 // 5秒
        return now - lastFetchTime.value > refreshInterval
    }

    return {
        todos,
        isLoading,
        error,
        categories,
        priorities,
        lastFetchTime,
        fetchTodos,
        todosVersion,
        addTodo,
        toggleTodo,
        removeTodo,
        updateTodo,
        shouldRefresh,
        initFromLocal,
        checkVersionAndUpdate
    }
}) 