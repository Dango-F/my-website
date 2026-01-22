// 列出管理员：
// node backend\\scripts\\reset-admin.cjs --list-admins
// 删除所有管理员（需要确认）：
// node backend\\scripts\\reset-admin.cjs --delete-all-admins --confirm
// 删除单个管理员（按用户名）：
// node backend\\scripts\\reset-admin.cjs --delete-admin --username admin --confirm
// 删除单个管理员（按邮箱）：
// node backend\\scripts\\reset-admin.cjs --delete-admin --email someone@example.com --confirm

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const crypto = require("crypto");
const path = require("path");

// 加载环境变量（默认读取 backend/.env）
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const User = require("../src/models/User");

const getArgValue = (name) => {
  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return null;
};

const username = getArgValue("--username");
const email = getArgValue("--email");
const passwordArg = getArgValue("--password");
const listAdmins = process.argv.includes("--list-admins");
const deleteAllAdmins = process.argv.includes("--delete-all-admins");
const deleteAdmin = process.argv.includes("--delete-admin");
const confirmDelete = process.argv.includes("--confirm");
const newPassword = passwordArg || crypto.randomBytes(8).toString("hex");

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("❌ 缺少 MONGODB_URI，请先在 backend/.env 中配置数据库连接串");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  if (listAdmins) {
    const admins = await User.find({ role: "admin" })
      .sort({ createdAt: 1 })
      .select("username email createdAt");

    if (!admins.length) {
      console.log("⚠️ 当前没有管理员账号");
      process.exit(0);
    }

    console.log("✅ 管理员账号列表:");
    admins.forEach((item, index) => {
      const emailText = item.email ? ` (${item.email})` : "";
      console.log(`${index + 1}. ${item.username}${emailText}`);
    });
    process.exit(0);
  }

  // 删除所有管理员（危险操作，需要 --confirm）
  if (deleteAllAdmins) {
    if (!confirmDelete) {
      console.error("❌ 为防止误删，删除所有管理员需要加上 --confirm 参数");
      process.exit(1);
    }
    const result = await User.deleteMany({ role: "admin" });
    console.log(`✅ 已删除 ${result.deletedCount || 0} 个管理员账号`);
    process.exit(0);
  }

  // 删除单个管理员（需配合 --username 或 --email）
  if (deleteAdmin) {
    if (!username && !email) {
      console.error("❌ 使用 --delete-admin 时请指定 --username 或 --email");
      process.exit(1);
    }

    let target = null;
    if (username) {
      target = await User.findOne({ username, role: "admin" });
    } else if (email) {
      target = await User.findOne({ email, role: "admin" });
    }

    if (!target) {
      console.error("❌ 未找到指定的管理员账号");
      process.exit(1);
    }

    if (!confirmDelete) {
      console.error("❌ 为防止误删，删除管理员需要加上 --confirm 参数");
      process.exit(1);
    }

    await User.deleteOne({ _id: target._id });
    console.log(`✅ 已删除管理员: ${target.username} (${target.email || "无邮箱"})`);
    process.exit(0);
  }

  let user = null;
  if (username) {
    user = await User.findOne({ username }).select("+password");
  } else if (email) {
    user = await User.findOne({ email }).select("+password");
  } else {
    user = await User.findOne({ role: "admin" }).sort({ createdAt: 1 }).select("+password");
  }

  if (!user) {
    if (username || email) {
      console.error("❌ 未找到对应管理员账号");
      process.exit(1);
    }

    // 没有任何管理员时创建一个新的
    user = await User.create({
      username: "admin",
      email: "admin@example.com",
      password: newPassword,
      role: "admin",
    });

    // 只保留一个管理员：删除其他管理员账号
    await User.deleteMany({ role: "admin", _id: { $ne: user._id } });

    console.log("✅ 未检测到管理员账号，已创建新管理员");
    console.log(`👤 用户名: ${user.username}`);
    console.log(`📧 邮箱: ${user.email}`);
    console.log(`🔑 密码: ${newPassword}`);
    console.log("⚠️ 请登录后立刻修改密码");
    process.exit(0);
  }

  user.password = newPassword;
  user.role = "admin";
  await user.save();

  // 只保留一个管理员：删除其他管理员账号
  await User.deleteMany({ role: "admin", _id: { $ne: user._id } });

  console.log("✅ 管理员密码已重置");
  console.log(`👤 用户名: ${user.username}`);
  console.log(`📧 邮箱: ${user.email}`);
  console.log(`🔑 新密码: ${newPassword}`);
  console.log("⚠️ 请登录后立刻修改密码");

  process.exit(0);
};

run()
  .catch((err) => {
    console.error("❌ 重置失败:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {
      // ignore
    }
  });
