// 简单的请求节流工具：在指定时间窗口（默认5000ms）内同一 key 只允许一次请求
const lastCallMap = {};

export function allowRequest(key, intervalMs = 5000) {
  try {
    const now = Date.now();
    const last = lastCallMap[key] || 0;
    if (now - last > intervalMs) {
      lastCallMap[key] = now;
      return true;
    }
    return false;
  } catch (e) {
    // 出错时保守允许请求，以免造成不可预期阻塞
    console.error('requestThrottle error:', e);
    return true;
  }
}

export function resetRequestKey(key) {
  delete lastCallMap[key];
}

export default { allowRequest, resetRequestKey };
