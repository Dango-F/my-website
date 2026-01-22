import { defineStore } from 'pinia'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const useConfigStore = defineStore('config', {
  state: () => ({
    configData: null,
    configVersion: '',
    lastVersionCheck: 0,
    VERSION_CHECK_INTERVAL: 30 * 60 * 1000 // 30 分钟
  }),

  getters: {
    githubToken: (state) => state.configData?.github_token || '',
    preferences: (state) => state.configData?.preferences || {}
  },

  actions: {
    // 从 localStorage 恢复
    initFromLocal() {
      try {
        const savedData = localStorage.getItem('config_data')
        const savedVersion = localStorage.getItem('config_version')
        const savedLastCheck = localStorage.getItem('config_last_version_check')

        if (savedData) {
          this.configData = JSON.parse(savedData)
          this.configVersion = savedVersion || ''
          this.lastVersionCheck = parseInt(savedLastCheck || '0')
          console.log('✅ 已从本地加载 config')
        }
      } catch (err) {
        console.error('从 localStorage 恢复 config 失败:', err)
      }
    },

    // 将上次版本检查标记为当前时间（用于手动强刷后重置防抖）
    markVersionCheckedNow() {
      try {
        const now = Date.now()
        this.lastVersionCheck = now
        localStorage.setItem('config_last_version_check', String(now))
      } catch (err) {
        console.error('设置 config_last_version_check 失败:', err)
      }
    },

    // 保存到 localStorage
    saveToLocal() {
      try {
        localStorage.setItem('config_data', JSON.stringify(this.configData))
        localStorage.setItem('config_version', this.configVersion)
        localStorage.setItem('config_last_version_check', String(this.lastVersionCheck))
      } catch (err) {
        console.error('保存 config 到 localStorage 失败:', err)
      }
    },

    // 从服务器获取完整 config
    async fetchConfig() {
      try {
        const response = await axios.get(`${API_URL}/config`)

        if (response.data.success) {
          this.configData = response.data.data
          this.configVersion = String(response.data.data.updated_at ? new Date(response.data.data.updated_at).getTime() : Date.now())
          this.lastVersionCheck = Date.now()
          this.saveToLocal()
        }
      } catch (err) {
        console.error('获取 config 失败:', err)
      }
    },

    // 检查版本并按需更新
    async checkVersionAndUpdate() {
      const now = Date.now()

      // 30 分钟内短路
      if (now - this.lastVersionCheck < this.VERSION_CHECK_INTERVAL) {
        console.log('⏱️ config 版本检查未到期，跳过')
        return
      }

      try {
        const response = await axios.get(`${API_URL}/version`)
        const serverVersion = response.data.data.config || '0'

        if (serverVersion !== this.configVersion) {
          console.log('🔄 config 版本不同，重新获取')
          await this.fetchConfig()
        } else {
          console.log('✓ config 版本一致')
          this.lastVersionCheck = now
          this.saveToLocal()
        }
      } catch (err) {
        console.error('检查 config 版本失败:', err)
      }
    },

    // 更新 GitHub Token
    async updateGithubToken(token) {
      try {
        const response = await axios.post(`${API_URL}/config/github-token`, { token })

        if (response.data.success) {
          // 立即重新获取完整配置
          await this.fetchConfig()
          return true
        }
        return false
      } catch (err) {
        console.error('更新 GitHub Token 失败:', err)
        return false
      }
    }
  }
})
