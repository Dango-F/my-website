const express = require("express");
const {
    getUserConfig,
    updateGithubToken,
    deleteGithubToken
} = require("../controllers/configController");
const { protect, authorize } = require("../middlewares/auth");

const router = express.Router();

// 获取用户配置
router.get("/", getUserConfig);

// 更新GitHub Token
// 只有管理员可以更新或删除站点级 GitHub Token，普通用户只能读取
router.post("/github-token", protect, authorize('admin'), updateGithubToken);

// 删除GitHub Token
router.delete("/github-token", protect, authorize('admin'), deleteGithubToken);

module.exports = router;
 