#!/usr/bin/env node

/**
 * ZenStudy — Stress & Load Testing Tool cho Cloudflare Worker API
 * 
 * Cách chạy:
 *   1. Chạy mô phỏng tải nội bộ (Mock DB):
 *      node scripts/load-test.mjs
 * 
 *   2. Bắn tải vào Worker Cloudflare thật:
 *      node scripts/load-test.mjs https://data-api.your-worker.workers.dev <YOUR_FIREBASE_TOKEN>
 */

import { createWorker } from "../workers/data-api/worker.js";

const TARGET_URL = process.argv[2] || "local";
const AUTH_TOKEN = process.argv[3] || "test-token";
const CONCURRENT_USERS = 200;

console.log("==================================================================");
console.log(" 🚀 ZENSTUDY CLOUDFLARE WORKER LOAD TEST — KIỂM THỬ TẢI CAO");
console.log("==================================================================");
console.log(` Mục tiêu:      ${TARGET_URL === "local" ? "Worker In-Memory Simulation" : TARGET_URL}`);
console.log(` Số user ảo:    ${CONCURRENT_USERS} người dùng đồng thời`);
console.log("------------------------------------------------------------------\n");

// Tạo Mock D1 nếu chạy local
function createLocalD1() {
  const store = new Map();
  return {
    prepare(sql) {
      let params = [];
      const stmt = {
        bind(...args) {
          params = args;
          return stmt;
        },
        async first() {
          if (sql.includes("SELECT")) {
            return store.get(params[0]) || null;
          }
          return null;
        },
        async run() {
          if (sql.includes("INSERT INTO user_data")) {
            store.set(params[0], { data_json: params[1], updated_at: params[2] });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
    store,
  };
}

async function runBenchmark() {
  const localD1 = createLocalD1();
  const worker = createWorker({
    verifyToken: async (_env, token) => {
      if (token && token.startsWith("tk_")) {
        return { uid: token.replace("tk_", "") };
      }
      return { error: "INVALID" };
    },
  });

  const writeLatencies = [];
  const readLatencies = [];
  let writeErrors = 0;
  let readErrors = 0;

  console.log(`[Pha 1] Bắn ${CONCURRENT_USERS} request GHI (POST /data) đồng thời...`);
  const startWrite = Date.now();

  const writeTasks = Array.from({ length: CONCURRENT_USERS }, async (_, i) => {
    const uid = `student_${String(i + 1).padStart(3, "0")}`;
    const token = TARGET_URL === "local" ? `tk_${uid}` : AUTH_TOKEN;
    const url = TARGET_URL === "local" ? "https://local/data" : `${TARGET_URL}/data`;

    const payload = {
      settings: { sceneId: "cyberpunk", volume: 75, pomoDuration: 25 },
      notes: [{ id: `note_${i}`, title: `Ôn tập môn số ${i}` }],
      tasks: [{ id: `task_${i}`, title: `Làm bài tập số ${i}` }],
      focusSessions: [{ id: `sess_${i}`, focusSeconds: 1500 }],
    };

    const reqStart = Date.now();
    try {
      if (TARGET_URL === "local") {
        const req = new Request(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: payload }),
        });
        const res = await worker.fetch(req, { DB: localD1, ALLOWED_ORIGINS: "*" });
        if (res.status !== 200) writeErrors++;
      } else {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: payload }),
        });
        if (!res.ok) writeErrors++;
      }
      writeLatencies.push(Date.now() - reqStart);
    } catch {
      writeErrors++;
    }
  });

  await Promise.all(writeTasks);
  const totalWriteTime = Date.now() - startWrite;

  console.log(`[Pha 2] Bắn ${CONCURRENT_USERS} request ĐỌC (GET /data) đồng thời...`);
  const startRead = Date.now();

  const readTasks = Array.from({ length: CONCURRENT_USERS }, async (_, i) => {
    const uid = `student_${String(i + 1).padStart(3, "0")}`;
    const token = TARGET_URL === "local" ? `tk_${uid}` : AUTH_TOKEN;
    const url = TARGET_URL === "local" ? "https://local/data" : `${TARGET_URL}/data`;

    const reqStart = Date.now();
    try {
      if (TARGET_URL === "local") {
        const req = new Request(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await worker.fetch(req, { DB: localD1, ALLOWED_ORIGINS: "*" });
        if (res.status !== 200) readErrors++;
      } else {
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) readErrors++;
      }
      readLatencies.push(Date.now() - reqStart);
    } catch {
      readErrors++;
    }
  });

  await Promise.all(readTasks);
  const totalReadTime = Date.now() - startRead;

  // Tính toán số liệu thống kê
  function calcStats(arr) {
    if (arr.length === 0) return { min: 0, max: 0, avg: 0, p95: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const p95Idx = Math.floor(sorted.length * 0.95);
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: (sum / sorted.length).toFixed(1),
      p95: sorted[p95Idx],
    };
  }

  const wStats = calcStats(writeLatencies);
  const rStats = calcStats(readLatencies);

  console.log("\n==================================================================");
  console.log(" 📊 KẾT QUẢ BÁO CÁO HIỆU NĂNG & ĐỘ ỔN ĐỊNH");
  console.log("==================================================================");
  console.log(` [POST /data - Ghi Dữ Liệu]`);
  console.log(`   - Tổng request:    ${CONCURRENT_USERS}`);
  console.log(`   - Thành công:      ${CONCURRENT_USERS - writeErrors} / ${CONCURRENT_USERS} (Tỷ lệ: ${(((CONCURRENT_USERS - writeErrors) / CONCURRENT_USERS) * 100).toFixed(1)}%)`);
  console.log(`   - Tổng thời gian:  ${totalWriteTime} ms`);
  console.log(`   - Thông lượng:     ${Math.round((CONCURRENT_USERS / (totalWriteTime / 1000)))} req/giây`);
  console.log(`   - Độ trễ (ms):     Min: ${wStats.min}ms | Avg: ${wStats.avg}ms | p95: ${wStats.p95}ms | Max: ${wStats.max}ms`);

  console.log(`\n [GET /data - Đọc Dữ Liệu]`);
  console.log(`   - Tổng request:    ${CONCURRENT_USERS}`);
  console.log(`   - Thành công:      ${CONCURRENT_USERS - readErrors} / ${CONCURRENT_USERS} (Tỷ lệ: ${(((CONCURRENT_USERS - readErrors) / CONCURRENT_USERS) * 100).toFixed(1)}%)`);
  console.log(`   - Tổng thời gian:  ${totalReadTime} ms`);
  console.log(`   - Thông lượng:     ${Math.round((CONCURRENT_USERS / (totalReadTime / 1000)))} req/giây`);
  console.log(`   - Độ trễ (ms):     Min: ${rStats.min}ms | Avg: ${rStats.avg}ms | p95: ${rStats.p95}ms | Max: ${rStats.max}ms`);

  console.log("\n------------------------------------------------------------------");
  if (writeErrors === 0 && readErrors === 0) {
    console.log(" 🎉 ĐÁNH GIÁ: HỆ THỐNG HOÀN TOÀN ỔN ĐỊNH — SẴN SÀNG CHỊU TẢI CAO!");
  } else {
    console.log(` ⚠️ CẢNH BÁO: Phát hiện ${writeErrors + readErrors} lỗi trong quá trình tải.`);
  }
  console.log("==================================================================\n");
}

runBenchmark().catch(console.error);
