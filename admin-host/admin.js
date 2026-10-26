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
  var errorRowsEl = document.getElementById("error-rows");
  var flagsCard = document.getElementById("flags-card");
  var flagsStateEl = document.getElementById("flags-state");
  var flagChat = document.getElementById("flag-chat");
  var flagRooms = document.getElementById("flag-rooms");
  var flagMaintenance = document.getElementById("flag-maintenance");
  var flagBanner = document.getElementById("flag-banner");
  var flagBannerCount = document.getElementById("flag-banner-count");
  var flagLimit = document.getElementById("flag-limit");
  var flagLimitCurrent = document.getElementById("flag-limit-current");
  var flagSave = document.getElementById("flags-save");
  var flagsNote = document.getElementById("flags-note");

  var loading = false;
  var autoTimer = null;
  var flagsBaseline = null;
  var flagsReadable = false;
  var flagsSaving = false;

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
    if (val < 1024 * 1024 * 1024) return (val / (1024 * 1024)).toFixed(2) + " MB";
    if (val < 1024 ** 4) return (val / 1024 ** 3).toFixed(2) + " GB";
    return (val / 1024 ** 4).toFixed(2) + " TB";
  }

  // R2 dashboard dùng GB thập phân; card kho tệp theo cùng đơn vị để dễ đối chiếu.
  function formatDecimalBytes(val) {
    if (typeof val !== "number" || !isFinite(val) || val < 0) return "--";
    if (val < 1000) return val + " B";
    var units = ["KB", "MB", "GB", "TB"];
    var value = val;
    var index = -1;
    do {
      value /= 1000;
      index += 1;
    } while (value >= 1000 && index < units.length - 1);
    return value.toFixed(2) + " " + units[index];
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
    missing_binding: "Chưa gắn kho R2",
    r2_error: "Kho R2 không phản hồi",
    invalid_json: "Cấu hình lưu sai định dạng",
    kv_error: "Kho cấu hình không phản hồi",
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
    var r2 = data.r2 || {};
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

    if (r2.ok === true) {
      setText("r2-used", formatDecimalBytes(r2.bytes));
      setText("r2-limit", limits.r2 || "--");
      setText("r2-objects", formatNumber(r2.objects));
      setText("r2-state", r2.partial ? "Có thể chưa đủ" : "Đầy đủ");
      var r2Ratio = limits.r2Bytes > 0 ? r2.bytes / limits.r2Bytes : 0;
      setWidth("r2-meter", r2Ratio);
      setMeterState("r2-meter", r2Ratio);
    } else {
      clearBlock(["r2-used", "r2-objects", "r2-state"]);
      setText("r2-limit", limits.r2 || "--");
      setWidth("r2-meter", 0);
      setMeterState("r2-meter", 0);
    }

    var r2Card = document.getElementById("r2-card");
    if (r2Card) r2Card.classList.toggle("is-degraded", r2.ok !== true);
    setText(
      "r2-note",
      r2.ok !== true
        ? "Không đọc được kho tệp: " + errorLabel(r2.error) + "."
        : r2.partial
          ? "Số liệu có thể chưa đủ vì kho quá lớn."
          : "Tính cả tệp cảnh và âm thanh trên R2. Cập nhật tối đa mỗi 60 giây."
    );

    setText("limits-chat", formatNumber(limits.chatDaily) + " câu");
    setText("limits-snapshot", formatBytes(limits.snapshotMaxBytes));
    setText("limits-r2", limits.r2 || "--");
  }

  var SOURCE_LABELS = {
    "chat-proxy": "Trợ lý chat",
    chat: "Số liệu chat",
    sync: "Đồng bộ dữ liệu",
    livekit: "Phòng học nhóm",
    errors: "Nhật ký lỗi",
    r2: "Kho tệp",
    flags: "Cờ hệ thống"
  };

  function renderErrors(block) {
    var items = block && Array.isArray(block.items) ? block.items : [];
    var ok = block && block.ok === true;

    if (!ok) {
      errorRowsEl.innerHTML = '<tr><td colspan="4">Không đọc được nhật ký lỗi.</td></tr>';
      setText("errors-note", "Không đọc được nhật ký lỗi: " + errorLabel(block && block.error) + ".");
    } else if (items.length === 0) {
      errorRowsEl.innerHTML = '<tr><td colspan="4">Chưa có lỗi nào.</td></tr>';
      setText("errors-note", "Không có lỗi nào trong 14 ngày gần đây.");
    } else {
      errorRowsEl.innerHTML = "";
      items.forEach(function (item) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          '<td class="latency-cell">' + escapeHtml(formatTime(item.createdAt)) + '</td>' +
          '<td>' + escapeHtml(SOURCE_LABELS[item.source] || item.source) + '</td>' +
          '<td><span class="endpoint-pill"><span>' + escapeHtml(item.code) + '</span></span></td>' +
          '<td>' + escapeHtml(String(item.message || "").slice(0, 200)) + '</td>';
        errorRowsEl.appendChild(tr);
      });
      setText("errors-note", "Hiện " + items.length + " lỗi mới nhất. Giữ 14 ngày.");
    }

    var card = document.getElementById("errors-card");
    if (card) card.classList.toggle("is-degraded", !ok);
  }

  var FLAG_ERROR_MESSAGES = {
    invalid_body: "Dữ liệu gửi lên không hợp lệ, chưa có thay đổi nào.",
    audit_failed: "Không ghi được nhật ký hành động nên chưa lưu.",
    kv_error: "Kho cấu hình không phản hồi, chưa lưu được.",
    rate_limited: "Bạn vừa lưu quá nhiều lần, chờ một phút rồi thử lại."
  };

  function readFormFlags() {
    return {
      chatEnabled: flagChat.checked,
      roomsEnabled: flagRooms.checked,
      maintenance: flagMaintenance.checked,
      banner: flagBanner.value,
      chatDailyLimit: Number(flagLimit.value)
    };
  }

  function flagsDirty() {
    if (!flagsBaseline) return false;
    var form = readFormFlags();
    return (
      form.chatEnabled !== flagsBaseline.chatEnabled ||
      form.roomsEnabled !== flagsBaseline.roomsEnabled ||
      form.maintenance !== flagsBaseline.maintenance ||
      form.banner !== flagsBaseline.banner ||
      form.chatDailyLimit !== flagsBaseline.chatDailyLimit
    );
  }

  function limitsValid() {
    var value = Number(flagLimit.value);
    return Number.isInteger(value) && value >= 1 && value <= 200;
  }

  function syncFlagsButtons() {
    var canEdit = flagsReadable && !flagsSaving;
    [flagChat, flagRooms, flagMaintenance, flagBanner, flagLimit].forEach(function (el) {
      if (el) el.disabled = !canEdit;
    });
    flagSave.disabled = !canEdit || !flagsDirty();
    flagSave.classList.toggle("is-loading", flagsSaving);
    flagSave.querySelector("span").textContent = flagsSaving ? "Đang lưu…" : "Lưu thay đổi";
  }

  function formatFlagsStamp(updatedAt, updatedBy) {
    if (!updatedAt) return "Chưa ai chỉnh từ bảng điều khiển.";
    var stamp = formatTime(updatedAt);
    return updatedBy ? "Cập nhật lúc " + stamp + " bởi " + updatedBy + "." : "Cập nhật lúc " + stamp + ".";
  }

  function renderFlags(block) {
    if (!block || block.ok !== true) {
      flagsReadable = false;
      flagsCard.classList.add("is-degraded");
      flagsStateEl.textContent = "Không đọc được";
      var reason = block && block.error === "missing_binding" ? "chưa gắn kho cấu hình" : errorLabel(block && block.error);
      flagsNote.textContent = "Không đọc được cờ hệ thống: " + reason + ". Các công tắc đang bị khóa.";
      syncFlagsButtons();
      return;
    }

    flagsReadable = true;
    flagsCard.classList.remove("is-degraded");
    flagsStateEl.textContent = block.chatEnabled && block.roomsEnabled ? "Đang bật đủ" : "Đang tắt bớt";
    flagLimitCurrent.textContent = formatNumber(block.chatDailyLimit);

    // Người đang sửa dở thì không ghi đè ô nhập mỗi lần trang tự cập nhật.
    if (!flagsDirty()) {
      flagsBaseline = {
        chatEnabled: block.chatEnabled === true,
        roomsEnabled: block.roomsEnabled === true,
        maintenance: block.maintenance === true,
        banner: String(block.banner || ""),
        chatDailyLimit: Number(block.chatDailyLimit) || 30
      };
      flagChat.checked = flagsBaseline.chatEnabled;
      flagRooms.checked = flagsBaseline.roomsEnabled;
      flagMaintenance.checked = flagsBaseline.maintenance;
      flagBanner.value = flagsBaseline.banner;
      flagLimit.value = String(flagsBaseline.chatDailyLimit);
      flagBannerCount.textContent = String(flagsBaseline.banner.length);
    }
    flagsNote.textContent = formatFlagsStamp(block.updatedAt, block.updatedBy);
    syncFlagsButtons();
  }

  function saveFlags() {
    if (!flagsReadable || flagsSaving || !flagsDirty()) return;
    if (!limitsValid()) {
      flagsNote.textContent = "Hạn mức phải là số nguyên từ 1 đến 200 câu.";
      flagLimit.focus();
      return;
    }

    var next = readFormFlags();
    var lines = ["Lưu thay đổi cờ hệ thống?"];
    if (flagsBaseline.chatEnabled && !next.chatEnabled) {
      lines.push("Tắt chat sẽ chặn tất cả người dùng ngay.");
    }
    if (flagsBaseline.roomsEnabled && !next.roomsEnabled) {
      lines.push("Tắt phòng học nhóm sẽ chặn tạo phòng mới ngay.");
    }
    if (next.chatDailyLimit < flagsBaseline.chatDailyLimit) {
      lines.push("Hạ hạn mức xuống " + next.chatDailyLimit + " câu sẽ chặn người đã dùng nhiều hơn tới hết ngày.");
    }
    if (next.maintenance) {
      lines.push("Chế độ bảo trì hiện banner cho mọi người; chat và phòng học vẫn chạy.");
    }
    if (!window.confirm(lines.join("\n\n"))) return;

    flagsSaving = true;
    syncFlagsButtons();
    flagsNote.textContent = "Đang lưu…";

    fetch("/api/admin/flags", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(next)
    })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Phiên đăng nhập đã hết hạn, tải lại trang rồi thử lại.");
        }
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { ok: res.ok, data: data };
          });
      })
      .then(function (result) {
        flagsSaving = false;
        if (!result.ok || !result.data || result.data.ok !== true) {
          var code = result.data && result.data.error;
          flagsNote.textContent = FLAG_ERROR_MESSAGES[code] || "Không lưu được thay đổi, thử lại sau.";
          syncFlagsButtons();
          return;
        }
        flagsBaseline = null;
        renderFlags(Object.assign({ ok: true }, result.data.flags));
        runCheck();
      })
      .catch(function (err) {
        flagsSaving = false;
        flagsNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        syncFlagsButtons();
      });
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
    renderErrors(data.errors || {});
    renderFlags(data.flags || {});
  }

  function handleFailure(errText) {
    okCountEl.textContent = "!";
    avgLatencyEl.textContent = "--";
    globalStatusPill.className = "status-pill is-error";
    globalStatusText.textContent = "Không kết nối được hệ thống";
    actionNote.textContent = errText || "Có lỗi kết nối";
    figureLabelEl.textContent = "Không kiểm tra được";

    flagsReadable = false;
    flagsStateEl.textContent = "Không đọc được";
    flagsNote.textContent = errText || "Có lỗi kết nối";
    syncFlagsButtons();
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

  [flagChat, flagRooms, flagMaintenance, flagBanner, flagLimit].forEach(function (el) {
    el.addEventListener("input", function () {
      flagBannerCount.textContent = String(flagBanner.value.length);
      syncFlagsButtons();
    });
    el.addEventListener("change", syncFlagsButtons);
  });
  flagSave.addEventListener("click", saveFlags);

  // Run initial check
  syncFlagsButtons();
  runCheck();
  setupAutoRefresh();
})();
