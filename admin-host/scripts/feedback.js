(function () {
  "use strict";

  // P3.16: hàng chờ góp ý/báo lỗi chung từ app.
  // Mọi nội dung do người dùng gửi chỉ được gán bằng textContent, không innerHTML.

  var API = "/api/admin/feedback";
  var state = {
    status: "open",
    kind: "all",
    items: [],
    counts: { open: 0, resolved: 0, dismissed: 0, total: 0 },
    nextBefore: null,
    selected: null,
    loading: false,
    pendingReset: false,
    resolving: false,
    deleting: false,
    purging: false,
  };

  var KIND_LABEL = { bug: "Báo lỗi", idea: "Đề xuất cải thiện", other: "Khác" };
  var STATUS_LABEL = { open: "Chờ xử lý", resolved: "Đã xử lý", dismissed: "Đã bỏ qua" };
  var STATUS_CLASS = { open: "badge-bad", resolved: "badge-ok", dismissed: "badge-wait" };
  var PLATFORM_LABEL = { web: "Web", android: "Ứng dụng Android" };

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

  function kindLabel(item) {
    return KIND_LABEL[item.kind] || item.kind || "—";
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
    var el = $("feedback-state");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "var(--rose-400)" : "";
  }

  // Tên hiển thị lưu lúc gửi; dòng cũ chưa có tên thì lùi về UID rút gọn.
  function personLabel(name, uid) {
    if (name) return String(name);
    return uid ? shortUid(uid) : "—";
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
    var btn = $("feedback-purge");
    if (btn) btn.disabled = state.loading || state.purging || closedCount() === 0;
  }

  function renderCounts() {
    setText("feedback-count-open", state.counts.open);
    setText("feedback-count-resolved", state.counts.resolved);
    setText("feedback-count-dismissed", state.counts.dismissed);
    syncPurgeButton();
  }

  function renderRows() {
    var tbody = $("feedback-rows");
    if (!tbody) return;
    tbody.textContent = "";

    if (!state.items.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 6;
      emptyCell.textContent = "Không có góp ý nào ở bộ lọc này.";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      state.items.forEach(function (item) {
        var tr = document.createElement("tr");
        appendCell(tr, formatTime(item.createdAt), "feedback-time");
        var personCell = appendCell(
          tr,
          personLabel(item.name, item.uid),
          "feedback-person",
        );
        personCell.title = item.uid || "";
        appendCell(tr, kindLabel(item));
        appendCell(tr, item.preview || item.message || "", "feedback-preview");

        var statusTd = document.createElement("td");
        var badge = document.createElement("span");
        badge.className = STATUS_CLASS[item.status] || "badge-wait";
        badge.textContent = STATUS_LABEL[item.status] || item.status;
        statusTd.appendChild(badge);
        tr.appendChild(statusTd);

        var actionTd = document.createElement("td");
        actionTd.className = "text-right feedback-actions";
        if (item.hasImage) {
          var tag = document.createElement("span");
          tag.className = "feedback-image-tag";
          tag.textContent = "Có ảnh";
          actionTd.appendChild(tag);
        }
        var button = document.createElement("button");
        button.type = "button";
        button.className = "btn-ghost";
        button.textContent = "Xem";
        button.addEventListener("click", function () {
          openDetail(item.id);
        });
        actionTd.appendChild(button);

        // P3.17: xoá thủ công, không có cơ chế tự dọn nào.
        var deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn-ghost is-danger";
        deleteButton.textContent = "Xóa";
        deleteButton.addEventListener("click", function () {
          deleteItem(item);
        });
        actionTd.appendChild(deleteButton);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
      });
    }

    var more = $("feedback-more");
    if (more) more.hidden = !state.nextBefore;
  }

  function metaRow(label, value, title) {
    var row = document.createElement("div");
    row.className = "feedback-meta-row";
    var l = document.createElement("span");
    l.textContent = label;
    var v = document.createElement("strong");
    v.textContent = value == null || value === "" ? "—" : String(value);
    if (title) v.title = String(title);
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function resetDetailImage() {
    var wrap = $("feedback-detail-image-wrap");
    var img = $("feedback-detail-image");
    var link = $("feedback-detail-image-link");
    if (img) img.removeAttribute("src");
    if (link) link.removeAttribute("href");
    if (wrap) wrap.hidden = true;
  }

  function renderDetail(item) {
    state.selected = item;
    var meta = $("feedback-detail-meta");
    meta.textContent = "";
    meta.appendChild(metaRow("Loại", kindLabel(item)));
    meta.appendChild(metaRow("Trạng thái", STATUS_LABEL[item.status] || item.status));
    meta.appendChild(metaRow("Người gửi", personLabel(item.name, item.uid), item.uid));
    if (item.contact) meta.appendChild(metaRow("Liên hệ", item.contact));
    if (item.appVersion) meta.appendChild(metaRow("Phiên bản", item.appVersion));
    if (item.platform) {
      meta.appendChild(metaRow("Nền tảng", PLATFORM_LABEL[item.platform] || item.platform));
    }
    if (item.viewport) meta.appendChild(metaRow("Khung hình", item.viewport));
    if (item.locale) meta.appendChild(metaRow("Ngôn ngữ", item.locale));
    meta.appendChild(metaRow("Gửi lúc", formatTime(item.createdAt)));
    if (item.resolvedAt) {
      meta.appendChild(metaRow("Xử lý lúc", formatTime(item.resolvedAt)));
      meta.appendChild(metaRow("Người xử lý", item.resolvedBy));
      meta.appendChild(metaRow("Ghi chú xử lý", item.resolutionNote));
    }

    $("feedback-detail-message").textContent = item.message || item.preview || "(không có nội dung)";

    // Ảnh tải qua endpoint admin (sau Cloudflare Access), không lộ key R2.
    if (item.hasImage) {
      var imageUrl = API + "/" + encodeURIComponent(item.id) + "/image";
      $("feedback-detail-image").src = imageUrl;
      $("feedback-detail-image-link").href = imageUrl;
      $("feedback-detail-image-wrap").hidden = false;
    } else {
      resetDetailImage();
    }

    $("feedback-resolve-note").value = item.resolutionNote || "";
    showNote($("feedback-detail-note"), "");

    var detail = $("feedback-detail");
    detail.hidden = false;
    if (typeof detail.scrollIntoView === "function") {
      detail.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function openDetail(id) {
    showNote($("feedback-note"), "");
    apiFetch(API + "/" + encodeURIComponent(id))
      .then(function (data) {
        renderDetail(data.feedback);
      })
      .catch(function (err) {
        showNote($("feedback-note"), errorText(err), true);
      });
  }

  // Nối trang sau, bỏ qua mục đã có (cùng mốc thời gian có thể lặp ở ranh giới trang).
  function mergeItems(current, incoming) {
    var seen = Object.create(null);
    current.forEach(function (item) {
      seen[item.id] = true;
    });
    var merged = current.slice();
    incoming.forEach(function (item) {
      if (seen[item.id]) return;
      seen[item.id] = true;
      merged.push(item);
    });
    return merged;
  }

  function loadList(reset) {
    // Đổi bộ lọc khi lần tải trước chưa xong thì phải hẹn tải lại, nếu bỏ qua
    // request mới thì bảng hiển thị lệch với select đang chọn.
    if (state.loading) {
      if (reset) state.pendingReset = true;
      return;
    }
    // Hết trang thì không tải lại trang đầu rồi nối vào danh sách cũ (gây trùng).
    if (!reset && !state.nextBefore) return;
    state.loading = true;
    setState("Đang đọc…", false);
    syncPurgeButton();
    showNote($("feedback-note"), "");
    var params = new URLSearchParams({
      status: state.status,
      kind: state.kind,
      limit: "50",
    });
    if (!reset && state.nextBefore) params.set("before", String(state.nextBefore));

    apiFetch(API + "?" + params.toString())
      .then(function (data) {
        state.items = reset
          ? data.feedback || []
          : mergeItems(state.items, data.feedback || []);
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
        setState("Lỗi đọc góp ý", true);
        showNote($("feedback-note"), errorText(err), true);
      })
      .then(function () {
        state.loading = false;
        syncPurgeButton();
        if (state.pendingReset) {
          state.pendingReset = false;
          loadList(true);
        }
      });
  }

  function resolveSelected(status) {
    if (!state.selected || state.resolving) return;
    state.resolving = true;
    var note = $("feedback-resolve-note").value || "";
    showNote($("feedback-detail-note"), "Đang lưu…");
    apiFetch(API + "/" + encodeURIComponent(state.selected.id) + "/status", {
      method: "POST",
      body: { status: status, note: note },
    })
      .then(function () {
        state.selected.status = status;
        state.selected.resolutionNote = note;
        state.selected.resolvedAt = Date.now();
        showNote(
          $("feedback-detail-note"),
          status === "resolved" ? "Đã đánh dấu xử lý." : "Đã bỏ qua góp ý.",
        );
        loadList(true);
      })
      .catch(function (err) {
        showNote($("feedback-detail-note"), errorText(err), true);
      })
      .then(function () {
        state.resolving = false;
      });
  }

  function closeDetail() {
    var detail = $("feedback-detail");
    if (detail) detail.hidden = true;
    state.selected = null;
    resetDetailImage();
  }

  function deleteItem(item) {
    if (state.deleting || state.purging) return;
    var label = kindLabel(item) + " · " + formatTime(item.createdAt);
    AdminDialog.confirm({
      title: "Xóa góp ý?",
      description:
        "Góp ý (" + label + ") sẽ bị xóa vĩnh viễn, kèm ảnh đính kèm nếu có. Không khôi phục được.",
      detail: item.id,
      confirmLabel: "Xóa vĩnh viễn",
      tone: "danger",
    }).then(function (ok) {
      if (!ok) return;
      state.deleting = true;
      syncPurgeButton();
      showNote($("feedback-note"), "Đang xóa…");
      apiFetch(API + "/" + encodeURIComponent(item.id), { method: "DELETE" })
        .then(function () {
          if (state.selected && state.selected.id === item.id) closeDetail();
          // Gọi loadList trước rồi mới báo: loadList tự xoá ghi chú cũ khi bắt đầu.
          loadList(true);
          showNote($("feedback-note"), "Đã xóa góp ý.");
        })
        .catch(function (err) {
          showNote($("feedback-note"), errorText(err), true);
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
      title: "Xóa mục đã xử lý?",
      description:
        "Xóa vĩnh viễn " +
        count +
        " góp ý đã xử lý hoặc đã bỏ qua, kèm ảnh đính kèm. Góp ý đang chờ xử lý không bị ảnh hưởng.",
      detail: "resolved + dismissed",
      confirmLabel: "Xóa " + count + " mục",
      tone: "danger",
    }).then(function (ok) {
      if (!ok) return;
      state.purging = true;
      syncPurgeButton();
      showNote($("feedback-note"), "Đang xóa…");
      apiFetch(API + "/purge", { method: "POST" })
        .then(function (data) {
          closeDetail();
          loadList(true);
          showNote($("feedback-note"), "Đã xóa " + (Number(data.deleted) || count) + " góp ý.");
        })
        .catch(function (err) {
          showNote($("feedback-note"), errorText(err), true);
        })
        .then(function () {
          state.purging = false;
          syncPurgeButton();
        });
    });
  }

  function wire() {
    $("feedback-status").addEventListener("change", function (event) {
      state.status = event.target.value;
      state.nextBefore = null;
      closeDetail();
      loadList(true);
    });
    $("feedback-kind").addEventListener("change", function (event) {
      state.kind = event.target.value;
      state.nextBefore = null;
      closeDetail();
      loadList(true);
    });
    $("feedback-refresh").addEventListener("click", function () {
      loadList(true);
    });
    $("feedback-purge").addEventListener("click", purgeClosed);
    $("feedback-more").addEventListener("click", function () {
      loadList(false);
    });
    $("feedback-detail-close").addEventListener("click", function () {
      closeDetail();
    });
    $("feedback-resolve").addEventListener("click", function () {
      resolveSelected("resolved");
    });
    $("feedback-dismiss").addEventListener("click", function () {
      resolveSelected("dismissed");
    });
  }

  wire();
  loadList(true);
})();
