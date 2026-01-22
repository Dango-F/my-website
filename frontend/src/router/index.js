import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import { useTodoStore } from "@/stores/todo";
import { useProfileStore } from "@/stores/profile";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
    },
    {
      path: "/change-password",
      name: "change-password",
      component: () => import("../views/ChangePasswordView.vue"),
    },
    // 博客相关路由已删除
    {
      path: "/projects",
      name: "projects",
      component: () => import("../views/ProjectsView.vue"),
    },
    {
      path: "/resume",
      name: "resume",
      component: () => import("../views/ResumeView.vue"),
    },
    {
      path: "/todo",
      name: "todo",
      component: () => import("../views/TodoView.vue"),
    },
    // 管理后台已移除
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

// Previously there was a smart refresh guard based on 5s debounce.
// That logic was removed in favor of a lightweight version check on app init.
router.beforeEach((to, from, next) => {
  // Skip login page or initial load (initial navigation has empty matched)
  if (to.path === "/login" || from.matched.length === 0) {
    next();
    return;
  }
  // 切换页面时触发轻量版本校验：先用 localStorage 渲染，再后台比对版本并按需更新
  try {
    const profileStore = useProfileStore()
    // console.log('[路由] 页面切换：触发 profile 版本校验（后台异步）')
    profileStore.checkVersionAndUpdate && setTimeout(() => profileStore.checkVersionAndUpdate(), 0)
  } catch (e) {
    console.error('[路由] 触发 profile 版本校验失败：', e)
  }

  // 每次页面切换也触发 todos 的版本校验（此前仅在进入 /todo 时触发）
  try {
    const todoStore = useTodoStore()
    // console.log('[路由] 页面切换：触发 todos 版本校验（后台异步）')
    todoStore.checkVersionAndUpdate && setTimeout(() => todoStore.checkVersionAndUpdate(), 0)
  } catch (e) {
    console.error('[路由] 触发 todos 版本校验失败：', e)
  }

  next();
});

export default router;
