import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import profileService from '@/services/profileService'

export const useProfileStore = defineStore('profile', () => {
    const profile = ref({
        name: 'Yulong.Fan',
        avatar: 'https://avatars.githubusercontent.com/u/109727326?s=400&u=3a05d82d993d049bd7c03c5bdac0408eea8184f3&v=4',
        bio: '空间智能 | 具身智能',
        location: '北京-怀柔',
        email: '1847539781@qq.com',
        github: 'https://github.com/Dango-F',
        qq: '1847539781',
        wechat: 'fan15890094838',
        website: 'https://zhangsan.dev',
        company: '中国科学院大学',
        position: 'UCAS-ES-计算机应用技术',
        status: {
            text: '正在编码...',
            emoji: '💻'
        },
        skills: ['JavaScript', 'Vue', 'React', 'Node.js', 'TypeScript', 'CSS', 'HTML'],
        github_username: 'Dango-F'
    })

    const timeline = ref([
        {
            year: '2023',
            title: '高级前端工程师',
            company: 'ABC科技有限公司',
            description: '负责公司核心产品的前端架构设计和团队管理。'
        },
        {
            year: '2021',
            title: '前端工程师',
            company: 'XYZ互联网公司',
            description: '参与多个大型Web应用的开发，专注于性能优化和用户体验提升。'
        },
        {
            year: '2020',
            title: '前端开发实习生',
            company: '创新科技初创公司',
            description: '参与公司产品原型设计和前端开发，学习前端技术栈。'
        },
        {
            year: '2019',
            title: '计算机科学学士学位',
            company: '某知名大学',
            description: '主修计算机科学，辅修数学。GPA 3.8/4.0'
        }
    ])

    const isLoading = ref(false)
    const error = ref(null)
    const lastFetchTime = ref(0)
    const profileVersion = ref(localStorage.getItem('profile_version') || null)

    // 从 localStorage 恢复（首次渲染用）
    const loadProfileFromLocal = () => {
        try {
            const stored = localStorage.getItem('profile_data')
            if (stored) {
                const data = JSON.parse(stored)
                profile.value = data.profile || profile.value
                timeline.value = data.timeline || timeline.value
                // console.log('[profile] 从 localStorage 加载，profile_version=', localStorage.getItem('profile_version'))
            }
        } catch (e) {
            console.error('解析本地 profile 失败:', e)
        }
    }

    const saveProfileToLocal = (data, version) => {
        try {
            localStorage.setItem('profile_data', JSON.stringify({ profile: data, timeline: timeline.value }))
            if (version) localStorage.setItem('profile_version', String(version))
            profileVersion.value = version || profileVersion.value
            // console.log('[profile] 已保存到 localStorage，profile_version=', profileVersion.value)
        } catch (e) {
            console.error('保存 profile 到 localStorage 失败:', e)
        }
    }

    // 从服务器获取配置文件
    const fetchProfile = async () => {
        isLoading.value = true
        error.value = null
        try {
            const data = await profileService.getProfile()
            profile.value = {
                name: data.name,
                avatar: data.avatar,
                bio: data.bio,
                location: data.location,
                email: data.email,
                github: data.github,
                qq: data.qq,
                wechat: data.wechat,
                website: data.website,
                company: data.company,
                position: data.position,
                status: data.status || { text: '正在编码...', emoji: '💻' },
                skills: data.skills,
                github_username: data.github_username
            }
            timeline.value = data.timeline || []
            lastFetchTime.value = Date.now()
            // 使用服务器的 updatedAt 作为版本（避免本地时间戳与服务器不一致）
            try {
                const serverVer = data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now()
                saveProfileToLocal(profile.value, String(serverVer))
            } catch (e) {
                // 回退到使用当前时间作为版本
                saveProfileToLocal(profile.value, String(Date.now()))
            }
        } catch (err) {
            error.value = '获取配置文件失败'
            console.error(err)
        } finally {
            isLoading.value = false
        }
    }

    // 更新配置文件
    const updateProfile = async (profileData) => {
        isLoading.value = true
        error.value = null
        try {
            const data = await profileService.updateProfile(profileData)
            profile.value = {
                name: data.name,
                avatar: data.avatar,
                bio: data.bio,
                location: data.location,
                email: data.email,
                github: data.github,
                qq: data.qq,
                wechat: data.wechat,
                website: data.website,
                company: data.company,
                position: data.position,
                status: data.status || { text: '正在编码...', emoji: '💻' },
                skills: data.skills,
                github_username: data.github_username
            }
            return data
        } catch (err) {
            error.value = '更新配置文件失败'
            console.error(err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    // 更新时间轴
    const updateTimeline = async (newTimeline) => {
        isLoading.value = true
        error.value = null
        try {
            const data = await profileService.updateTimeline(newTimeline)
            timeline.value = data.timeline || []
            return data
        } catch (err) {
            error.value = '更新时间轴失败'
            console.error(err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    // 更新技能列表
    const updateSkills = async (newSkills) => {
        isLoading.value = true
        error.value = null
        try {
            const data = await profileService.updateSkills(newSkills)
            profile.value.skills = data.skills
            return data
        } catch (err) {
            error.value = '更新技能列表失败'
            console.error(err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    // 重置配置文件
    const resetProfile = async () => {
        isLoading.value = true
        error.value = null
        try {
            const data = await profileService.resetProfile()
            profile.value = {
                name: data.name,
                avatar: data.avatar,
                bio: data.bio,
                location: data.location,
                email: data.email,
                github: data.github,
                qq: data.qq,
                wechat: data.wechat,
                website: data.website,
                company: data.company,
                position: data.position,
                status: data.status || { text: '正在编码...', emoji: '💻' },
                skills: data.skills,
                github_username: data.github_username
            }
            timeline.value = data.timeline || []
            return data
        } catch (err) {
            error.value = '重置配置文件失败'
            console.error(err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    // 检查是否需要刷新（5秒内不重复请求）
    const shouldRefresh = () => {
        const now = Date.now()
        const refreshInterval = 5000 // 5秒
        return now - lastFetchTime.value > refreshInterval
    }

    // 轻量版本比对：先请求后端的版本号，若不同则更新数据
    const checkVersionAndUpdate = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
            // console.log('[profile] 请求 /api/version 进行轻量版本校验')
            const resp = await axios.get(`${API_URL}/version`)
            if (resp.data && resp.data.success) {
                const serverProfileVer = resp.data.data.profile
                // console.log('[profile] 服务器 profile 版本=', serverProfileVer, '本地版本=', profileVersion.value)
                if (!profileVersion.value || String(profileVersion.value) !== String(serverProfileVer)) {
                    // console.log('[profile] 版本不一致 -> 将从服务器拉取最新 profile')
                    // 版本不同，拉取最新数据
                    await fetchProfile()
                    // fetchProfile 已保存本地并更新版本
                } else {
                    // console.log('[profile] 版本一致 -> 使用 localStorage 缓存的 profile')
                    // 版本相同，使用本地缓存（已在 loadProfileFromLocal 中加载）
                }
            }
        } catch (e) {
            console.error('比较 profile 版本失败:', e)
        }
    }

    // 初始化：从 localStorage 读取并发起版本检查
    const initFromLocal = async () => {
        loadProfileFromLocal()
        // 异步检查版本（不阻塞渲染）
        setTimeout(() => {
            checkVersionAndUpdate()
        }, 0)
    }

    return { 
        profile, 
        timeline, 
        isLoading, 
        error,
        lastFetchTime,
        profileVersion,
        fetchProfile,
        updateProfile,
        updateTimeline,
        updateSkills,
        resetProfile,
        shouldRefresh,
        initFromLocal,
        checkVersionAndUpdate
    }
}) 
