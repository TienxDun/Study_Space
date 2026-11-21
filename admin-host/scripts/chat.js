(function () {
  "use strict";

  // Bước 3: tab Trợ lý chat chỉ hiển thị metadata (danh mục model, số lượt, hạn mức).
  // Không đọc nội dung hội thoại — phiên chat chỉ nằm trên máy người học.

  var API = "/api/admin/chat";
  var numberFmt = new Intl.NumberFormat("vi-VN");
  var priceFmt = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

  var panel = document.getElementById("chat-panel");
  if (!panel) return;

  var stateEl = document.getElementById("chat-state");
  var catalogChip = document.getElementById("chat-catalog-chip");
  var catalogNote = document.getElementById("chat-catalog-note");
  var modelRows = document.getElementById("chat-model-rows");
  var modelCount = document.getElementById("chat-model-count");
  var searchInput = document.getElementById("chat-model-search");
  var filterSelect = document.getElementById("chat-model-filter");
  var refreshBtn = document.getElementById("chat-refresh");

  var usageChip = document.getElementById("chat-usage-chip");
  var usageNote = document.getElementById("chat-usage-note");
  var todayEl = document.getElementById("chat-usage-today");
  var usersEl = document.getElementById("chat-usage-users");
  var limitEl = document.getElementById("chat-usage-limit");
  var barsEl = document.getElementById("chat-usage-bars");
  var chartFrom = document.getElementById("chat-chart-from");
  var chartTo = document.getElementById("chat-chart-to");
  var topEl = document.getElementById("chat-top-users");

  var statIds = {
    total: "chat-stat-total",
    free: "chat-stat-free",
    unverified: "chat-stat-unverified",
    unavailable: "chat-stat-unavailable",
    generated: "chat-stat-generated",
  };

  var catalog = null;
  var usage = null;
  var loading = false;

  var ERROR_TEXT = {
    missing_chat_v2_url: "Worker admin chưa có biến CHAT_V2_URL, chưa đọc được danh mục.",
    chat_v2_unreachable: "Không kết nối được Worker chat-v2.",
    chat_v2_bad_payload: "Worker chat-v2 trả dữ liệu không đúng định dạng.",
    d1_unavailable: "Chưa gắn cơ sở dữ liệu D1 nên chưa đọc được số lượt.",
    d1_error: "Cơ sở dữ liệu trả lỗi, chưa đọc được số lượt.",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setText(target, value) {
    var el = typeof target === "string" ? $(target) : target;
    if (el) el.textContent = String(value);
  }

  function showNote(el, message, isError) {
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.toggle("is-error", !!isError);
    el.classList.toggle("is-ok", !!message && !isError);
  }

  function errorText(code) {
    var text = String(code || "");
    var httpCode = /^chat_v2_(\d{3})$/.exec(text);
    if (httpCode) return "Worker chat-v2 trả lỗi HTTP " + httpCode[1] + ".";
    return ERROR_TEXT[text] || "Không đọc được dữ liệu (" + (text || "unknown") + ").";
  }

  function call(path) {
    return fetch(API + path, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
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
          if (!res.ok || !data || data.ok !== true) {
            throw new Error((data && data.error) || "http_" + res.status);
          }
          return data;
        });
    });
  }

  function formatPrice(value) {
    return typeof value === "number" && Number.isFinite(value) ? "$" + priceFmt.format(value) : "—";
  }

  function formatTokens(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    if (value >= 1_000_000) return priceFmt.format(value / 1_000_000) + "M";
    if (value >= 1_000) return numberFmt.format(Math.round(value / 1_000)) + "K";
    return numberFmt.format(value);
  }

  function formatStamp(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDay(day) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
    if (!match) return String(day || "—");
    return match[3] + "/" + match[2];
  }

  function shortUid(uid) {
    var s = String(uid || "");
    if (s.length <= 14) return s;
    return s.slice(0, 6) + "…" + s.slice(-4);
  }

  function badge(text, kind, title) {
    var span = document.createElement("span");
    span.className = "chat-badge" + (kind ? " is-" + kind : "");
    span.textContent = text;
    if (title) span.title = title;
    return span;
  }

  function cell(value, className) {
    var td = document.createElement("td");
    if (className) td.className = className;
    if (value instanceof Node) td.appendChild(value);
    else td.textContent = value;
    return td;
  }

  function statusBadge(model) {
    if (model.available === false) {
      return badge("Tạm không khả dụng", "bad", model.checkedAt ? "Kiểm lúc " + formatStamp(model.checkedAt) : "");
    }
    if (model.available === true) {
      return badge("Khả dụng", "ok", model.checkedAt ? "Kiểm lúc " + formatStamp(model.checkedAt) : "");
    }
    return badge("Chưa xác minh", "wait", model.checkedAt ? "Kiểm lúc " + formatStamp(model.checkedAt) : "");
  }

  function currentFilter() {
    return {
      text: String(searchInput && searchInput.value ? searchInput.value : "")
        .trim()
        .toLowerCase(),
      kind: filterSelect ? filterSelect.value : "all",
    };
  }

  function matchesFilter(model, filter) {
    if (filter.kind === "free" && !model.free) return false;
    if (filter.kind === "paid" && model.free) return false;
    if (filter.kind === "unverified" && model.available !== null) return false;
    if (filter.kind === "unavailable" && model.available !== false) return false;
    if (!filter.text) return true;
    var haystack = (model.id + " " + model.displayName + " " + model.provider).toLowerCase();
    return haystack.indexOf(filter.text) >= 0;
  }

  function renderCatalog() {
    if (!catalog) return;
    var counts = catalog.counts || {};
    setText(statIds.total, numberFmt.format(counts.total || 0));
    setText(statIds.free, numberFmt.format(counts.free || 0));
    setText(statIds.unverified, numberFmt.format(counts.unverified || 0));
    setText(statIds.unavailable, numberFmt.format(counts.unavailable || 0));
    setText(statIds.generated, catalog.generatedAt ? formatStamp(catalog.generatedAt) : "—");

    var filter = currentFilter();
    var models = (catalog.models || []).filter(function (model) {
      return matchesFilter(model, filter);
    });

    modelRows.textContent = "";
    if (!models.length) {
      var empty = document.createElement("tr");
      var emptyCell = cell("Không có mô hình nào khớp bộ lọc.", "");
      emptyCell.colSpan = 6;
      empty.appendChild(emptyCell);
      modelRows.appendChild(empty);
    }

    models.forEach(function (model) {
      var tr = document.createElement("tr");

      var name = document.createElement("div");
      name.className = "chat-model-cell";
      var nameText = document.createElement("span");
      nameText.className = "chat-model-name";
      nameText.textContent = model.displayName || model.id;
      nameText.title = model.id;
      var idText = document.createElement("span");
      idText.className = "chat-model-id";
      idText.textContent = model.id;
      name.appendChild(nameText);
      name.appendChild(idText);
      tr.appendChild(cell(name));

      tr.appendChild(cell(model.provider || "—"));

      var priceTitle = model.priceSource ? "Nguồn giá: " + model.priceSource : "";
      var price = document.createElement("div");
      price.className = "chat-price";
      var priceIn = document.createElement("span");
      priceIn.textContent = "Vào " + formatPrice(model.priceIn);
      var priceOut = document.createElement("span");
      priceOut.textContent = "Ra " + formatPrice(model.priceOut);
      price.appendChild(priceIn);
      price.appendChild(priceOut);
      var priceCell = cell(price, "chat-price-cell");
      if (priceTitle) priceCell.title = priceTitle;
      tr.appendChild(priceCell);

      var contextCell = cell(formatTokens(model.contextTokens), "");
      if (model.specSource) contextCell.title = "Nguồn: " + model.specSource;
      tr.appendChild(contextCell);

      tr.appendChild(cell(badge(model.free ? "Miễn phí" : "Trả phí", model.free ? "ok" : "muted", "")));
      tr.appendChild(cell(statusBadge(model)));

      modelRows.appendChild(tr);
    });

    setText(
      modelCount,
      "Hiển thị " + numberFmt.format(models.length) + "/" + numberFmt.format((catalog.models || []).length) + " mô hình."
    );
    catalogChip.textContent = numberFmt.format((catalog.models || []).length) + " mô hình";
    catalogChip.classList.remove("is-dirty", "is-error");
  }

  function dayList(from, to) {
    var out = [];
    var cursor = new Date(String(from) + "T12:00:00Z");
    var last = new Date(String(to) + "T12:00:00Z");
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return out;
    while (cursor.getTime() <= last.getTime() && out.length < 120) {
      out.push(cursor.toISOString().slice(0, 10));
      cursor = new Date(cursor.getTime() + 86_400_000);
    }
    return out;
  }

  function renderUsage() {
    if (!usage) return;
    setText(todayEl, numberFmt.format(usage.today ? usage.today.total : 0));
    setText(usersEl, numberFmt.format(usage.today ? usage.today.users : 0));
    setText(limitEl, numberFmt.format(usage.limit || 0) + (usage.limitFromFlags ? "" : " (mặc định)"));

    var series = usage.series || [];
    var byDay = {};
    series.forEach(function (row) {
      byDay[row.day] = row;
    });
    var days = series.length && usage.day !== undefined ? dayList(series[0].day, usage.day) : [];
    var max = 1;
    days.forEach(function (day) {
      var row = byDay[day];
      if (row && row.total > max) max = row.total;
    });

    barsEl.textContent = "";
    if (!days.length) {
      var placeholder = document.createElement("p");
      placeholder.className = "chat-bars-empty";
      placeholder.textContent = "Chưa có lượt chat nào trong khoảng thời gian này.";
      barsEl.appendChild(placeholder);
      chartFrom.textContent = "—";
      chartTo.textContent = "—";
    } else {
      days.forEach(function (day) {
        var row = byDay[day] || { total: 0, users: 0 };
        var bar = document.createElement("span");
        bar.className = "chat-bar" + (row.total ? "" : " is-empty");
        var height = row.total ? Math.max(6, Math.round((row.total / max) * 100)) : 3;
        bar.style.height = height + "%";
        bar.title = formatDay(day) + ": " + numberFmt.format(row.total) + " câu · " + numberFmt.format(row.users) + " người";
        barsEl.appendChild(bar);
      });
      chartFrom.textContent = formatDay(days[0]);
      chartTo.textContent = formatDay(days[days.length - 1]);
    }

    topEl.textContent = "";
    var top = usage.top || [];
    if (!top.length) {
      var emptyItem = document.createElement("li");
      emptyItem.className = "chat-top-empty";
      emptyItem.textContent = "Chưa có ai chat hôm nay.";
      topEl.appendChild(emptyItem);
    }
    top.forEach(function (entry) {
      var li = document.createElement("li");
      li.className = "chat-top-item";

      var button = document.createElement("button");
      button.type = "button";
      button.className = "chat-top-name";
      button.textContent = entry.name || entry.email || shortUid(entry.uid);
      button.title = entry.uid;
      button.addEventListener("click", function () {
        window.location.hash = "users";
        document.dispatchEvent(new CustomEvent("admin:open-user", { detail: { uid: entry.uid } }));
      });
      li.appendChild(button);

      if (entry.name && entry.email) {
        var email = document.createElement("span");
        email.className = "chat-top-meta";
        email.textContent = entry.email;
        li.appendChild(email);
      }
      if (entry.aiDisabled) li.appendChild(badge("Đã chặn AI", "bad", ""));

      var count = document.createElement("span");
      count.className = "chat-top-count";
      count.textContent = numberFmt.format(entry.count) + " câu";
      li.appendChild(count);

      topEl.appendChild(li);
    });

    usageChip.textContent = "30 ngày";
    usageChip.classList.remove("is-dirty", "is-error");
  }

  function setPanelState(kind, text) {
    if (!stateEl) return;
    stateEl.textContent = text;
    stateEl.classList.toggle("is-error", kind === "error");
  }

  function loadCatalog() {
    catalogChip.textContent = "Đang đọc…";
    return call("/catalog")
      .then(function (data) {
        catalog = data;
        showNote(catalogNote, "", false);
        renderCatalog();
        return true;
      })
      .catch(function (err) {
        catalog = null;
        modelRows.textContent = "";
        var tr = document.createElement("tr");
        var td = document.createElement("td");
        td.colSpan = 7;
        td.textContent = "Chưa đọc được danh mục.";
        tr.appendChild(td);
        modelRows.appendChild(tr);
        setText(modelCount, "—");
        catalogChip.textContent = "Lỗi";
        catalogChip.classList.add("is-error");
        showNote(catalogNote, errorText(err.message), true);
        return false;
      });
  }

  function loadUsage() {
    usageChip.textContent = "Đang đọc…";
    return call("/usage?days=30")
      .then(function (data) {
        usage = data;
        showNote(usageNote, "", false);
        renderUsage();
        return true;
      })
      .catch(function (err) {
        usage = null;
        usageChip.textContent = "Lỗi";
        usageChip.classList.add("is-error");
        showNote(usageNote, errorText(err.message), true);
        setText(todayEl, "—");
        setText(usersEl, "—");
        setText(limitEl, "—");
        barsEl.textContent = "";
        topEl.textContent = "";
        return false;
      });
  }

  function refreshAll() {
    if (loading) return;
    loading = true;
    refreshBtn.disabled = true;
    setPanelState("ok", "Đang đọc…");
    Promise.all([loadCatalog(), loadUsage()]).then(function (results) {
      loading = false;
      refreshBtn.disabled = false;
      var ok = results[0] && results[1];
      setPanelState(ok ? "ok" : "error", ok ? "Đã cập nhật" : "Có lỗi");
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", renderCatalog);
  }
  if (filterSelect) {
    filterSelect.addEventListener("change", renderCatalog);
  }
  if (refreshBtn) {
    refreshBtn.addEventListener("click", refreshAll);
  }

  refreshAll();
})();
