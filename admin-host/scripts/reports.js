(function () {
  "use strict";

  // P2e: hộp thư báo cáo AI/phòng học + hạn chế tài khoản.
  // Mọi nội dung do người dùng gửi chỉ được gán bằng textContent, không innerHTML.

  var API = "/api/admin/reports";
  var state = {
    status: "open",
    source: "all",
    reports: [],
    counts: { open: 0, resolved: 0, dismissed: 0, total: 0 },
    nextBefore: null,
    selected: null,
    loading: false,
    resolving: false,
    deleting: false,
    purging: false,
    restrictUid: "",
  };

  var SOURCE_LABEL = { ai: "Trợ lý AI", room: "Phòng học" };
  var STATUS_LABEL = { open: "Chờ xử lý", resolved: "Đã xử lý", dismissed: "Đã bỏ qua" };
  var STATUS_CLASS = { open: "badge-bad", resolved: "badge-ok", dismissed: "badge-wait" };
  var REASON_LABEL = {
    ai: {
      inaccurate: "Thông tin sai/lạc hậu",
      inappropriate: "Nội dung không phù hợp",
      dangerous: "Nội dung nguy hiểm",
      harassment: "Quấy rối/thù địch",
      other: "Khác",
    },
    room: {
      harassment: "Quấy rối",
      inappropriate: "Nội dung không phù hợp",
      recording: "Ghi âm/ghi hình trái phép",
      spam: "Spam/mạo danh",
      other: "Khác",
    },
  };

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

  function shortUid(uid) {
    var s = String(uid || "");
    if (!s) return "—";
    return s.length > 14 ? s.slice(0, 6) + "…" + s.slice(-4) : s;
  }

  function reasonLabel(report) {
    var map = REASON_LABEL[report.source] || {};
    return map[report.reason] || report.reason || "—";
  }

  function apiFetch(url, options) {
    return fetch(url, {
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      method: (options && options.method) || "GET",
      body: options && options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (res) {
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
    if (err && err.code === "rate_limited") return "Bạn thao tác quá nhanh, chờ một phút rồi thử lại.";
    if (err && err.code === "audit_failed") return "Không ghi được nhật ký nên chưa lưu.";
    if (err && err.code === "missing_binding") return "Worker chưa nối D1.";
    return "Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại.";
  }

  function setState(text, isError) {
    var el = $("reports-state");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "var(--rose-400)" : "";
  }

  // Tên hiển thị lưu lúc gửi báo cáo; dòng cũ chưa có tên thì lùi về UID rút gọn.
  function personLabel(name, uid) {
    if (name) return String(name);
    return uid ? shortUid(uid) : "";
  }

  function appendCell(row, value, className) {
    var td = document.createElement("td");
    if (className) td.className = className;
    td.textContent = String(value == null ? "" : value);
    row.appendChild(td);
    return td;
  }

  function closedCount() {
    return (state.counts.resolved || 0) + (state.counts.dismissed || 0);
  }

  function syncPurgeButton() {
    var btn = $("reports-purge");
    if (btn) btn.disabled = state.loading || state.purging || closedCount() === 0;
  }

  function renderCounts() {
    setText("reports-count-open", state.counts.open);
    setText("reports-count-resolved", state.counts.resolved);
    setText("reports-count-dismissed", state.counts.dismissed);
    syncPurgeButton();
  }

  function renderRows() {
    var tbody = $("reports-rows");
    if (!tbody) return;
    tbody.textContent = "";

    if (!state.reports.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 6;
      emptyCell.textContent = "Không có báo cáo nào ở bộ lọc này.";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      state.reports.forEach(function (report) {
        var tr = document.createElement("tr");
        appendCell(tr, formatTime(report.createdAt), "reports-time");
        appendCell(tr, SOURCE_LABEL[report.source] || report.source);
        var targetLabel =
          report.targetUid || report.targetName
            ? personLabel(report.targetName, report.targetUid)
            : "—";
        var personCell = appendCell(
          tr,
          personLabel(report.reporterName, report.reporterUid) + " → " + targetLabel,
          "reports-uid-cell",
        );
        personCell.title = [report.reporterUid, report.targetUid].filter(Boolean).join(" → ");
        appendCell(tr, reasonLabel(report));

        var statusTd = document.createElement("td");
        var badge = document.createElement("span");
        badge.className = STATUS_CLASS[report.status] || "badge-wait";
        badge.textContent = STATUS_LABEL[report.status] || report.status;
        statusTd.appendChild(badge);
        tr.appendChild(statusTd);

        var actionTd = document.createElement("td");
        actionTd.className = "text-right reports-actions";
        var button = document.createElement("button");
        button.type = "button";
        button.className = "btn-ghost";
        button.textContent = "Xem";
        button.addEventListener("click", function () {
          openDetail(report.id);
        });
        actionTd.appendChild(button);

        // P3.17: xoá thủ công, không có cơ chế tự dọn nào.
        var deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn-ghost is-danger";
        deleteButton.textContent = "Xóa";
        deleteButton.addEventListener("click", function () {
          deleteReportItem(report);
        });
        actionTd.appendChild(deleteButton);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
      });
    }

    var more = $("reports-more");
    if (more) more.hidden = !state.nextBefore;
  }

  function metaRow(label, value, title) {
    var row = document.createElement("div");
    row.className = "reports-meta-row";
    var l = document.createElement("span");
    l.textContent = label;
    var v = document.createElement("strong");
    v.textContent = value == null || value === "" ? "—" : String(value);
    if (title) v.title = String(title);
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function renderDetail(report) {
    state.selected = report;
    setText("reports-detail-title", "Chi tiết báo cáo");
    var meta = $("reports-detail-meta");
    meta.textContent = "";
    meta.appendChild(metaRow("Nguồn", SOURCE_LABEL[report.source] || report.source));
    meta.appendChild(metaRow("Trạng thái", STATUS_LABEL[report.status] || report.status));
    meta.appendChild(metaRow("Người báo cáo", personLabel(report.reporterName, report.reporterUid), report.reporterUid));
    if (report.targetUid || report.targetName) {
      meta.appendChild(
        metaRow("Người bị báo cáo", personLabel(report.targetName, report.targetUid), report.targetUid),
      );
    }
    if (report.room) meta.appendChild(metaRow("Phòng", report.room));
    if (report.sessionId) meta.appendChild(metaRow("Phiên chat", report.sessionId));
    if (report.messageId) meta.appendChild(metaRow("Tin nhắn", report.messageId));
    meta.appendChild(metaRow("Lý do", reasonLabel(report)));
    if (report.detail) {
      meta.appendChild(metaRow("Ghi chú của người báo cáo", report.detail));
    }
    meta.appendChild(metaRow("Thời gian", formatTime(report.createdAt)));
    if (report.resolvedAt) {
      meta.appendChild(metaRow("Xử lý lúc", formatTime(report.resolvedAt)));
      meta.appendChild(metaRow("Người xử lý", report.resolvedBy));
      meta.appendChild(metaRow("Ghi chú xử lý", report.resolutionNote));
    }

    var questionWrap = $("reports-question-wrap");
    var questionText = report.question || "";
    $("reports-detail-question").textContent = questionText;
    questionWrap.hidden = !questionText;

    var content = $("reports-detail-content");
    content.textContent = report.content || report.contentPreview || "(không có nội dung)";
    $("reports-resolve-note").value = report.resolutionNote || "";
    showNote($("reports-detail-note"), "");

    var detail = $("reports-detail");
    detail.hidden = false;
    if (typeof detail.scrollIntoView === "function") {
      detail.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    var restrictBlock = $("reports-restrict-block");
    if (report.targetUid) {
      restrictBlock.hidden = false;
      loadRestrictions(report.targetUid);
    } else {
      restrictBlock.hidden = true;
      state.restrictUid = "";
    }
  }

  function openDetail(id) {
    showNote($("reports-note"), "");
    apiFetch(API + "/" + encodeURIComponent(id))
      .then(function (data) {
        renderDetail(data.report);
      })
      .catch(function (err) {
        showNote($("reports-note"), errorText(err), true);
      });
  }

  // Nối trang sau, bỏ qua báo cáo đã có (cùng mốc thời gian có thể lặp ở ranh giới trang).
  function mergeReports(current, incoming) {
    var seen = Object.create(null);
    current.forEach(function (report) {
      seen[report.id] = true;
    });
    var merged = current.slice();
    incoming.forEach(function (report) {
      if (seen[report.id]) return;
      seen[report.id] = true;
      merged.push(report);
    });
    return merged;
  }

  function loadList(reset) {
    if (state.loading) return;
    // Hết trang thì không tải lại trang đầu rồi nối vào danh sách cũ (gây trùng).
    if (!reset && !state.nextBefore) return;
    state.loading = true;
    setState("Đang đọc…", false);
    syncPurgeButton();
    showNote($("reports-note"), "");
    var params = new URLSearchParams({
      status: state.status,
      source: state.source,
      limit: "50",
    });
    if (!reset && state.nextBefore) params.set("before", String(state.nextBefore));

    apiFetch(API + "?" + params.toString())
      .then(function (data) {
        state.reports = reset
          ? data.reports || []
          : mergeReports(state.reports, data.reports || []);
        state.counts = data.counts || state.counts;
        state.nextBefore = data.nextBefore || null;
        renderCounts();
        renderRows();
        setState(
          (state.counts.open || 0) + " chờ xử lý · " + (state.counts.total || 0) + " tổng",
          false,
        );
      })
      .catch(function (err) {
        setState("Lỗi đọc báo cáo", true);
        showNote($("reports-note"), errorText(err), true);
      })
      .then(function () {
        state.loading = false;
        syncPurgeButton();
      });
  }

  function resolveSelected(status) {
    if (!state.selected || state.resolving) return;
    state.resolving = true;
    var note = $("reports-resolve-note").value || "";
    showNote($("reports-detail-note"), "Đang lưu…");
    apiFetch(API + "/" + encodeURIComponent(state.selected.id) + "/resolve", {
      method: "POST",
      body: { status: status, note: note },
    })
      .then(function () {
        state.selected.status = status;
        state.selected.resolutionNote = note;
        state.selected.resolvedAt = Date.now();
        showNote($("reports-detail-note"), status === "resolved" ? "Đã đánh dấu xử lý." : "Đã bỏ qua báo cáo.");
        loadList(true);
      })
      .catch(function (err) {
        showNote($("reports-detail-note"), errorText(err), true);
      })
      .then(function () {
        state.resolving = false;
      });
  }

  function deleteReportItem(report) {
    if (state.deleting || state.purging) return;
    var label = (SOURCE_LABEL[report.source] || report.source) + " · " + formatTime(report.createdAt);
    AdminDialog.confirm({
      title: "Xóa báo cáo?",
      description:
        "Báo cáo (" + label + ") sẽ bị xóa vĩnh viễn. Không khôi phục được.",
      detail: report.id,
      confirmLabel: "Xóa vĩnh viễn",
      tone: "danger",
    }).then(function (ok) {
      if (!ok) return;
      state.deleting = true;
      syncPurgeButton();
      showNote($("reports-note"), "Đang xóa…");
      apiFetch(API + "/" + encodeURIComponent(report.id), { method: "DELETE" })
        .then(function () {
          if (state.selected && state.selected.id === report.id) {
            $("reports-detail").hidden = true;
            state.selected = null;
          }
          // Gọi loadList trước rồi mới báo: loadList tự xoá ghi chú cũ khi bắt đầu.
          loadList(true);
          showNote($("reports-note"), "Đã xóa báo cáo.");
        })
        .catch(function (err) {
          showNote($("reports-note"), errorText(err), true);
        })
        .then(function () {
          state.deleting = false;
          syncPurgeButton();
        });
    });
  }

  function purgeClosed() {
    if (state.purging || state.deleting) return;
    var count = closedCount();
    if (!count) return;
    AdminDialog.confirm({
      title: "Xóa báo cáo đã xử lý?",
      description:
        "Xóa vĩnh viễn " +
        count +
        " báo cáo đã xử lý hoặc đã bỏ qua. Báo cáo đang chờ xử lý không bị ảnh hưởng.",
      detail: "resolved + dismissed",
      confirmLabel: "Xóa " + count + " mục",
      tone: "danger",
    }).then(function (ok) {
      if (!ok) return;
      state.purging = true;
      syncPurgeButton();
      showNote($("reports-note"), "Đang xóa…");
      apiFetch(API + "/purge", { method: "POST" })
        .then(function (data) {
          $("reports-detail").hidden = true;
          state.selected = null;
          loadList(true);
          showNote($("reports-note"), "Đã xóa " + (Number(data.deleted) || count) + " báo cáo.");
        })
        .catch(function (err) {
          showNote($("reports-note"), errorText(err), true);
        })
        .then(function () {
          state.purging = false;
          syncPurgeButton();
        });
    });
  }

  function loadRestrictions(uid) {
    state.restrictUid = uid;
    setText("reports-restrict-uid", shortUid(uid));
    showNote($("reports-restrict-state"), "Đang đọc hạn chế…");
    apiFetch("/api/admin/users/" + encodeURIComponent(uid) + "/restrictions")
      .then(function (data) {
        var r = data.restrictions || {};
        $("reports-restrict-ai").checked = !!r.aiDisabled;
        $("reports-restrict-rooms").checked = !!r.roomsDisabled;
        $("reports-restrict-note").value = r.note || "";
        showNote($("reports-restrict-state"), "");
      })
      .catch(function (err) {
        showNote($("reports-restrict-state"), errorText(err), true);
      });
  }

  function saveRestrictions() {
    var uid = state.restrictUid;
    if (!uid) return;
    var button = $("reports-restrict-save");
    button.disabled = true;
    showNote($("reports-restrict-state"), "Đang lưu…");
    apiFetch("/api/admin/users/" + encodeURIComponent(uid) + "/restrictions", {
      method: "POST",
      body: {
        aiDisabled: $("reports-restrict-ai").checked,
        roomsDisabled: $("reports-restrict-rooms").checked,
        note: $("reports-restrict-note").value || "",
      },
    })
      .then(function () {
        showNote($("reports-restrict-state"), "Đã lưu hạn chế.");
      })
      .catch(function (err) {
        showNote($("reports-restrict-state"), errorText(err), true);
      })
      .then(function () {
        button.disabled = false;
      });
  }

  function wire() {
    $("reports-status").addEventListener("change", function (event) {
      state.status = event.target.value;
      state.nextBefore = null;
      $("reports-detail").hidden = true;
      loadList(true);
    });
    $("reports-source").addEventListener("change", function (event) {
      state.source = event.target.value;
      state.nextBefore = null;
      $("reports-detail").hidden = true;
      loadList(true);
    });
    $("reports-refresh").addEventListener("click", function () {
      loadList(true);
    });
    $("reports-purge").addEventListener("click", purgeClosed);
    $("reports-more").addEventListener("click", function () {
      loadList(false);
    });
    $("reports-detail-close").addEventListener("click", function () {
      $("reports-detail").hidden = true;
      state.selected = null;
    });
    $("reports-resolve").addEventListener("click", function () {
      resolveSelected("resolved");
    });
    $("reports-dismiss").addEventListener("click", function () {
      resolveSelected("dismissed");
    });
    $("reports-restrict-save").addEventListener("click", saveRestrictions);
  }

  wire();
  loadList(true);
})();
