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

  /* ================= CHAT CONFIG ================= */

  var chatCard = document.getElementById("chat-cfg-card");
  var chatStateEl = document.getElementById("chat-cfg-state");
  var chatModel = document.getElementById("chat-model");
  var chatTemp = document.getElementById("chat-temp");
  var chatTokens = document.getElementById("chat-tokens");
  var chatModelNote = document.getElementById("chat-model-note");
  var chatModelSave = document.getElementById("chat-model-save");
  var chatTestModel = document.getElementById("chat-test-model");
  var chatTestResult = document.getElementById("chat-test-result");
  var chatChainEl = document.getElementById("chat-chain");
  var chatChainModelsEl = document.getElementById("chat-chain-models");
  var chatChainHint = document.getElementById("chat-chain-hint");
  var chatChainNote = document.getElementById("chat-chain-note");
  var chatChainAdd = document.getElementById("chat-chain-add");
  var chatChainSave = document.getElementById("chat-chain-save");
  var chatPrompt = document.getElementById("chat-prompt");
  var chatPromptCount = document.getElementById("chat-prompt-count");
  var chatPromptNote = document.getElementById("chat-prompt-note");
  var chatPromptSave = document.getElementById("chat-prompt-save");
  var chatProvidersEl = document.getElementById("chat-providers");
  var chatProviderId = document.getElementById("chat-provider-id");
  var chatProviderType = document.getElementById("chat-provider-type");
  var chatProviderLabel = document.getElementById("chat-provider-label");
  var chatProviderUrl = document.getElementById("chat-provider-url");
  var chatProviderKey = document.getElementById("chat-provider-key");
  var chatProviderKeyHint = document.getElementById("chat-provider-key-hint");
  var chatProviderNote = document.getElementById("chat-provider-note");
  var chatProviderCheck = document.getElementById("chat-provider-check");
  var chatProviderCheckResult = document.getElementById("chat-provider-check-result");
  var chatProviderReset = document.getElementById("chat-provider-reset");
  var chatProviderApply = document.getElementById("chat-provider-apply");
  var chatProviderSave = document.getElementById("chat-provider-save");

  var CHAT_PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-_]{0,39}$/i;
  var CHAT_CHAIN_MAX_FALLBACK = 5;
  var CHAT_PROVIDERS_MAX = 10;
  var CHAT_TEMP_MAX = 2;
  var CHAT_TOKENS_MIN = 256;
  var CHAT_TOKENS_MAX = 8000;
  var CHAT_PROMPT_MAX = 4000;

  var CHAT_ERROR_MESSAGES = {
    missing_config: "chưa cấu hình địa chỉ hoặc mã chat-proxy",
    chat_proxy_unreachable: "không kết nối được chat-proxy",
    invalid_body: "dữ liệu chưa hợp lệ, kiểm tra lại các ô",
    audit_failed: "không ghi được nhật ký hành động nên chưa lưu",
    rate_limited: "bạn vừa thao tác quá nhiều lần, chờ một phút rồi thử lại"
  };

  var chatCfg = null;
  var chatCfgReadable = false;
  var chatBusy = false;
  var chatBusyButton = null;
  var chatChain = [];
  var chatChainBaseline = [];
  var chatProviders = [];
  var chatProvidersBaseline = [];
  var chatProviderEditId = "";
  var chatProviderModels = {};
  var chatPromptBaseline = "";

  function chatErrorText(code) {
    if (!code) return "lỗi chưa xác định";
    if (CHAT_ERROR_MESSAGES[code]) return CHAT_ERROR_MESSAGES[code];
    if (/^chat_proxy_http_\d+$/.test(code)) return "chat-proxy báo lỗi " + code.slice(16);
    if (/^http_\d+$/.test(code)) return "chat-proxy báo lỗi " + code.slice(5);
    return String(code);
  }

  function cloneList(list) {
    return list.map(function (item) {
      return Object.assign({}, item);
    });
  }

  function sameJson(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function chatRequest(url, options) {
    options = options || {};
    return fetch(url, {
      method: options.method || "GET",
      headers: Object.assign(
        { Accept: "application/json" },
        options.body !== undefined ? { "Content-Type": "application/json" } : {}
      ),
      credentials: "same-origin",
      cache: "no-store",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      if (res.status === 401 || res.status === 403) {
        throw new Error("Phiên đăng nhập đã hết hạn, tải lại trang rồi thử lại.");
      }
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          return { ok: res.ok, status: res.status, data: data || {} };
        });
    });
  }

  function chainMax() {
    return chatCfg && chatCfg.maxChain ? chatCfg.maxChain : CHAT_CHAIN_MAX_FALLBACK;
  }

  // chat-proxy trả mỗi model là object {id, context, ...}; chuẩn hóa về danh sách id.
  function modelIds(models) {
    return (Array.isArray(models) ? models : [])
      .map(function (model) {
        if (typeof model === "string") return model;
        return model && typeof model.id === "string" ? model.id : "";
      })
      .filter(Boolean);
  }

  function modelDirty() {
    if (!chatCfg) return false;
    return (
      chatModel.value !== chatCfg.current ||
      Number(chatTemp.value) !== chatCfg.gen.temperature ||
      Number(chatTokens.value) !== chatCfg.gen.max_tokens
    );
  }

  function genValid() {
    var temp = Number(chatTemp.value);
    var tokens = Number(chatTokens.value);
    return (
      Number.isFinite(temp) &&
      temp >= 0 &&
      temp <= CHAT_TEMP_MAX &&
      Number.isInteger(tokens) &&
      tokens >= CHAT_TOKENS_MIN &&
      tokens <= CHAT_TOKENS_MAX
    );
  }

  function chainDirty() {
    return !sameJson(chatChain, chatChainBaseline);
  }

  function chainValid() {
    if (!chatChain.length || chatChain.length > chainMax()) return false;
    var cfKeys = {};
    if (chatCfg) {
      chatCfg.available.forEach(function (model) {
        cfKeys[model.key] = true;
      });
    }
    return chatChain.every(function (entry) {
      if (!entry.modelId) return false;
      if (entry.provider === "cf") return cfKeys[entry.modelId] === true;
      return chatProviders.some(function (p) {
        return p.id === entry.provider && p.enabled !== false;
      });
    });
  }

  function promptDirty() {
    return chatPrompt.value !== chatPromptBaseline;
  }

  function providersDirty() {
    return !sameJson(chatProviders, chatProvidersBaseline);
  }

  function readProviderForm() {
    return {
      id: chatProviderId.value.trim(),
      type: chatProviderType.value || "custom",
      label: chatProviderLabel.value.trim(),
      baseUrl: chatProviderUrl.value.trim().replace(/\/+$/, ""),
      apiKey: chatProviderKey.value.trim(),
      enabled: true
    };
  }

  function providerFormValid() {
    var form = readProviderForm();
    if (!CHAT_PROVIDER_ID_RE.test(form.id)) return false;
    if (!/^https:\/\/.+/.test(form.baseUrl) || form.baseUrl.length > 200) return false;
    if (!form.apiKey || form.apiKey.length > 500) return false;
    if (!chatProviderEditId) {
      return !chatProviders.some(function (p) {
        return p.id === form.id;
      });
    }
    return true;
  }

  function checkKeyValid() {
    var form = readProviderForm();
    return (
      /^https:\/\/.+/.test(form.baseUrl) &&
      !!form.apiKey &&
      form.apiKey.indexOf("***") !== 0 &&
      form.apiKey.length <= 500
    );
  }

  function syncChatButtons() {
    var canEdit = chatCfgReadable && !chatBusy;
    [chatModel, chatTemp, chatTokens, chatPrompt].forEach(function (el) {
      el.disabled = !canEdit;
    });

    chatTestModel.disabled = !canEdit || !chatModel.value;
    chatModelSave.disabled = !canEdit || !modelDirty() || !genValid();
    chatChainAdd.disabled = !canEdit || chatChain.length >= chainMax();
    chatChainSave.disabled = !canEdit || !chainDirty() || !chainValid();
    chatPromptSave.disabled = !canEdit || !promptDirty();
    chatProviderSave.disabled = !canEdit || !providersDirty();

    chatProviderId.disabled = !canEdit || !!chatProviderEditId;
    chatProviderType.disabled = !canEdit;
    chatProviderLabel.disabled = !canEdit;
    chatProviderUrl.disabled = !canEdit;
    chatProviderKey.disabled = !canEdit;
    chatProviderCheck.disabled = !canEdit || !checkKeyValid();
    chatProviderReset.disabled = !canEdit;
    chatProviderApply.disabled = !canEdit || !providerFormValid();

    var maxSteps = chainMax();
    chatChainHint.textContent =
      !chatChain.length || chainValid()
        ? "Tối đa " + maxSteps + " bước. Hết bước trước mới thử bước sau."
        : "Có bước chưa hợp lệ: chọn model Cloudflare trong danh sách hoặc bật lại hãng. Tối đa " + maxSteps + " bước.";

    [chatModelSave, chatChainSave, chatPromptSave, chatProviderSave].forEach(function (btn) {
      var busy = chatBusy && chatBusyButton === btn;
      btn.classList.toggle("is-loading", busy);
      btn.querySelector("span").textContent = busy ? "Đang lưu…" : btn.getAttribute("data-label");
    });
  }

  function showTestResult(text, isError) {
    chatTestResult.hidden = false;
    chatTestResult.className = "chat-test" + (isError ? " is-error" : " is-ok");
    chatTestResult.textContent = text;
  }

  function testModel(provider, modelId, slot) {
    if (!provider || !modelId) return;
    if (slot) {
      slot.textContent = "Đang thử…";
      slot.className = "chat-chain-result";
    }
    chatRequest("/api/admin/chat/test", {
      method: "POST",
      body: { provider: provider, modelId: modelId }
    })
      .then(function (result) {
        if (!result.ok || result.data.ok !== true) {
          var failText = "Lỗi: " + chatErrorText(result.data && result.data.error);
          if (slot) {
            slot.textContent = failText;
            slot.className = "chat-chain-result is-error";
          } else {
            showTestResult(failText, true);
          }
          return;
        }
        var text = String(result.data.text || "").trim();
        var line =
          (text ? text.slice(0, 200) : "(không có chữ trả về)") +
          " · " +
          formatNumber(result.data.ms) +
          " ms";
        if (slot) {
          slot.textContent = line;
          slot.className = "chat-chain-result is-ok";
        } else {
          showTestResult(line, false);
        }
      })
      .catch(function (err) {
        var errText = (err && err.message) || "Không kết nối được máy chủ.";
        if (slot) {
          slot.textContent = errText;
          slot.className = "chat-chain-result is-error";
        } else {
          showTestResult(errText, true);
        }
      });
  }

  function updateChainDatalist() {
    var seen = {};
    var entries = [];
    function add(key, label) {
      if (!key || seen[key]) return;
      seen[key] = true;
      entries.push({ key: key, label: label || "" });
    }
    if (chatCfg) {
      chatCfg.available.forEach(function (model) {
        add(model.key, model.label);
      });
    }
    Object.keys(chatProviderModels).forEach(function (id) {
      chatProviderModels[id].forEach(function (key) {
        add(key, id);
      });
    });
    chatChainModelsEl.innerHTML = "";
    entries.forEach(function (item) {
      var option = document.createElement("option");
      option.value = item.key;
      if (item.label) option.label = item.label;
      chatChainModelsEl.appendChild(option);
    });
  }

  function providerButton(label, onClick, danger) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-ghost chat-mini-btn" + (danger ? " is-danger" : "");
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function chainProviderOptions() {
    var list = [{ id: "cf", label: "Cloudflare" }];
    chatProviders.forEach(function (p) {
      list.push({ id: p.id, label: (p.label || p.id) + (p.enabled === false ? " (đang tắt)" : "") });
    });
    return list;
  }

  function renderChatChain() {
    chatChainEl.innerHTML = "";
    if (!chatChain.length) {
      var empty = document.createElement("p");
      empty.className = "chat-empty";
      empty.textContent = "Chưa có bước dự phòng. Trợ lý sẽ chỉ dùng model Cloudflare.";
      chatChainEl.appendChild(empty);
    }

    var providers = chainProviderOptions();
    chatChain.forEach(function (entry, index) {
      var row = document.createElement("div");
      row.className = "chat-chain-row";

      var step = document.createElement("span");
      step.className = "chat-chain-step";
      step.textContent = String(index + 1);

      var providerSelect = document.createElement("select");
      providerSelect.className = "flag-input chat-chain-provider";
      providers.forEach(function (p) {
        var option = document.createElement("option");
        option.value = p.id;
        option.textContent = p.label;
        providerSelect.appendChild(option);
      });
      if (
        !providers.some(function (p) {
          return p.id === entry.provider;
        })
      ) {
        var missing = document.createElement("option");
        missing.value = entry.provider;
        missing.textContent = entry.provider + " (không còn)";
        providerSelect.appendChild(missing);
      }
      providerSelect.value = entry.provider;
      providerSelect.disabled = !chatCfgReadable || chatBusy;
      providerSelect.addEventListener("change", function () {
        entry.provider = providerSelect.value;
        entry.modelId = entry.provider === "cf" ? chatModel.value || "" : "";
        renderChatChain();
        syncChatButtons();
      });

      var modelInput = document.createElement("input");
      modelInput.className = "flag-input chat-chain-model";
      modelInput.type = "text";
      modelInput.maxLength = 200;
      modelInput.value = entry.modelId;
      modelInput.placeholder = entry.provider === "cf" ? "Chọn model Cloudflare" : "Mã model của hãng";
      modelInput.setAttribute("list", "chat-chain-models");
      modelInput.autocomplete = "off";
      modelInput.spellcheck = false;
      modelInput.disabled = !chatCfgReadable || chatBusy;
      modelInput.addEventListener("input", function () {
        entry.modelId = modelInput.value;
        syncChatButtons();
      });

      var result = document.createElement("span");
      result.className = "chat-chain-result";

      var testBtn = providerButton("Thử", function () {
        testModel(entry.provider, entry.modelId, result);
      });
      testBtn.disabled = !chatCfgReadable || chatBusy || !entry.modelId;

      var upBtn = providerButton("↑", function () {
        moveChain(index, -1);
      });
      upBtn.disabled = index === 0 || chatBusy;
      upBtn.title = "Đưa lên trước";

      var downBtn = providerButton("↓", function () {
        moveChain(index, 1);
      });
      downBtn.disabled = index === chatChain.length - 1 || chatBusy;
      downBtn.title = "Đưa xuống sau";

      var removeBtn = providerButton(
        "✕",
        function () {
          chatChain.splice(index, 1);
          renderChatChain();
          syncChatButtons();
        },
        true
      );
      removeBtn.disabled = chatBusy;
      removeBtn.title = "Bỏ bước này";
      removeBtn.setAttribute("aria-label", "Bỏ bước " + (index + 1));

      row.appendChild(step);
      row.appendChild(providerSelect);
      row.appendChild(modelInput);
      row.appendChild(result);
      row.appendChild(testBtn);
      row.appendChild(upBtn);
      row.appendChild(downBtn);
      row.appendChild(removeBtn);
      chatChainEl.appendChild(row);
    });

    updateChainDatalist();
  }

  function moveChain(index, delta) {
    var next = index + delta;
    if (next < 0 || next >= chatChain.length) return;
    var item = chatChain[index];
    chatChain[index] = chatChain[next];
    chatChain[next] = item;
    renderChatChain();
    syncChatButtons();
  }

  function addChain() {
    if (!chatCfgReadable || chatBusy || chatChain.length >= chainMax()) return;
    var firstEnabled = chatProviders.filter(function (p) {
      return p.enabled !== false;
    })[0];
    var provider = firstEnabled ? firstEnabled.id : "cf";
    chatChain.push({
      provider: provider,
      modelId: provider === "cf" ? chatModel.value || "" : ""
    });
    renderChatChain();
    syncChatButtons();
  }

  function renderChatProviders() {
    chatProvidersEl.innerHTML = "";
    if (!chatProviders.length) {
      var empty = document.createElement("p");
      empty.className = "chat-empty";
      empty.textContent = "Chưa có nhà cung cấp nào. Model Cloudflare là đủ nếu không cần dự phòng.";
      chatProvidersEl.appendChild(empty);
      return;
    }

    chatProviders.forEach(function (provider) {
      var row = document.createElement("div");
      row.className = "chat-provider-row" + (provider.enabled === false ? " is-off" : "");

      var main = document.createElement("div");
      main.className = "chat-provider-main";

      var title = document.createElement("div");
      title.className = "chat-provider-title";
      var name = document.createElement("span");
      name.className = "chat-provider-name";
      name.textContent = provider.label || provider.id;
      var idTag = document.createElement("span");
      idTag.className = "chat-provider-id";
      idTag.textContent = provider.id;
      title.appendChild(name);
      title.appendChild(idTag);

      var meta = document.createElement("div");
      meta.className = "chat-provider-meta";
      var preset =
        chatCfg && chatCfg.presets && chatCfg.presets[provider.type]
          ? chatCfg.presets[provider.type].label
          : provider.type;
      meta.textContent =
        preset +
        " · " +
        provider.baseUrl +
        " · " +
        (provider.apiKey ? "đã có key" : "chưa có key");

      var modelsSlot = document.createElement("span");
      modelsSlot.className = "chat-provider-models";
      modelsSlot.setAttribute("data-provider-models", provider.id);

      main.appendChild(title);
      main.appendChild(meta);
      main.appendChild(modelsSlot);

      var actions = document.createElement("div");
      actions.className = "chat-provider-actions";

      var switchLabel = document.createElement("label");
      switchLabel.className = "chat-mini-switch";
      switchLabel.title = provider.enabled === false ? "Đang tắt" : "Đang bật";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = provider.enabled !== false;
      checkbox.disabled = !chatCfgReadable || chatBusy;
      checkbox.addEventListener("change", function () {
        provider.enabled = checkbox.checked;
        renderChatProviders();
        syncChatButtons();
      });
      var track = document.createElement("span");
      track.className = "switch-track";
      track.setAttribute("aria-hidden", "true");
      switchLabel.appendChild(checkbox);
      switchLabel.appendChild(track);
      actions.appendChild(switchLabel);

      actions.appendChild(
        providerButton("Sửa", function () {
          editProvider(provider.id);
        })
      );
      actions.appendChild(
        providerButton("Xem model", function () {
          loadProviderModels(provider.id);
        })
      );
      actions.appendChild(
        providerButton(
          "Xóa",
          function () {
            removeProvider(provider.id);
          },
          true
        )
      );

      row.appendChild(main);
      row.appendChild(actions);
      chatProvidersEl.appendChild(row);
    });
  }

  function editProvider(id) {
    var provider = chatProviders.filter(function (p) {
      return p.id === id;
    })[0];
    if (!provider) return;
    chatProviderEditId = provider.id;
    chatProviderId.value = provider.id;
    chatProviderType.value = provider.type || "custom";
    chatProviderLabel.value = provider.label || "";
    chatProviderUrl.value = provider.baseUrl || "";
    chatProviderKey.value = provider.apiKey || "";
    chatProviderKeyHint.textContent = provider.apiKey
      ? "Đang giữ key đã lưu. Xóa ô rồi dán key mới nếu muốn đổi."
      : "Chưa có key đã lưu, dán key của hãng vào đây.";
    chatProviderApply.textContent = "Cập nhật trong danh sách";
    chatProviderCheckResult.hidden = true;
    chatProviderCheckResult.textContent = "";
    chatProviderNote.textContent = "Đang sửa “" + (provider.label || provider.id) + "”. Chưa áp dụng tới khi bấm cập nhật.";
    syncChatButtons();
  }

  function resetProviderForm() {
    chatProviderEditId = "";
    chatProviderId.value = "";
    chatProviderLabel.value = "";
    chatProviderUrl.value = "";
    chatProviderKey.value = "";
    chatProviderKeyHint.textContent = "Key chỉ gửi lên máy chủ, không lưu trong trình duyệt.";
    if (chatProviderType.options.length) {
      chatProviderType.value = chatProviderType.options[0].value;
    }
    if (chatCfg && chatCfg.presets && chatCfg.presets[chatProviderType.value]) {
      chatProviderUrl.value = chatCfg.presets[chatProviderType.value].baseUrl || "";
    }
    chatProviderApply.textContent = "Thêm vào danh sách";
    chatProviderCheckResult.hidden = true;
    chatProviderCheckResult.textContent = "";
    syncChatButtons();
  }

  function applyProvider() {
    if (!providerFormValid()) {
      chatProviderNote.textContent = "Kiểm tra mã, địa chỉ https và key trước khi thêm.";
      return;
    }
    var entry = readProviderForm();
    entry.label = entry.label || entry.id;
    if (chatProviderEditId) {
      chatProviders = chatProviders.map(function (p) {
        if (p.id !== chatProviderEditId) return p;
        return Object.assign({}, p, {
          type: entry.type,
          label: entry.label,
          baseUrl: entry.baseUrl,
          apiKey: entry.apiKey
        });
      });
    } else {
      if (chatProviders.length >= CHAT_PROVIDERS_MAX) {
        chatProviderNote.textContent = "Tối đa " + CHAT_PROVIDERS_MAX + " nhà cung cấp.";
        return;
      }
      chatProviders.push(entry);
    }
    resetProviderForm();
    renderChatProviders();
    chatProviderNote.textContent = "Đã cập nhật danh sách nháp. Bấm “Lưu nhà cung cấp” để áp dụng.";
    syncChatButtons();
  }

  function removeProvider(id) {
    var usedInChain = chatChain.some(function (entry) {
      return entry.provider === id;
    });
    if (usedInChain) {
      chatProviderNote.textContent = "Bỏ bước “" + id + "” khỏi thứ tự dự phòng trước khi xóa nhà cung cấp.";
      return;
    }
    if (!window.confirm("Xóa nhà cung cấp “" + id + "” khỏi danh sách nháp?\n\nChưa áp dụng tới khi bấm “Lưu nhà cung cấp”.")) {
      return;
    }
    chatProviders = chatProviders.filter(function (p) {
      return p.id !== id;
    });
    if (chatProviderEditId === id) resetProviderForm();
    renderChatProviders();
    chatProviderNote.textContent = "Đã bỏ “" + id + "” khỏi danh sách nháp. Bấm “Lưu nhà cung cấp” để áp dụng.";
    syncChatButtons();
  }

  function loadProviderModels(id) {
    var slot = chatProvidersEl.querySelector('[data-provider-models="' + id + '"]');
    if (slot) slot.textContent = "Đang đọc model…";
    chatRequest("/api/admin/chat/provider-models?id=" + encodeURIComponent(id))
      .then(function (result) {
        if (!result.ok || result.data.ok !== true) {
          if (slot) slot.textContent = "Không lấy được: " + chatErrorText(result.data && result.data.error) + ".";
          return;
        }
        var models = modelIds(result.data.models);
        chatProviderModels[id] = models;
        updateChainDatalist();
        if (slot) {
          slot.textContent = models.length
            ? "Model: " + models.slice(0, 30).join(", ") + (models.length > 30 ? "…" : "")
            : "Hãng không trả về model nào.";
        }
      })
      .catch(function (err) {
        if (slot) slot.textContent = (err && err.message) || "Không kết nối được máy chủ.";
      });
  }

  function checkProviderKey() {
    var form = readProviderForm();
    if (!checkKeyValid()) {
      chatProviderNote.textContent = "Cần địa chỉ https và key thật (không phải key đã che) để kiểm tra.";
      return;
    }
    chatBusy = true;
    chatBusyButton = null;
    syncChatButtons();
    chatProviderNote.textContent = "Đang kiểm tra key…";
    chatProviderCheckResult.hidden = true;
    chatRequest("/api/admin/chat/check-key", { method: "POST", body: form })
      .then(function (result) {
        chatBusy = false;
        if (!result.ok || result.data.ok !== true) {
          chatProviderNote.textContent = "Key chưa dùng được: " + chatErrorText(result.data && result.data.error) + ".";
          syncChatButtons();
          return;
        }
        var models = modelIds(result.data.models);
        chatProviderCheckResult.hidden = false;
        chatProviderCheckResult.className = "chat-test is-ok";
        chatProviderCheckResult.textContent =
          "Key dùng được, thấy " +
          formatNumber(result.data.count || models.length) +
          " model" +
          (models.length ? ": " + models.slice(0, 12).join(", ") + (models.length > 12 ? "…" : "") : ".");
        chatProviderNote.textContent = "Chưa lưu gì. Kiểm tra xong thì bấm “Thêm vào danh sách”.";
        syncChatButtons();
      })
      .catch(function (err) {
        chatBusy = false;
        chatProviderNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        syncChatButtons();
      });
  }

  function postChatCfg(kind, payload) {
    return chatRequest("/api/admin/chat/config", {
      method: "POST",
      body: Object.assign({ kind: kind }, payload)
    }).then(function (result) {
      if (!result.ok || result.data.ok !== true) {
        return { ok: false, error: result.data && result.data.error };
      }
      return { ok: true };
    });
  }

  function reloadChatConfig() {
    return loadChatConfig().then(function () {
      chatBusy = false;
      chatBusyButton = null;
      syncChatButtons();
    });
  }

  function saveModel() {
    if (chatBusy || !chatCfgReadable || !modelDirty()) return;
    if (!genValid()) {
      chatModelNote.textContent =
        "Độ sáng tạo phải từ 0 đến 2; độ dài phải là số nguyên từ 256 đến 8000.";
      return;
    }
    var modelChanged = chatModel.value !== chatCfg.current;
    var genChanged =
      Number(chatTemp.value) !== chatCfg.gen.temperature ||
      Number(chatTokens.value) !== chatCfg.gen.max_tokens;
    if (!modelChanged && !genChanged) return;

    var steps = [];
    if (modelChanged) {
      if (!window.confirm("Đổi model trả lời sang “" + chatModel.value + "”?")) return;
      steps.push({ kind: "model", payload: { cfModel: chatModel.value } });
    }
    if (genChanged) {
      steps.push({
        kind: "gen",
        payload: { temperature: Number(chatTemp.value), max_tokens: Number(chatTokens.value) }
      });
    }

    chatBusy = true;
    chatBusyButton = chatModelSave;
    syncChatButtons();
    chatModelNote.textContent = "Đang lưu…";

    var chain = Promise.resolve(true);
    steps.forEach(function (step) {
      chain = chain.then(function (ok) {
        if (!ok) return false;
        return postChatCfg(step.kind, step.payload).then(function (result) {
          if (!result.ok) {
            chatModelNote.textContent = "Không lưu được: " + chatErrorText(result.error) + ".";
            return false;
          }
          return true;
        });
      });
    });

    chain
      .then(function (ok) {
        if (!ok) {
          chatBusy = false;
          chatBusyButton = null;
          syncChatButtons();
          return;
        }
        return reloadChatConfig().then(function () {
          chatModelNote.textContent = "Đã lưu model. Chờ khoảng 60 giây để chat-proxy áp dụng.";
        });
      })
      .catch(function (err) {
        chatBusy = false;
        chatBusyButton = null;
        chatModelNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        syncChatButtons();
      });
  }

  function saveChain() {
    if (chatBusy || !chatCfgReadable || !chainDirty() || !chainValid()) return;
    var lines = ["Lưu thứ tự dự phòng?"];
    chatChain.forEach(function (entry, index) {
      lines.push(index + 1 + ". " + entry.provider + " · " + entry.modelId);
    });
    if (!window.confirm(lines.join("\n"))) return;

    chatBusy = true;
    chatBusyButton = chatChainSave;
    syncChatButtons();
    chatChainNote.textContent = "Đang lưu…";
    postChatCfg("chain", { chain: chatChain })
      .then(function (result) {
        if (!result.ok) {
          chatBusy = false;
          chatBusyButton = null;
          chatChainNote.textContent = "Không lưu được: " + chatErrorText(result.error) + ".";
          syncChatButtons();
          return;
        }
        return reloadChatConfig().then(function () {
          chatChainNote.textContent = "Đã lưu thứ tự. Chờ khoảng 60 giây để chat-proxy áp dụng.";
        });
      })
      .catch(function (err) {
        chatBusy = false;
        chatBusyButton = null;
        chatChainNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        syncChatButtons();
      });
  }

  function savePrompt() {
    if (chatBusy || !chatCfgReadable || !promptDirty()) return;
    var prompt = chatPrompt.value;
    if (!prompt.trim()) {
      chatPromptNote.textContent = "Câu lệnh không được để trống.";
      chatPrompt.focus();
      return;
    }
    if (prompt.length > CHAT_PROMPT_MAX) {
      chatPromptNote.textContent = "Câu lệnh tối đa " + CHAT_PROMPT_MAX + " ký tự.";
      return;
    }
    if (!window.confirm("Lưu câu lệnh hệ thống mới? (" + prompt.length + " ký tự)")) return;

    chatBusy = true;
    chatBusyButton = chatPromptSave;
    syncChatButtons();
    chatPromptNote.textContent = "Đang lưu…";
    postChatCfg("prompt", { prompt: prompt })
      .then(function (result) {
        if (!result.ok) {
          chatBusy = false;
          chatBusyButton = null;
          chatPromptNote.textContent = "Không lưu được: " + chatErrorText(result.error) + ".";
          syncChatButtons();
          return;
        }
        return reloadChatConfig().then(function () {
          chatPromptNote.textContent = "Đã lưu câu lệnh. Chờ khoảng 60 giây để chat-proxy áp dụng.";
        });
      })
      .catch(function (err) {
        chatBusy = false;
        chatBusyButton = null;
        chatPromptNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        syncChatButtons();
      });
  }

  function saveProviders() {
    if (chatBusy || !chatCfgReadable || !providersDirty()) return;
    if (!chatProviders.length) {
      chatProviderNote.textContent = "Cần ít nhất một nhà cung cấp, hoặc giữ danh sách trống.";
      return;
    }
    var seen = {};
    for (var i = 0; i < chatProviders.length; i++) {
      var p = chatProviders[i];
      if (!CHAT_PROVIDER_ID_RE.test(p.id) || seen[p.id]) {
        chatProviderNote.textContent = "Mã nhà cung cấp “" + p.id + "” không hợp lệ hoặc bị trùng.";
        return;
      }
      seen[p.id] = true;
      if (!/^https:\/\/.+/.test(p.baseUrl)) {
        chatProviderNote.textContent = "Địa chỉ của “" + p.id + "” phải bắt đầu bằng https://";
        return;
      }
      if (!p.apiKey) {
        chatProviderNote.textContent = "“" + p.id + "” chưa có API key.";
        return;
      }
    }
    if (
      !window.confirm(
        "Lưu danh sách " + chatProviders.length + " nhà cung cấp?\n\nKey đã che sẽ giữ nguyên key cũ trên máy chủ."
      )
    ) {
      return;
    }

    chatBusy = true;
    chatBusyButton = chatProviderSave;
    syncChatButtons();
    chatProviderNote.textContent = "Đang lưu…";
    var payload = chatProviders.map(function (p) {
      return {
        id: p.id,
        type: p.type,
        label: p.label,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey,
        enabled: p.enabled !== false
      };
    });
    postChatCfg("providers", { providers: payload })
      .then(function (result) {
        if (!result.ok) {
          chatBusy = false;
          chatBusyButton = null;
          chatProviderNote.textContent = "Không lưu được: " + chatErrorText(result.error) + ".";
          syncChatButtons();
          return;
        }
        return reloadChatConfig().then(function () {
          chatProviderNote.textContent = "Đã lưu danh sách. Chờ khoảng 60 giây để chat-proxy áp dụng.";
        });
      })
      .catch(function (err) {
        chatBusy = false;
        chatBusyButton = null;
        chatProviderNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        syncChatButtons();
      });
  }

  function renderChatConfig(config) {
    chatCfg = config;
    chatCfgReadable = true;
    chatCard.classList.remove("is-degraded");
    chatStateEl.textContent = "Đang dùng cấu hình đã lưu";

    var available = Array.isArray(config.available) ? config.available : [];
    chatModel.innerHTML = "";
    available.forEach(function (model) {
      var option = document.createElement("option");
      option.value = model.key;
      option.textContent = (model.label || model.key) + " (" + model.key + ")";
      chatModel.appendChild(option);
    });
    if (
      config.current &&
      !available.some(function (model) {
        return model.key === config.current;
      })
    ) {
      var currentOption = document.createElement("option");
      currentOption.value = config.current;
      currentOption.textContent = config.current + " (không có trong danh sách)";
      chatModel.appendChild(currentOption);
    }
    chatModel.value = config.current || (available[0] ? available[0].key : "");
    setText("chat-model-current", config.current || "chưa chọn");

    chatTemp.value = String(config.gen ? config.gen.temperature : 0.7);
    chatTokens.value = String(config.gen ? config.gen.max_tokens : 1200);

    var presets = config.presets && typeof config.presets === "object" ? config.presets : {};
    chatProviderType.innerHTML = "";
    Object.keys(presets).forEach(function (key) {
      var option = document.createElement("option");
      option.value = key;
      option.textContent = presets[key].label || key;
      chatProviderType.appendChild(option);
    });
    if (!presets.custom) {
      var custom = document.createElement("option");
      custom.value = "custom";
      custom.textContent = "Tự nhập địa chỉ";
      chatProviderType.appendChild(custom);
    }

    chatChain = cloneList(Array.isArray(config.chain) ? config.chain : []);
    chatChainBaseline = cloneList(chatChain);
    chatProviders = cloneList(Array.isArray(config.providers) ? config.providers : []);
    chatProvidersBaseline = cloneList(chatProviders);
    chatProviderModels = {};
    chatPromptBaseline = typeof config.prompt === "string" ? config.prompt : "";
    chatPrompt.value = chatPromptBaseline;
    chatPromptCount.textContent = String(chatPromptBaseline.length);

    chatChainHint.textContent =
      "Tối đa " + chainMax() + " bước. Hết bước trước mới thử bước sau.";

    renderChatChain();
    renderChatProviders();
    resetProviderForm();
    syncChatButtons();
  }

  function loadChatConfig() {
    chatStateEl.textContent = "Đang đọc…";
    return chatRequest("/api/admin/chat/config")
      .then(function (result) {
        if (!result.ok || result.data.ok !== true || !result.data.config) {
          chatCfgReadable = false;
          chatCard.classList.add("is-degraded");
          chatStateEl.textContent = "Không đọc được";
          var reason = chatErrorText(result.data && result.data.error);
          chatModelNote.textContent = "Không đọc được cấu hình chat: " + reason + ".";
          chatChainNote.textContent = "Chưa đọc được thứ tự dự phòng.";
          chatPromptNote.textContent = "Chưa đọc được câu lệnh hệ thống.";
          chatProviderNote.textContent = "Chưa đọc được danh sách nhà cung cấp.";
          syncChatButtons();
          return;
        }
        renderChatConfig(result.data.config);
        chatModelNote.textContent = "Cấu hình đọc từ chat-proxy. Đổi xong chờ khoảng 60 giây.";
        chatChainNote.textContent = "Dùng mũi tên để đổi thứ tự, ✕ để bỏ bước. Thử từng bước trước khi lưu.";
        chatPromptNote.textContent = "Câu lệnh áp dụng cho mọi câu trả lời của trợ lý.";
        chatProviderNote.textContent = "Thêm hoặc sửa rồi bấm lưu. Key đã lưu chỉ hiện dạng che.";
      })
      .catch(function (err) {
        chatCfgReadable = false;
        chatCard.classList.add("is-degraded");
        chatStateEl.textContent = "Không kết nối được";
        chatModelNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        chatChainNote.textContent = "Chưa đọc được thứ tự dự phòng.";
        chatPromptNote.textContent = "Chưa đọc được câu lệnh hệ thống.";
        chatProviderNote.textContent = "Chưa đọc được danh sách nhà cung cấp.";
        syncChatButtons();
      });
  }

  [chatModel, chatTemp, chatTokens].forEach(function (el) {
    el.addEventListener("input", syncChatButtons);
    el.addEventListener("change", syncChatButtons);
  });

  chatTestModel.addEventListener("click", function () {
    if (!chatModel.value) return;
    chatTestResult.hidden = false;
    chatTestResult.className = "chat-test";
    chatTestResult.textContent = "Đang thử " + chatModel.value + "…";
    testModel("cf", chatModel.value, null);
  });
  chatModelSave.addEventListener("click", saveModel);

  chatChainAdd.addEventListener("click", addChain);
  chatChainSave.addEventListener("click", saveChain);

  chatPrompt.addEventListener("input", function () {
    chatPromptCount.textContent = String(chatPrompt.value.length);
    syncChatButtons();
  });
  chatPromptSave.addEventListener("click", savePrompt);

  chatProviderType.addEventListener("change", function () {
    var preset = chatCfg && chatCfg.presets ? chatCfg.presets[chatProviderType.value] : null;
    if (preset && preset.baseUrl) chatProviderUrl.value = preset.baseUrl;
    syncChatButtons();
  });
  chatProviderKey.addEventListener("input", function () {
    if (chatProviderEditId && chatProviderKey.value.trim().indexOf("***") === 0) {
      chatProviderKeyHint.textContent = "Đang giữ key đã lưu. Xóa ô rồi dán key mới nếu muốn đổi.";
    } else if (chatProviderEditId) {
      chatProviderKeyHint.textContent = "Key mới sẽ thay key cũ khi bấm cập nhật.";
    } else {
      chatProviderKeyHint.textContent = "Key chỉ gửi lên máy chủ, không lưu trong trình duyệt.";
    }
    syncChatButtons();
  });
  [chatProviderId, chatProviderLabel, chatProviderUrl].forEach(function (el) {
    el.addEventListener("input", syncChatButtons);
  });
  chatProviderCheck.addEventListener("click", checkProviderKey);
  chatProviderReset.addEventListener("click", resetProviderForm);
  chatProviderApply.addEventListener("click", applyProvider);
  chatProviderSave.addEventListener("click", saveProviders);

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
  syncChatButtons();
  loadChatConfig();
  runCheck();
  setupAutoRefresh();
})();
