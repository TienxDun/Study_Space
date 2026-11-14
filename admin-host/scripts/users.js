(function () {
  "use strict";

  // P2f: tab Người dùng. Danh tính từ Firebase qua data-api,
  // số liệu D1 ghép phía worker. Mọi giá trị gán bằng textContent.
  // Danh sách và chi tiết là hai màn hình tách nhau trong cùng tab.

  var API = "/api/admin/users";
  var PAGE_SIZE = 25;
  var state = {
    users: [],
    nextPageToken: "",
    loading: false,
    searching: false,
    detailUid: "",
    listScroll: 0,
  };

  var STATUS_BADGE = { ok: "badge-ok", wait: "badge-wait", bad: "badge-bad" };
  var REPORT_STATUS = { open: "Chờ xử lý", resolved: "Đã xử lý", dismissed: "Đã bỏ qua" };
  var REPORT_ROLE = { reporter: "Người báo cáo", target: "Bị báo cáo" };
  var REPORT_SOURCE = { ai: "Trợ lý AI", room: "Phòng học" };

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = String(value);
  }

  function showNote(el, message, isError) {
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.toggle("is-error", !!isError);
    el.classList.toggle("is-ok", !!message && !isError);
  }

  function formatTime(ms) {
    var n = Number(ms);
    if (!n) return "—";
    var d = new Date(n);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Dùng dấu phẩy thập phân theo vi-VN: "2,00 MB" thay vì "2.00 MB".
  function fixedLocale(value, digits) {
    return Number(value).toLocaleString("vi-VN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatBytes(bytes) {
    var n = Number(bytes);
    if (!n || n < 0) return "—";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return fixedLocale(n / 1024, 1) + " KB";
    return fixedLocale(n / (1024 * 1024), 2) + " MB";
  }

  function shortUid(uid) {
    var s = String(uid || "");
    if (!s) return "—";
    return s.length > 14 ? s.slice(0, 6) + "…" + s.slice(-4) : s;
  }

  function apiFetch(url, options) {
    var init = {
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      method: (options && options.method) || "GET",
    };
    if (options && options.body) init.body = JSON.stringify(options.body);
    return fetch(url, init).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (res.status === 401 || res.status === 403) {
            var err = new Error("auth");
            err.auth = true;
            throw err;
          }
          if (!res.ok || data.ok === false) {
            var e = new Error(data.error || "HTTP " + res.status);
            e.code = data.error;
            throw e;
          }
          return data;
        });
    });
  }

  function errorText(err) {
    if (err && err.auth) return "Chưa đăng nhập Cloudflare Access hoặc hết phiên.";
    var code = String((err && err.code) || "");
    if (code === "data_api_unreachable") return "Không gọi được dịch vụ tài khoản (data-api).";
    if (code === "data_api_401" || code === "data_api_403") {
      return "data-api từ chối ADMIN_TOKEN. Kiểm tra secret trên Worker.";
    }
    if (code.indexOf("data_api_") === 0) return "Dịch vụ tài khoản trả lỗi (" + code + ").";
    if (code === "d1_unavailable") return "Worker admin chưa nối D1.";
    if (code === "rate_limited") return "Bạn thao tác quá nhanh, chờ một phút rồi thử lại.";
    if (code === "audit_failed") return "Không ghi được nhật ký nên chưa lưu.";
    return "Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.";
  }

  function setState(text, isError) {
    var el = $("users-state");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "var(--rose-400)" : "";
  }

  function statusOf(user) {
    if (user.disabled) return { label: "Tài khoản tắt", badge: STATUS_BADGE.bad };
    if (user.aiDisabled && user.roomsDisabled) {
      return { label: "Khóa AI + phòng", badge: STATUS_BADGE.wait };
    }
    if (user.aiDisabled) return { label: "Khóa AI", badge: STATUS_BADGE.wait };
    if (user.roomsDisabled) return { label: "Khóa phòng", badge: STATUS_BADGE.wait };
    return { label: "Bình thường", badge: STATUS_BADGE.ok };
  }

  function findUser(uid) {
    for (var i = 0; i < state.users.length; i += 1) {
      if (state.users[i].uid === uid) return state.users[i];
    }
    return null;
  }

  function setStatusBadge(el, status) {
    if (!el) return;
    if (!status) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.className = "users-detail-status " + status.badge;
    el.textContent = status.label;
  }

  function showDetailView(show) {
    var list = $("users-list-view");
    var detail = $("users-detail");
    if (list) list.hidden = show;
    if (detail) detail.hidden = !show;
    if (typeof window.scrollTo !== "function") return;
    var top = state.listScroll;
    if (show) {
      var panel = $("users-panel");
      var offset = window.pageYOffset || document.documentElement.scrollTop || 0;
      top = panel ? Math.max(0, panel.getBoundingClientRect().top + offset - 12) : 0;
    }
    window.scrollTo({ top: top, behavior: show ? "smooth" : "auto" });
  }

  function appendCell(row, value, className) {
    var td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = String(value == null ? "" : value);
    row.appendChild(td);
    return td;
  }

  function renderRows() {
    var tbody = $("users-rows");
    if (!tbody) return;
    tbody.textContent = "";

    if (!state.users.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 7;
      emptyCell.textContent = "Không có người dùng nào trong trang này.";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      state.users.forEach(function (user) {
        var tr = document.createElement("tr");
        appendCell(tr, user.email || "(không có email)", "users-email");
        appendCell(tr, user.displayName || "—", "users-name");
        appendCell(tr, formatTime(user.lastSignInAt), "users-time");
        appendCell(tr, formatTime(user.lastSyncAt), "users-time");
        appendCell(tr, Number(user.chatToday) || 0, "users-count");

        var status = statusOf(user);
        var statusTd = document.createElement("td");
        var badge = document.createElement("span");
        badge.className = status.badge;
        badge.textContent = status.label;
        statusTd.appendChild(badge);
        tr.appendChild(statusTd);

        var actionTd = document.createElement("td");
        actionTd.className = "text-right";
        var button = document.createElement("button");
        button.type = "button";
        button.className = "btn-ghost";
        button.textContent = "Xem";
        button.addEventListener("click", function () {
          openDetail(user.uid);
        });
        actionTd.appendChild(button);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
      });
    }

    var more = $("users-more");
    if (more) more.hidden = !state.nextPageToken;
  }

  function metaRow(label, value, title, key) {
    var row = document.createElement("div");
    row.className = "reports-meta-row";
    if (key) row.setAttribute("data-meta-key", key);
    var l = document.createElement("span");
    l.textContent = label;
    var v = document.createElement("strong");
    v.textContent = value == null || value === "" ? "—" : String(value);
    if (title) v.title = String(title);
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function setMetaValue(key, value) {
    var el = document.querySelector(
      '#users-detail-meta [data-meta-key="' + key + '"] strong',
    );
    if (el) el.textContent = value == null || value === "" ? "—" : String(value);
  }

  function setMetaNote(note) {
    var meta = $("users-detail-meta");
    if (!meta) return;
    var row = meta.querySelector('[data-meta-key="note"]');
    if (!note) {
      if (row) row.remove();
      return;
    }
    if (row) {
      row.querySelector("strong").textContent = note;
      return;
    }
    meta.appendChild(metaRow("Ghi chú hạn chế", note, "", "note"));
  }

  function renderIdentity(user, uid) {
    setText("users-detail-title", (user && user.email) || uid || "Chi tiết người dùng");
    setText(
      "users-detail-sub",
      user ? (user.displayName || "Chưa có tên") + " · " + shortUid(user.uid) : shortUid(uid),
    );
    setStatusBadge($("users-detail-status"), user ? statusOf(user) : null);
  }

  function renderDetailLoading(user, uid) {
    renderIdentity(user, uid);
    $("users-detail-meta").textContent = "";
    var chatList = $("users-chat-days");
    chatList.textContent = "";
    chatList.appendChild(emptyLine("Đang đọc…"));
    var reports = $("users-reports");
    reports.textContent = "";
    reports.appendChild(emptyLine("Đang đọc…"));
    $("users-restrict-ai").checked = false;
    $("users-restrict-rooms").checked = false;
    $("users-restrict-note").value = "";
    $("users-restrict-save").disabled = true;
    $("users-chat-reset").disabled = true;
    setText("users-quota-count", "…");
    showNote($("users-restrict-state"), "");
    showNote($("users-chat-reset-state"), "");
    showNote($("users-detail-note"), "Đang đọc chi tiết…");
  }

  function renderChatDays(days) {
    var chatList = $("users-chat-days");
    chatList.textContent = "";
    if (!days.length) {
      chatList.appendChild(emptyLine("Chưa có dữ liệu chat."));
      return;
    }
    days.forEach(function (row) {
      var item = document.createElement("div");
      item.className = "users-chat-row";
      var day = document.createElement("span");
      day.textContent = String(row.day || "");
      var count = document.createElement("strong");
      count.textContent = (Number(row.count) || 0) + " câu";
      item.appendChild(day);
      item.appendChild(count);
      chatList.appendChild(item);
    });
  }

  function renderReports(related) {
    var reports = $("users-reports");
    reports.textContent = "";
    if (!related.length) {
      reports.appendChild(emptyLine("Không có báo cáo liên quan."));
      return;
    }
    related.forEach(function (report) {
      var item = document.createElement("div");
      item.className = "users-report-row";
      var time = document.createElement("span");
      time.textContent = formatTime(report.created_at);
      var label = document.createElement("span");
      label.textContent =
        (REPORT_ROLE[report.role] || report.role || "") +
        " · " +
        (REPORT_SOURCE[report.source] || report.source || "") +
        " · " +
        (REPORT_STATUS[report.status] || report.status || "");
      var reason = document.createElement("strong");
      reason.textContent = String(report.reason || "");
      item.appendChild(time);
      item.appendChild(label);
      item.appendChild(reason);
      reports.appendChild(item);
    });
  }

  function renderDetail(data) {
    var user = data.user || {};
    renderIdentity(user, state.detailUid);
    var meta = $("users-detail-meta");
    meta.textContent = "";
    meta.appendChild(metaRow("Email", user.email, user.email, "email"));
    meta.appendChild(metaRow("Tên", user.displayName, "", "name"));
    meta.appendChild(metaRow("UID", shortUid(user.uid), user.uid, "uid"));
    meta.appendChild(metaRow("Tạo lúc", formatTime(user.createdAt), "", "createdAt"));
    meta.appendChild(
      metaRow("Đăng nhập cuối", formatTime(user.lastSignInAt), "", "lastSignInAt"),
    );
    meta.appendChild(metaRow("Đồng bộ lúc", formatTime(user.lastSyncAt), "", "lastSyncAt"));
    meta.appendChild(
      metaRow("Dung lượng bản lưu", formatBytes(user.syncBytes), "", "syncBytes"),
    );
    meta.appendChild(metaRow("Chat hôm nay", Number(user.chatToday) || 0, "", "chatToday"));
    meta.appendChild(metaRow("Hạn chế", statusOf(user).label, "", "restrictions"));
    if (user.restrictionNote) {
      meta.appendChild(metaRow("Ghi chú hạn chế", user.restrictionNote, "", "note"));
    }

    renderChatDays(data.chatDays || []);
    renderReports(data.reports || []);

    $("users-restrict-ai").checked = !!user.aiDisabled;
    $("users-restrict-rooms").checked = !!user.roomsDisabled;
    $("users-restrict-note").value = user.restrictionNote || "";
    $("users-restrict-save").disabled = false;
    $("users-chat-reset").disabled = false;
    setText("users-quota-count", Number(user.chatToday) || 0);
    showNote($("users-restrict-state"), "");
    showNote($("users-chat-reset-state"), "");
    showNote($("users-detail-note"), "");
  }

  function emptyLine(text) {
    var p = document.createElement("p");
    p.className = "users-empty";
    p.textContent = text;
    return p;
  }

  function openDetail(uid) {
    if (!uid) return;
    state.detailUid = uid;
    state.listScroll = window.pageYOffset || document.documentElement.scrollTop || 0;
    renderDetailLoading(findUser(uid), uid);
    showDetailView(true);
    apiFetch(API + "/" + encodeURIComponent(uid))
      .then(function (data) {
        if (state.detailUid !== uid) return;
        renderDetail(data);
      })
      .catch(function (err) {
        if (state.detailUid !== uid) return;
        showNote($("users-detail-note"), errorText(err), true);
      });
  }

  function closeDetail() {
    state.detailUid = "";
    showNote($("users-detail-note"), "");
    showDetailView(false);
  }

  function mergeUsers(current, incoming) {
    var seen = Object.create(null);
    current.forEach(function (user) {
      seen[user.uid] = true;
    });
    var merged = current.slice();
    incoming.forEach(function (user) {
      if (seen[user.uid]) return;
      seen[user.uid] = true;
      merged.push(user);
    });
    return merged;
  }

  function loadList(reset) {
    if (state.loading || state.searching) return;
    if (!reset && !state.nextPageToken) return;
    state.loading = true;
    setState("Đang đọc…", false);
    showNote($("users-note"), "");
    var params = new URLSearchParams({ size: String(PAGE_SIZE) });
    if (!reset && state.nextPageToken) params.set("pageToken", state.nextPageToken);

    apiFetch(API + "?" + params.toString())
      .then(function (data) {
        state.users = reset ? data.users || [] : mergeUsers(state.users, data.users || []);
        state.nextPageToken = String(data.nextPageToken || "");
        renderRows();
        var noEmail = state.users.filter(function (user) {
          return !user.email;
        }).length;
        setState(
          state.users.length + " người" + (noEmail ? " · " + noEmail + " thiếu email" : ""),
          false,
        );
      })
      .catch(function (err) {
        state.users = [];
        state.nextPageToken = "";
        renderRows();
        setState("Lỗi đọc người dùng", true);
        showNote($("users-note"), errorText(err), true);
      })
      .then(function () {
        state.loading = false;
      });
  }

  function search() {
    var input = $("users-search-input");
    var email = String((input && input.value) || "").trim();
    if (!email) {
      showNote($("users-note"), "Nhập email đầy đủ để tìm.", true);
      return;
    }
    if (state.searching || state.loading) return;
    state.searching = true;
    setState("Đang tìm…", false);
    showNote($("users-note"), "");

    apiFetch(API + "/lookup?email=" + encodeURIComponent(email))
      .then(function (data) {
        if (!data.user) {
          showNote($("users-note"), "Không tìm thấy tài khoản với email này.", true);
          setState("Không tìm thấy", true);
          return;
        }
        state.users = [data.user];
        state.nextPageToken = "";
        renderRows();
        var user = data.user;
        showNote($("users-note"), "Kết quả cho " + (user.email || email) + ".");
        setState("1 kết quả", false);
      })
      .catch(function (err) {
        setState("Lỗi tìm kiếm", true);
        showNote($("users-note"), errorText(err), true);
      })
      .then(function () {
        state.searching = false;
      });
  }

  function updateLocalUser(uid, patch) {
    state.users.forEach(function (user) {
      if (user.uid === uid) {
        Object.keys(patch).forEach(function (key) {
          user[key] = patch[key];
        });
      }
    });
  }

  function saveRestrictions() {
    var uid = state.detailUid;
    if (!uid) return;
    var button = $("users-restrict-save");
    var body = {
      aiDisabled: $("users-restrict-ai").checked,
      roomsDisabled: $("users-restrict-rooms").checked,
      note: $("users-restrict-note").value || "",
    };
    button.disabled = true;
    showNote($("users-restrict-state"), "Đang lưu…");
    apiFetch(API + "/" + encodeURIComponent(uid) + "/restrictions", {
      method: "POST",
      body: body,
    })
      .then(function () {
        updateLocalUser(uid, body);
        renderRows();
        var user = findUser(uid);
        var status = user ? statusOf(user) : null;
        setStatusBadge($("users-detail-status"), status);
        setMetaValue("restrictions", status ? status.label : "—");
        setMetaNote(body.note);
        showNote($("users-restrict-state"), "Đã lưu hạn chế.");
      })
      .catch(function (err) {
        showNote($("users-restrict-state"), errorText(err), true);
      })
      .then(function () {
        button.disabled = false;
      });
  }

  function resetQuota() {
    var uid = state.detailUid;
    if (!uid) return;
    var button = $("users-chat-reset");
    button.disabled = true;
    showNote($("users-chat-reset-state"), "Đang đặt lại…");
    apiFetch(API + "/" + encodeURIComponent(uid) + "/chat-reset", { method: "POST" })
      .then(function () {
        updateLocalUser(uid, { chatToday: 0 });
        setText("users-quota-count", 0);
        setMetaValue("chatToday", 0);
        renderRows();
        showNote($("users-chat-reset-state"), "Đã đặt lại hạn mức hôm nay.");
      })
      .catch(function (err) {
        showNote($("users-chat-reset-state"), errorText(err), true);
      })
      .then(function () {
        button.disabled = false;
      });
  }

  function wire() {
    $("users-refresh").addEventListener("click", function () {
      $("users-search-input").value = "";
      state.nextPageToken = "";
      loadList(true);
    });
    $("users-more").addEventListener("click", function () {
      loadList(false);
    });
    $("users-search-btn").addEventListener("click", search);
    $("users-search-input").addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        search();
      }
    });
    $("users-detail-close").addEventListener("click", closeDetail);
    $("users-restrict-save").addEventListener("click", saveRestrictions);
    $("users-chat-reset").addEventListener("click", resetQuota);
  }

  wire();
  loadList(true);
})();
