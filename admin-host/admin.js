(function () {
  "use strict";

  var refreshBtn = document.getElementById("refresh");
  var actionNote = document.getElementById("action-note");
  var okCountEl = document.getElementById("ok-count");
  var totalCountEl = document.getElementById("total-count");
  var avgLatencyEl = document.getElementById("avg-latency");
  var figureLabelEl = document.getElementById("figure-label");
  var apiTimeEl = document.getElementById("api-time");
  var sessionEmailEl = document.getElementById("session-email");
  var checksEl = document.getElementById("checks");
  var globalStatusPill = document.getElementById("global-status");
  var globalStatusText = document.getElementById("global-status-text");
  var autoRefreshCheck = document.getElementById("auto-refresh-check");

  var loading = false;
  var autoTimer = null;

  var SERVICE_META = {
    "chat-proxy": {
      label: "Chat & trợ lý",
      desc: "Trả lời câu hỏi và gợi ý học tập",
      path: "/health",
      auth: "Công khai",
      isToken: false,
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    },
    "data-api": {
      label: "Lưu dữ liệu",
      desc: "Lưu dữ liệu học tập lên đám mây",
      path: "/health",
      auth: "Công khai",
      isToken: false,
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'
    },
    "livekit": {
      label: "Phòng học nhóm",
      desc: "Phòng học video nhóm",
      path: "/usage",
      auth: "Cần mã quản trị",
      isToken: true,
      svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>'
    }
  };

  var numbers = new Intl.NumberFormat("vi-VN");

  function setBusy(state) {
    loading = state;
    refreshBtn.disabled = state;
    if (state) {
      refreshBtn.classList.add("is-loading");
      refreshBtn.querySelector("span").textContent = "Đang cập nhật…";
      actionNote.textContent = "Đang tải số liệu…";
    } else {
      refreshBtn.classList.remove("is-loading");
      refreshBtn.querySelector("span").textContent = "Cập nhật ngay";
    }
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function formatClock(val) {
    var d = new Date(val);
    if (isNaN(d.getTime())) return "Vừa xong";
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  function formatTime(val) {
    var d = new Date(val);
    if (isNaN(d.getTime())) return "Chưa có";
    var opts = {
      hour12: false,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return d.toLocaleString("vi-VN", opts);
  }

  function formatNumber(val) {
    return typeof val === "number" && isFinite(val) ? numbers.format(val) : "--";
  }

  function formatDayTag(val) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(val || ""));
    return m ? m[3] + "/" + m[2] + "/" + m[1] : val || "--";
  }

  function formatMonthTag(val) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(val || ""));
    return m ? "Tháng " + Number(m[2]) + "/" + m[1] : val || "--";
  }

  function formatBytes(val) {
    if (typeof val !== "number" || !isFinite(val) || val < 0) return "--";
    if (val < 1024) return val + " B";
    if (val < 1024 * 1024) return (val / 1024).toFixed(1) + " KB";
    return (val / (1024 * 1024)).toFixed(2) + " MB";
  }

  function setWidth(id, ratio) {
    var el = document.getElementById(id);
    if (!el) return;
    var pct = Math.max(0, Math.min(1, Number(ratio) || 0)) * 100;
    el.style.width = pct.toFixed(1) + "%";
  }

  function setMeterState(id, ratio) {
    var el = document.getElementById(id);
    var meter = el && el.parentElement;
    if (!meter) return;
    meter.classList.remove("is-warn", "is-bad");
    if (ratio >= 1) meter.classList.add("is-bad");
    else if (ratio >= 0.8) meter.classList.add("is-warn");
  }

  var ERROR_LABELS = {
    d1_unavailable: "Chưa kết nối cơ sở dữ liệu",
    d1_error: "Cơ sở dữ liệu không phản hồi",
    missing_url: "Chưa cấu hình địa chỉ",
    missing_token: "Thiếu mã truy cập",
    unreachable: "Không kết nối được"
  };

  function errorLabel(code) {
    if (!code) return "lỗi chưa xác định";
    if (ERROR_LABELS[code]) return ERROR_LABELS[code];
    if (/^http_\d+$/.test(code)) return "nguồn báo lỗi " + code.slice(5);
    return code;
  }

  function markBlock(cardId, noteId, block, defaultNote) {
    var card = document.getElementById(cardId);
    if (!card) return;
    var ok = block && block.ok === true;
    card.classList.toggle("is-degraded", !ok);
    setText(
      noteId,
      ok ? defaultNote : "Không lấy được số liệu: " + errorLabel(block && block.error) + "."
    );
  }

  function clearBlock(ids) {
    ids.forEach(function (id) {
      setText(id, "--");
    });
  }

  function renderRows(checks) {
    checksEl.innerHTML = "";
    checks.forEach(function (c) {
      var meta = SERVICE_META[c.name] || {
        label: "Dịch vụ khác",
        desc: "Dịch vụ phụ trợ",
        path: "/health",
        auth: "Theo mặc định",
        isToken: false,
        svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><circle cx="12" cy="12" r="10"/></svg>'
      };

      var tr = document.createElement("tr");

      var statusBadge = c.ok
        ? '<span class="badge-ok">✓ Bình thường</span>'
        : '<span class="badge-bad">✕ Không phản hồi</span>';

      var authBadge = meta.isToken
        ? '<span class="auth-badge token">' + meta.auth + '</span>'
        : '<span class="auth-badge">' + meta.auth + '</span>';

      var msDisplay = typeof c.ms === "number" ? c.ms + " ms" : "--";

      tr.innerHTML =
        '<td>' +
          '<div class="service-identity">' +
            '<div class="service-avatar">' + meta.svg + '</div>' +
            '<div>' +
              '<div class="service-name">' + escapeHtml(meta.label || c.name) + '</div>' +
              '<div class="service-desc">' + meta.desc + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td>' +
          '<div class="endpoint-pill">' +
            '<span>' + meta.path + '</span>' +
          '</div>' +
        '</td>' +
        '<td>' + authBadge + '</td>' +
        '<td class="latency-cell">' + msDisplay + '</td>' +
        '<td class="text-right">' + statusBadge + '</td>';

      checksEl.appendChild(tr);
    });
  }

  function renderUsage(data) {
    var chat = data.chat || {};
    var sync = data.sync || {};
    var livekit = data.livekit || {};
    var limits = data.limits || {};

    if (chat.ok === true) {
      setText("chat-day", formatDayTag(chat.day));
      setText("chat-total", formatNumber(chat.total));
      setText("chat-users", formatNumber(chat.users));
      setText("chat-limit", formatNumber(chat.dailyLimit));
      var chatRatio = chat.dailyLimit > 0 ? chat.total / chat.dailyLimit : 0;
      setWidth("chat-meter", chatRatio);
      setMeterState("chat-meter", chatRatio);
    } else {
      clearBlock(["chat-day", "chat-total", "chat-users"]);
      setText("chat-limit", formatNumber(limits.chatDaily));
      setWidth("chat-meter", 0);
      setMeterState("chat-meter", 0);
    }
    markBlock("chat-card", "chat-note", chat, "Ngày tính theo giờ Mỹ (Thái Bình Dương). Chi phí dùng AI xem trên trang Cloudflare.");

    if (sync.ok === true) {
      setText("sync-users", formatNumber(sync.users));
      setText("sync-last", sync.lastAt ? formatTime(sync.lastAt) : "Chưa có");
      setText("sync-max", formatBytes(sync.maxBytes));
    } else {
      clearBlock(["sync-users", "sync-last", "sync-max"]);
    }
    markBlock("sync-card", "sync-note", sync, "Dữ liệu học tập tự động lưu lên mây.");

    if (livekit.ok === true) {
      setText("livekit-month", formatMonthTag(livekit.month));
      setText("livekit-used", formatNumber(livekit.usedMinutes));
      setText("livekit-limit", formatNumber(livekit.limitMinutes));
      setText("livekit-rooms", formatNumber(livekit.roomsOpen));
      setText("livekit-people", formatNumber(livekit.participants));
      var liveRatio = livekit.limitMinutes > 0 ? livekit.usedMinutes / livekit.limitMinutes : 0;
      setWidth("livekit-meter", liveRatio);
      setMeterState("livekit-meter", liveRatio);
    } else {
      clearBlock(["livekit-month", "livekit-used", "livekit-limit", "livekit-rooms", "livekit-people"]);
      setWidth("livekit-meter", 0);
      setMeterState("livekit-meter", 0);
    }
    markBlock("livekit-card", "livekit-note", livekit, "Tháng tính theo giờ quốc tế (UTC).");

    setText("limits-chat", formatNumber(limits.chatDaily) + " câu");
    setText("limits-snapshot", formatBytes(limits.snapshotMaxBytes));
    setText("limits-r2", limits.r2 || "--");
  }

  function handleSuccess(data) {
    var health = data.health || {};
    var checks = Array.isArray(health.checks) ? health.checks : [];
    var goodCount = 0;
    var totalMs = 0;
    var validMsCount = 0;

    checks.forEach(function (c) {
      if (c.ok) goodCount++;
      if (typeof c.ms === "number") {
        totalMs += c.ms;
        validMsCount++;
      }
    });

    okCountEl.textContent = String(goodCount);
    totalCountEl.textContent = "/" + checks.length;

    if (validMsCount > 0) {
      avgLatencyEl.textContent = Math.round(totalMs / validMsCount);
    } else {
      avgLatencyEl.textContent = "--";
    }

    apiTimeEl.textContent = data.generatedAt ? formatClock(data.generatedAt) : "Vừa xong";
    sessionEmailEl.textContent = data.email ? String(data.email) : "Chưa xác định";
    sessionEmailEl.title = data.email || "";

    var allGood = checks.length > 0 && goodCount === checks.length;
    if (allGood && !data.degraded) {
      globalStatusPill.className = "status-pill";
      globalStatusText.textContent = "Hệ thống hoạt động bình thường";
      figureLabelEl.textContent = "Tất cả dịch vụ đang chạy tốt";
    } else if (allGood) {
      globalStatusPill.className = "status-pill is-error";
      globalStatusText.textContent = "Hệ thống vẫn chạy, có mục chưa lấy được số";
      figureLabelEl.textContent = "Một phần số liệu chưa lấy được";
    } else {
      globalStatusPill.className = "status-pill is-error";
      globalStatusText.textContent = "Có dịch vụ đang gặp lỗi";
      figureLabelEl.textContent = "Có dịch vụ bị gián đoạn";
    }

    actionNote.textContent = "Vừa cập nhật xong";
    renderRows(checks);
    renderUsage(data);
  }

  function handleFailure(errText) {
    okCountEl.textContent = "!";
    avgLatencyEl.textContent = "--";
    globalStatusPill.className = "status-pill is-error";
    globalStatusText.textContent = "Không kết nối được hệ thống";
    actionNote.textContent = errText || "Có lỗi kết nối";
    figureLabelEl.textContent = "Không kiểm tra được";
  }

  function runCheck() {
    if (loading) return;
    setBusy(true);

    fetch("/api/admin/overview", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) {
          setBusy(false);
          handleFailure("Bạn chưa đăng nhập hoặc chưa được cấp quyền");
          return null;
        }
        if (!res.ok) {
          setBusy(false);
          handleFailure("Máy chủ báo lỗi (mã " + res.status + ")");
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        setBusy(false);
        handleSuccess(data);
      })
      .catch(function () {
        setBusy(false);
        handleFailure("Không thể kết nối đến máy chủ");
      });
  }

  refreshBtn.addEventListener("click", runCheck);

  // Auto Refresh
  function setupAutoRefresh() {
    if (autoTimer) clearInterval(autoTimer);
    if (autoRefreshCheck.checked) {
      autoTimer = setInterval(function () {
        runCheck();
      }, 30000);
    }
  }

  autoRefreshCheck.addEventListener("change", setupAutoRefresh);

  // Run initial check
  runCheck();
  setupAutoRefresh();
})();
