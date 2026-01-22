const express = require('express')
const { getVersions } = require('../controllers/versionController')

const router = express.Router()

// GET /api/version -> 返回简短的版本信息
router.get('/', getVersions)

module.exports = router
