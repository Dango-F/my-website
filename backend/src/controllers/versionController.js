const Profile = require('../models/Profile')
const Todo = require('../models/Todo')
const UserConfig = require('../models/UserConfig')

// 返回各主要数据的最后修改时间戳（毫秒）
exports.getVersions = async (req, res) => {
    try {
        const userId = 'default'

        // console.log('[版本] 收到 /api/version 请求')

        const profile = await Profile.findOne({ user_id: userId })

        // 获取 todos 中最新的更新时间
        const latestTodo = await Todo.findOne().sort({ updatedAt: -1 }).limit(1)

        // 获取 config 更新时间
        const config = await UserConfig.findOne({ user_id: userId })

        const profileVer = profile && profile.updatedAt ? profile.updatedAt.getTime() : 0
        const todosVer = latestTodo && latestTodo.updatedAt ? latestTodo.updatedAt.getTime() : 0
        const configVer = config && config.updated_at ? new Date(config.updated_at).getTime() : 0

        const payload = {
            profile: String(profileVer),
            todos: String(todosVer),
            config: String(configVer)
        }

        // console.log('[版本] 返回版本信息 ->', payload)

        return res.status(200).json({
            success: true,
            data: payload
        })
    } catch (err) {
        console.error('获取版本失败:', err)
        return res.status(500).json({ success: false, message: '获取版本失败' })
    }
}
