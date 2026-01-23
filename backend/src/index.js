const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// 路由导入
const authRoutes = require("./routes/auth");
const todoRoutes = require("./routes/todos");
const configRoutes = require("./routes/config");
const profileRoutes = require("./routes/profile");
const versionRoutes = require("./routes/version");

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 配置：从环境变量读取允许的来源（逗号分隔），支持多域名
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

const corsOptions = {
  origin: function (origin, callback) {
    // 无 origin（例如服务器请求或 Postman）也允许
    if (!origin) return callback(null, true);

    // 如果配置了 '*' 或者请求来源在允许列表中，则允许
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true, // 允许发送 Cookie
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// console.log("CORS allowed origins:", allowedOrigins.join(", "));

// 中间件
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 设置静态文件夹，用于存储上传的图片等文件
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// 使用路由
app.use("/api/auth", authRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/config", configRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/version", versionRoutes);

// 连接到数据库
console.log(`尝试连接 MongoDB: ${process.env.MONGODB_URI ? '已配置' : '未配置'}`);
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    const { host, name: dbName } = mongoose.connection;
    console.log(`数据库连接成功 -> host: ${host}, db: ${dbName}`);
    // 启动服务器（展示监听地址和 PORT 来源）
    app.listen(PORT, () => {
      console.log(
        `服务器运行在 http://localhost:${PORT} (PORT 来源: ${
          process.env.PORT ? "环境变量 PORT" : "默认 3000"
        })`
      );
    });
  })
  .catch((error) => {
    console.error("数据库连接失败:", error);
  });

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack || err);
  // 始终返回错误消息以便前端能够显示（开发环境中尤其有用）
  res.status(500).json({
    success: false,
    message: err.message || "服务器内部错误",
    // 为了安全考虑不返回完整堆栈到客户端
  });
});
