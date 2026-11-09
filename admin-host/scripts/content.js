(function () {
  "use strict";

  // P2c: quản lý nội dung runtime (cảnh nền / âm thanh / nhạc).
  // Đọc và ghi qua /api/admin/content; mỗi lần lưu là một bản phát hành mới.

  var API = "/api/admin/content";
  // Kho R2 công khai mà ứng dụng đang dùng; chỉ để xem trước ảnh/âm thanh trong admin.
  var CDN_BASE = "https://study-space-shield.leutiendung-hht.workers.dev";

  var ERROR_TEXT = {
    invalid_body: "dữ liệu chưa hợp lệ, kiểm tra lại các ô",
    invalid_kind: "loại nội dung không hợp lệ",
    invalid_catalog: "có mục chưa hợp lệ",
    invalid_json: "dữ liệu trong kho bị hỏng",
    audit_failed: "không ghi được nhật ký nên chưa lưu",
    rate_limited: "bạn vừa lưu quá nhiều lần, chờ một phút rồi thử lại",
    version_conflict: "có người vừa lưu trước, tải lại trang rồi thử lại",
    already_initialized: "kho đã có bản phát hành",
    missing_binding: "Worker chưa nối D1",
    d1_error: "lỗi cơ sở dữ liệu",
    r2_error: "không đọc được kho tệp",
    not_found: "không tìm thấy mục này"
  };

  var CATEGORY_LABELS = {
    chill: "Chill",
    anime: "Anime",
    cyberpunk: "Cyberpunk",
    dark: "Tối",
    urban: "Thành phố",
    nature: "Thiên nhiên",
    cartoon: "Hoạt hình",
    cute: "Dễ thương",
    rain: "Mưa",
    indoor: "Trong nhà"
  };

  var MOOD_LABELS = { lofi: "Lo-fi", jazz: "Jazz", relax: "Thư giãn" };

  var panel = document.getElementById("content-panel");
  if (!panel) return;

  var metaEl = document.getElementById("content-meta");
  var stateEl = document.getElementById("content-state");
  var noteEl = document.getElementById("content-note");
  var seedBlock = document.getElementById("content-seed");
  var seedRun = document.getElementById("content-seed-run");
  var seedNote = document.getElementById("content-seed-note");
  var versionRows = document.getElementById("content-version-rows");
  var historyNote = document.getElementById("content-history-note");
  var downloadBtn = document.getElementById("content-download");
  var tabs = panel.querySelectorAll(".content-tab");

  var lists = { scenes: null, sounds: null, tracks: null };
  var counts = { scenes: 0, sounds: 0, tracks: 0 };
  var release = { version: 0, createdAt: 0, createdBy: "" };
  var versions = [];
  var active = "scenes";
  var busy = false;
  var editors = {
    scenes: { id: "", base: "", open: false },
    sounds: { id: "", base: "", open: false },
    tracks: { id: "", base: "", open: false }
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function debounce(fn, wait) {
    var timer = 0;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, wait);
    };
  }

  function call(path, options) {
    options = options || {};
    return fetch(API + path, {
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

  function errorText(code, errors) {
    var base = ERROR_TEXT[code] || (code ? String(code) : "lỗi chưa xác định");
    if (Array.isArray(errors) && errors.length) {
      var first = errors[0];
      var detail = first && first.message ? first.message : "";
      if (detail) return base + ": " + detail;
    }
    return base;
  }

  function fmtTime(ms) {
    var value = Number(ms);
    if (!value) return "--";
    var d = new Date(value);
    var pad = function (n) {
      return n < 10 ? "0" + n : String(n);
    };
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function fmtBytes(value) {
    var num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return "0 KB";
    if (num >= 1000 * 1000 * 1000) return (num / 1000 / 1000 / 1000).toFixed(1) + " GB";
    if (num >= 1000 * 1000) return (num / 1000 / 1000).toFixed(1) + " MB";
    return Math.max(1, Math.round(num / 1000)) + " KB";
  }

  function mediaUrl(path) {
    var value = String(path || "");
    if (!value) return "";
    if (/^(https?:|data:)/i.test(value)) return value;
    return CDN_BASE + "/" + value.replace(/^\/+/, "");
  }

  // Trang admin đặt Referrer-Policy: no-referrer nhưng CDN từ chối request không có referer,
  // nên từng thẻ media phải tự xin gửi origin.
  function mediaNode(node) {
    node.setAttribute("referrerpolicy", "origin");
    return node;
  }

  // Ảnh xem trước chỉ tải khi hàng sắp vào khung nhìn. Ảnh gốc là file 4K
  // (ảnh nền dùng chung), nên để `loading="lazy"` tự nhiên sẽ kéo cả chục file
  // vài trăm KB ngay khi mở tab.
  var thumbObserver =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              var img = entry.target;
              thumbObserver.unobserve(img);
              img.src = img.getAttribute("data-src") || "";
              img.removeAttribute("data-src");
            });
          },
          { rootMargin: "200px 0px" }
        )
      : null;

  function thumbNode(src, alt) {
    var img = mediaNode(el("img", "content-thumb"));
    img.alt = alt || "";
    img.width = 74;
    img.height = 44;
    img.loading = "lazy";
    img.decoding = "async";
    if (thumbObserver) {
      img.setAttribute("data-src", src);
      thumbObserver.observe(img);
    } else {
      img.src = src;
    }
    return img;
  }

  function setNote(node, message, mode) {
    if (!node) return;
    if (!message) {
      node.hidden = true;
      node.textContent = "";
      node.className = "chat-feedback";
      return;
    }
    node.hidden = false;
    node.textContent = message;
    node.className = "chat-feedback" + (mode ? " is-" + mode : "");
  }

  function setBusy(next, button) {
    busy = next;
    if (!button) return;
    button.classList.toggle("is-loading", next);
    var span = button.querySelector("span, .label");
    if (span) {
      span.textContent = next ? "Đang lưu…" : button.getAttribute("data-label") || span.textContent;
    } else {
      button.textContent = next ? "Đang lưu…" : button.getAttribute("data-label") || button.textContent;
    }
    button.disabled = next;
  }

  function fileState(kind, path) {
    if (!path) return { mode: "missing", text: "Thiếu đường dẫn" };
    var list = lists[kind];
    if (!list) return { mode: "unknown", text: "Chưa đọc" };
    if (!list.filesOk) return { mode: "unknown", text: "Không đọc được kho" };
    var size = list.media ? list.media[path] : null;
    if (typeof size === "number") return { mode: "ok", text: fmtBytes(size) };
    return { mode: "missing", text: "Thiếu file" };
  }

  function statusCell(kind, path) {
    var state = fileState(kind, path);
    var td = el("td");
    var chip = el(
      "span",
      "content-status is-" + state.mode,
      state.mode === "ok" ? "Có file · " + state.text : state.text
    );
    td.appendChild(chip);
    if (path) td.appendChild(el("div", "content-cell-sub", path));
    return td;
  }

  function hiddenTag() {
    var tag = el("span", "content-tag is-hidden", "Đang ẩn");
    return tag;
  }

  function actionsCell(kind, item) {
    var td = el("td");
    var box = el("div", "content-row-actions");

    var edit = el("button", "btn-ghost", "Sửa");
    edit.type = "button";
    edit.addEventListener("click", function () {
      openForm(kind, item);
    });

    var remove = el("button", "btn-ghost", "Xóa");
    remove.type = "button";
    remove.addEventListener("click", function () {
      removeItem(kind, item);
    });

    box.appendChild(edit);
    box.appendChild(remove);
    td.appendChild(box);
    return td;
  }

  // ---------- Biểu mẫu ----------

  var FIELD = {};
  [
    "scene-name", "scene-category", "scene-type", "scene-badge", "scene-media", "scene-thumb",
    "scene-description", "scene-tags", "scene-hidden", "scene-form", "scene-form-title",
    "scene-form-note", "scene-form-hint", "scene-save", "scene-cancel", "scene-preview",
    "scene-search", "scene-filter", "scene-add", "scene-rows",
    "sound-name", "sound-category", "sound-icon", "sound-audio", "sound-hidden", "sound-form",
    "sound-form-title", "sound-form-note", "sound-form-hint", "sound-save", "sound-cancel",
    "sound-preview", "sound-search", "sound-add", "sound-rows",
    "track-title", "track-artist", "track-genre", "track-mood", "track-audio", "track-cover",
    "track-hidden", "track-form", "track-form-title", "track-form-note", "track-form-hint",
    "track-save", "track-cancel", "track-preview", "track-search", "track-filter", "track-add",
    "track-rows"
  ].forEach(function (id) {
    FIELD[id] = document.getElementById(id);
  });

  function makeNameCell(name, id, sub, hidden) {
    var td = el("td"), main = el("div", "content-cell-main");
    main.appendChild(el("span", null, name || "(chưa đặt tên)"));
    if (hidden) main.appendChild(hiddenTag());
    main.appendChild(el("div", "content-cell-sub", sub || id));
    td.appendChild(main);
    return td;
  }

  function setPreviewMedia(box, tag, src, props) {
    if (!src) return null;
    var node = mediaNode(el(tag));
    if (props) Object.assign(node, props);
    node.src = mediaUrl(src);
    box.appendChild(node);
    return node;
  }

  function listTags(raw) {
    return String(raw || "")
      .split(",")
      .map(function (part) { return part.trim(); })
      .filter(Boolean)
      .slice(0, 10);
  }

  function readSceneForm() {
    return {
      name: FIELD["scene-name"].value.trim(),
      category: FIELD["scene-category"].value,
      type: FIELD["scene-type"].value,
      badge: FIELD["scene-badge"].value,
      mediaPath: FIELD["scene-media"].value.trim(),
      thumbnailPath: FIELD["scene-thumb"].value.trim(),
      description: FIELD["scene-description"].value.trim(),
      tags: listTags(FIELD["scene-tags"].value),
      hidden: FIELD["scene-hidden"].checked
    };
  }

  function fillSceneForm(item) {
    var d = item || {};
    FIELD["scene-name"].value = d.name || "";
    FIELD["scene-category"].value = d.category || "chill";
    FIELD["scene-type"].value = d.type || "IMAGE";
    FIELD["scene-badge"].value = d.badge || "";
    FIELD["scene-media"].value = d.mediaPath || "";
    FIELD["scene-thumb"].value = d.thumbnailPath || "";
    FIELD["scene-description"].value = d.description || "";
    FIELD["scene-tags"].value = Array.isArray(d.tags) ? d.tags.join(", ") : "";
    FIELD["scene-hidden"].checked = d.hidden === true;
  }

  function validateScene(item) {
    if (!item.name) return "Điền tên cảnh.";
    if (item.name.length > 80) return "Tên cảnh tối đa 80 ký tự.";
    if (!item.mediaPath) return "Điền đường dẫn file.";
    if (item.type === "VIDEO" && !item.thumbnailPath) return "Cảnh video cần ảnh xem trước.";
    return "";
  }

  function previewScene() {
    var item = readSceneForm(), box = FIELD["scene-preview"];
    box.textContent = "";
    var thumb = item.type === "VIDEO" ? item.thumbnailPath : item.thumbnailPath || item.mediaPath;
    setPreviewMedia(box, "img", thumb, { alt: item.name || "Xem trước cảnh", loading: "lazy" });
    if (item.type === "VIDEO") setPreviewMedia(box, "video", item.mediaPath, { controls: true, preload: "metadata" });
    box.appendChild(el("span", "content-preview-note", item.mediaPath || "Chưa có đường dẫn file."));
  }

  function readSoundForm() {
    return {
      name: FIELD["sound-name"].value.trim(),
      category: FIELD["sound-category"].value,
      icon: FIELD["sound-icon"].value,
      audioPath: FIELD["sound-audio"].value.trim(),
      hidden: FIELD["sound-hidden"].checked
    };
  }

  function fillSoundForm(item) {
    var d = item || {};
    FIELD["sound-name"].value = d.name || "";
    FIELD["sound-category"].value = d.category || "rain";
    FIELD["sound-icon"].value = d.icon || "CloudRain";
    FIELD["sound-audio"].value = d.audioPath || "";
    FIELD["sound-hidden"].checked = d.hidden === true;
  }

  function validateSound(item) {
    if (!item.name) return "Điền tên âm thanh.";
    if (!item.audioPath) return "Điền đường dẫn file mp3.";
    return "";
  }

  function previewSound() {
    var item = readSoundForm(), box = FIELD["sound-preview"];
    box.textContent = "";
    setPreviewMedia(box, "audio", item.audioPath, { controls: true, preload: "none" });
    box.appendChild(el("span", "content-preview-note", item.audioPath ? item.audioPath + " · icon " + item.icon : "Chưa có đường dẫn file."));
  }

  function readTrackForm() {
    return {
      title: FIELD["track-title"].value.trim(),
      artist: FIELD["track-artist"].value.trim(),
      genre: FIELD["track-genre"].value.trim(),
      category: FIELD["track-mood"].value,
      audioPath: FIELD["track-audio"].value.trim(),
      coverPath: FIELD["track-cover"].value.trim(),
      hidden: FIELD["track-hidden"].checked
    };
  }

  function fillTrackForm(item) {
    var d = item || {};
    FIELD["track-title"].value = d.title || "";
    FIELD["track-artist"].value = d.artist || "";
    FIELD["track-genre"].value = d.genre || "";
    FIELD["track-mood"].value = d.category || "lofi";
    FIELD["track-audio"].value = d.audioPath || "";
    FIELD["track-cover"].value = d.coverPath || "";
    FIELD["track-hidden"].checked = d.hidden === true;
  }

  function validateTrack(item) {
    if (!item.title) return "Điền tiêu đề bài.";
    if (!item.artist) return "Điền tên ca sĩ / nghệ sĩ.";
    if (!item.audioPath) return "Điền đường dẫn file mp3.";
    if (!item.coverPath) return "Thiếu ảnh bìa (URL hoặc đường dẫn trong kho).";
    return "";
  }

  function previewTrack() {
    var item = readTrackForm(), box = FIELD["track-preview"];
    box.textContent = "";
    setPreviewMedia(box, "img", item.coverPath, { alt: item.title || "Ảnh bìa", loading: "lazy" });
    setPreviewMedia(box, "audio", item.audioPath, { controls: true, preload: "none" });
    box.appendChild(el("span", "content-preview-note", item.audioPath || "Chưa có đường dẫn file."));
  }

  var SPECS = {
    scenes: {
      noun: "cảnh",
      columns: 6,
      pane: document.getElementById("pane-scenes"),
      rows: FIELD["scene-rows"],
      form: FIELD["scene-form"],
      formTitle: FIELD["scene-form-title"],
      formNote: FIELD["scene-form-note"],
      formHint: FIELD["scene-form-hint"],
      saveBtn: FIELD["scene-save"],
      cancelBtn: FIELD["scene-cancel"],
      search: FIELD["scene-search"],
      filter: FIELD["scene-filter"],
      addBtn: FIELD["scene-add"],
      read: readSceneForm,
      fill: fillSceneForm,
      validate: validateScene,
      preview: previewScene,
      title: function (item) { return item.name || item.id; },
      matches: function (item, query, filter) {
        if (filter && item.category !== filter) return false;
        if (!query) return true;
        return (String(item.name || "") + " " + String(item.tags || "")).toLowerCase().indexOf(query) >= 0;
      },
      cells: function (item) {
        var thumbCell = el("td"), preview = el("div");
        var src = item.type === "VIDEO" ? item.thumbnailPath : item.thumbnailPath || item.mediaPath;
        preview.appendChild(src ? thumbNode(mediaUrl(src), item.name || "") : el("div", "content-thumb is-empty", item.type === "VIDEO" ? "Video" : "Chưa có ảnh"));
        thumbCell.appendChild(preview);
        return [thumbCell, makeNameCell(item.name, item.id, null, item.hidden), el("td", null, CATEGORY_LABELS[item.category] || item.category || "--"), el("td", null, item.type === "VIDEO" ? "Video" : "Ảnh"), statusCell("scenes", item.mediaPath)];
      }
    },
    sounds: {
      noun: "âm thanh",
      columns: 5,
      pane: document.getElementById("pane-sounds"),
      rows: FIELD["sound-rows"],
      form: FIELD["sound-form"],
      formTitle: FIELD["sound-form-title"],
      formNote: FIELD["sound-form-note"],
      formHint: FIELD["sound-form-hint"],
      saveBtn: FIELD["sound-save"],
      cancelBtn: FIELD["sound-cancel"],
      search: FIELD["sound-search"],
      addBtn: FIELD["sound-add"],
      read: readSoundForm,
      fill: fillSoundForm,
      validate: validateSound,
      preview: previewSound,
      title: function (item) { return item.name || item.id; },
      matches: function (item, query) {
        if (!query) return true;
        return String(item.name || "").toLowerCase().indexOf(query) >= 0;
      },
      cells: function (item) {
        var iconCell = el("td");
        iconCell.appendChild(el("span", "content-tag", item.icon || "--"));
        return [iconCell, makeNameCell(item.name, item.id, null, item.hidden), el("td", null, CATEGORY_LABELS[item.category] || item.category || "--"), statusCell("sounds", item.audioPath)];
      }
    },
    tracks: {
      noun: "bài nhạc",
      columns: 5,
      pane: document.getElementById("pane-tracks"),
      rows: FIELD["track-rows"],
      form: FIELD["track-form"],
      formTitle: FIELD["track-form-title"],
      formNote: FIELD["track-form-note"],
      formHint: FIELD["track-form-hint"],
      saveBtn: FIELD["track-save"],
      cancelBtn: FIELD["track-cancel"],
      search: FIELD["track-search"],
      filter: FIELD["track-filter"],
      addBtn: FIELD["track-add"],
      read: readTrackForm,
      fill: fillTrackForm,
      validate: validateTrack,
      preview: previewTrack,
      title: function (item) { return item.title || item.id; },
      matches: function (item, query, filter) {
        if (filter && item.category !== filter) return false;
        if (!query) return true;
        return (String(item.title || "") + " " + String(item.artist || "")).toLowerCase().indexOf(query) >= 0;
      },
      cells: function (item) {
        var coverCell = el("td");
        coverCell.appendChild(item.coverPath ? thumbNode(mediaUrl(item.coverPath), item.title || "") : el("div", "content-thumb is-empty", "Chưa có bìa"));
        return [coverCell, makeNameCell(item.title, item.id, (item.artist || "--") + " · " + (item.genre || "--"), item.hidden), el("td", null, MOOD_LABELS[item.category] || item.category || "--"), statusCell("tracks", item.audioPath)];
      }
    }
  };

  // ---------- Hiển thị ----------

  function renderMeta() {
    if (!release.version) {
      metaEl.textContent = "Chưa phát hành bản nào — ứng dụng đang dùng bộ nội dung đóng gói sẵn.";
      return;
    }
    metaEl.textContent =
      "Bản v" + release.version +
      " · " + counts.scenes + " cảnh" +
      " · " + counts.sounds + " âm" +
      " · " + counts.tracks + " nhạc" +
      " · " + fmtTime(release.createdAt) +
      (release.createdBy ? " bởi " + release.createdBy : "");
  }

  function renderCounts() {
    var map = { scenes: "count-scenes", sounds: "count-sounds", tracks: "count-tracks" };
    Object.keys(map).forEach(function (kind) {
      var node = document.getElementById(map[kind]);
      if (node) node.textContent = String(counts[kind] || 0);
    });
  }

  function renderState() {
    var dirty = false;
    Object.keys(editors).forEach(function (kind) {
      if (editors[kind].open && formDirty(kind)) dirty = true;
    });
    stateEl.classList.toggle("is-dirty", dirty);
    stateEl.textContent = dirty ? "Có thay đổi chưa lưu" : release.version ? "Đã đọc bản v" + release.version : "Chưa phát hành";
  }

  // Hàng được dựng một lần cho mỗi lần đọc dữ liệu; lọc chỉ ẩn/hiện lại để
  // ảnh xem trước không bị tạo lại (và tải lại) theo từng ký tự gõ vào ô tìm.
  var rowCaches = { scenes: null, sounds: null, tracks: null };

  function buildRow(kind, item) {
    var row = el("tr");
    SPECS[kind].cells(item).forEach(function (cellNode) {
      row.appendChild(cellNode);
    });
    row.appendChild(actionsCell(kind, item));
    return row;
  }

  function renderList(kind) {
    var spec = SPECS[kind];
    var list = lists[kind];
    var body = spec.rows;

    if (!list) {
      body.textContent = "";
      rowCaches[kind] = null;
      var wait = el("tr");
      var waitCell = el("td", null, "Đang đọc…");
      waitCell.colSpan = spec.columns;
      wait.appendChild(waitCell);
      body.appendChild(wait);
      return;
    }

    if (!rowCaches[kind]) {
      body.textContent = "";
      var rows = new Map();
      (list.items || []).forEach(function (item) {
        var row = buildRow(kind, item);
        rows.set(item, row);
        body.appendChild(row);
      });

      var empty = el("tr");
      var emptyCell = el("td");
      emptyCell.colSpan = spec.columns;
      empty.appendChild(emptyCell);
      empty.hidden = true;
      body.appendChild(empty);

      rowCaches[kind] = { rows: rows, empty: empty, emptyCell: emptyCell };
    }

    var cache = rowCaches[kind];
    var query = String(spec.search && spec.search.value ? spec.search.value : "").trim().toLowerCase();
    var filter = spec.filter ? spec.filter.value : "";
    var items = (list.items || []).filter(function (item) {
      return spec.matches(item, query, filter);
    });
    var visible = new Set(items);

    cache.rows.forEach(function (row, item) {
      row.hidden = !visible.has(item);
    });

    cache.emptyCell.textContent = list.items && list.items.length ? "Không có mục nào khớp bộ lọc." : "Chưa có mục nào.";
    cache.empty.hidden = items.length > 0;

    // Danh sách cuộn trong khung riêng: đổi bộ lọc thì đưa về đầu để thấy kết quả.
    var scroller = body.parentNode && body.parentNode.parentNode;
    if (scroller && scroller.scrollTop) scroller.scrollTop = 0;
  }

  // ---------- Biểu mẫu: mở / đóng / lưu ----------

  function formDirty(kind) {
    var editor = editors[kind];
    if (!editor.open) return false;
    return JSON.stringify(SPECS[kind].read()) !== editor.base;
  }

  function openForm(kind, item) {
    var spec = SPECS[kind];
    var editor = editors[kind];
    if (editor.open && formDirty(kind) && !window.confirm("Bỏ các thay đổi chưa lưu của " + spec.noun + " đang sửa?")) {
      return;
    }

    spec.fill(item || {});
    editor.id = item && item.id ? item.id : "";
    editor.open = true;
    editor.base = JSON.stringify(spec.read());

    spec.formTitle.textContent = editor.id ? "Sửa " + spec.noun : "Thêm " + spec.noun;
    spec.formHint.textContent = editor.id
      ? "Bấm Lưu để phát hành bản mới với thay đổi này."
      : "Điền thông tin rồi bấm Lưu; bản mới lên sóng ngay.";
    setNote(spec.formNote, "");
    spec.form.hidden = false;
    spec.pane.classList.add("is-editing");
    spec.preview();
    renderState();
    var first = spec.form.querySelector("input, select");
    if (first) first.focus();
  }

  function closeForm(kind) {
    var spec = SPECS[kind];
    var editor = editors[kind];
    editor.id = "";
    editor.base = "";
    editor.open = false;
    spec.form.hidden = true;
    spec.pane.classList.remove("is-editing");
    setNote(spec.formNote, "");
    renderState();
  }

  function requestClose(kind) {
    var spec = SPECS[kind];
    if (formDirty(kind) && !window.confirm("Bỏ các thay đổi chưa lưu của " + spec.noun + "?")) return;
    closeForm(kind);
  }

  function save(kind) {
    var spec = SPECS[kind];
    if (busy) return;

    var item = spec.read();
    var invalid = spec.validate(item);
    if (invalid) {
      setNote(spec.formNote, invalid, "error");
      return;
    }

    var editor = editors[kind];
    var isNew = !editor.id;
    setNote(spec.formNote, "");
    setBusy(true, spec.saveBtn);

    var request = isNew
      ? call("/items", { method: "POST", body: { kind: kind, item: item } })
      : call("/items", { method: "PATCH", body: { kind: kind, id: editor.id, patch: item } });

    request
      .then(function (res) {
        if (!res.ok || res.data.ok !== true) {
          throw new Error(errorText(res.data.error, res.data.errors));
        }
        return reloadKind(kind);
      })
      .then(function () {
        setBusy(false, spec.saveBtn);
        closeForm(kind);
        setNote(noteEl, "Đã lưu và phát hành bản v" + release.version + ".", "ok");
        renderState();
      })
      .catch(function (err) {
        setBusy(false, spec.saveBtn);
        setNote(spec.formNote, err.message || "Không lưu được.", "error");
      });
  }

  function removeItem(kind, item) {
    var spec = SPECS[kind];
    if (busy) return;
    if (!window.confirm("Xóa " + spec.noun + " “" + spec.title(item) + "” khỏi danh sách?\nFile trong kho vẫn giữ nguyên vì có thể dùng chung.")) {
      return;
    }

    setBusy(true);
    call("/items?kind=" + kind + "&id=" + encodeURIComponent(item.id), { method: "DELETE" })
      .then(function (res) {
        if (!res.ok || res.data.ok !== true) {
          throw new Error(errorText(res.data.error, res.data.errors));
        }
        return reloadKind(kind);
      })
      .then(function () {
        setBusy(false);
        setNote(noteEl, "Đã xóa khỏi danh sách và phát hành bản v" + release.version + ". File trong kho vẫn còn.", "ok");
      })
      .catch(function (err) {
        setBusy(false);
        setNote(noteEl, err.message || "Không xóa được.", "error");
      });
  }

  // ---------- Tải dữ liệu ----------

  function applyList(kind, payload) {
    lists[kind] = payload;
    rowCaches[kind] = null;
    release = {
      version: Number(payload.version) || 0,
      createdAt: Number(payload.createdAt) || 0,
      createdBy: String(payload.createdBy || "")
    };
    if (payload.counts) counts = payload.counts;
    seedBlock.hidden = release.version > 0;
    renderMeta();
    renderCounts();
    renderState();
    renderList(kind);
  }

  function loadKind(kind) {
    renderList(kind);
    return call("/items?kind=" + kind).then(function (res) {
      if (!res.ok || res.data.ok !== true) {
        throw new Error(errorText(res.data.error));
      }
      applyList(kind, res.data);
    });
  }

  function reloadKind(kind) {
    return loadKind(kind).then(function () {
      return loadVersions();
    });
  }

  function loadVersions() {
    return call("/versions")
      .then(function (res) {
        if (!res.ok || res.data.ok !== true) {
          throw new Error(errorText(res.data.error));
        }
        versions = Array.isArray(res.data.versions) ? res.data.versions : [];
        renderVersions();
      })
      .catch(function (err) {
        versionRows.textContent = "";
        var row = el("tr");
        var cell = el("td", null, err.message || "Không đọc được lịch sử.");
        cell.colSpan = 5;
        row.appendChild(cell);
        versionRows.appendChild(row);
        historyNote.textContent = "Chưa đọc được lịch sử.";
      });
  }

  function renderVersions() {
    versionRows.textContent = "";
    if (!versions.length) {
      var empty = el("tr");
      var cell = el("td", null, "Chưa có bản phát hành nào.");
      cell.colSpan = 5;
      empty.appendChild(cell);
      versionRows.appendChild(empty);
      historyNote.textContent = "Chưa có bản phát hành nào.";
      downloadBtn.disabled = true;
      return;
    }

    versions.forEach(function (entry) {
      var row = el("tr");
      row.appendChild(el("td", null, "v" + entry.version));
      row.appendChild(el("td", null, fmtTime(entry.createdAt)));
      row.appendChild(el("td", null, entry.createdBy || "--"));
      row.appendChild(
        el(
          "td",
          null,
          entry.counts
            ? entry.counts.scenes + " cảnh · " + entry.counts.sounds + " âm · " + entry.counts.tracks + " nhạc"
            : "Không đọc được"
        )
      );

      var actionCell = el("td");
      var box = el("div", "content-row-actions");

      var back = el("button", "btn-ghost", "Quay lại");
      back.type = "button";
      back.addEventListener("click", function () {
        rollback(entry.version);
      });

      var save = el("button", "btn-ghost", "Tải JSON");
      save.type = "button";
      save.addEventListener("click", function () {
        downloadVersion(entry.version, save);
      });

      box.appendChild(back);
      box.appendChild(save);
      actionCell.appendChild(box);
      row.appendChild(actionCell);
      versionRows.appendChild(row);
    });

    historyNote.textContent = versions.length + " bản gần nhất, mới nhất ở trên.";
    downloadBtn.disabled = release.version < 1;
  }

  function rollback(version) {
    if (busy) return;
    var ok = window.confirm(
      "Quay lại bản v" + version + "?\nHệ thống sẽ tạo một bản mới cùng nội dung của v" + version +
        " và phát hành ngay. Lịch sử vẫn giữ đủ các bản cũ."
    );
    if (!ok) return;

    setBusy(true);
    call("/rollback", { method: "POST", body: { version: version } })
      .then(function (res) {
        if (!res.ok || res.data.ok !== true) {
          throw new Error(errorText(res.data.error));
        }
        return reloadKind(active);
      })
      .then(function () {
        setBusy(false);
        setNote(noteEl, "Đã quay lại nội dung của v" + version + " thành bản v" + release.version + ".", "ok");
      })
      .catch(function (err) {
        setBusy(false);
        setNote(noteEl, err.message || "Không quay lại được.", "error");
      });
  }

  function downloadVersion(version, button) {
    if (button) { button.disabled = true; button.textContent = "Đang tải…"; }
    call("/versions/" + version)
      .then(function (res) {
        if (!res.ok || res.data.ok !== true) throw new Error(errorText(res.data.error));
        var cat = res.data.catalog || {};
        var payload = {
          version: res.data.version,
          createdAt: res.data.createdAt,
          createdBy: res.data.createdBy,
          scenes: cat.scenes || [],
          sounds: cat.sounds || [],
          tracks: cat.tracks || { lofi: [], jazz: [], relax: [] }
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url;
        link.download = "zenstudy-content-v" + res.data.version + ".json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      })
      .catch(function (err) {
        setNote(noteEl, err.message || "Không tải được JSON.", "error");
      })
      .then(function () {
        if (button) { button.disabled = false; button.textContent = "Tải JSON"; }
      });
  }

  // ---------- Nạp bộ nội dung ban đầu ----------

  function fetchSeed(name) {
    return fetch("seed/" + name, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("Không đọc được seed/" + name + " (chạy npm run build:admin rồi tải lại).");
      return res.json();
    });
  }

  function runSeed() {
    if (busy) return;
    setNote(seedNote, "");
    setBusy(true, seedRun);

    Promise.all([fetchSeed("scenes.json"), fetchSeed("sounds.json"), fetchSeed("tracks.json")])
      .then(function (parts) {
        return call("/init", {
          method: "POST",
          body: { scenes: parts[0], sounds: parts[1], tracks: parts[2] }
        });
      })
      .then(function (res) {
        if (!res.ok || res.data.ok !== true) {
          throw new Error(errorText(res.data.error, res.data.errors));
        }
        return reloadKind(active);
      })
      .then(function () {
        setBusy(false, seedRun);
        seedBlock.hidden = true;
        setNote(noteEl, "Đã nạp bộ nội dung ban đầu thành bản v" + release.version + ".", "ok");
      })
      .catch(function (err) {
        setBusy(false, seedRun);
        setNote(seedNote, err.message || "Không nạp được bộ nội dung.", "error");
      });
  }

  // ---------- Tab ----------

  function setTab(kind) {
    if (active === kind) return;
    var leaving = SPECS[active];
    if (leaving && editors[active].open && formDirty(active)) {
      if (!window.confirm("Biểu mẫu " + leaving.noun + " còn thay đổi chưa lưu. Rời tab và bỏ các thay đổi này?")) {
        return;
      }
      closeForm(active);
    }

    active = kind;
    tabs.forEach(function (tab) {
      var isActive = tab.getAttribute("data-tab") === kind;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    Object.keys(SPECS).forEach(function (key) {
      SPECS[key].pane.hidden = key !== kind;
    });

    if (!lists[kind]) {
      loadKind(kind).catch(function (err) {
        setNote(noteEl, err.message || "Không đọc được nội dung.", "error");
      });
    }
  }

  // ---------- Gắn sự kiện ----------

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      setTab(tab.getAttribute("data-tab"));
    });
  });

  Object.keys(SPECS).forEach(function (kind) {
    var spec = SPECS[kind];
    spec.addBtn.addEventListener("click", function () {
      openForm(kind, null);
    });
    spec.cancelBtn.addEventListener("click", function () {
      requestClose(kind);
    });
    spec.saveBtn.addEventListener("click", function () {
      save(kind);
    });
    spec.search.addEventListener(
      "input",
      debounce(function () {
        renderList(kind);
      }, 120)
    );
    if (spec.filter) {
      spec.filter.addEventListener("change", function () {
        renderList(kind);
      });
    }
    spec.form.addEventListener("input", function () {
      spec.preview();
      renderState();
    });
    spec.form.addEventListener("submit", function (event) {
      event.preventDefault();
      save(kind);
    });
  });

  FIELD["scene-type"].addEventListener("change", function () {
    var isVideo = FIELD["scene-type"].value === "VIDEO";
    FIELD["scene-thumb"].placeholder = isVideo ? "thumbnails/ten-file.webp (bắt buộc)" : "thumbnails/ten-file.webp";
    if (!isVideo && !FIELD["scene-thumb"].value) {
      FIELD["scene-thumb"].value = FIELD["scene-media"].value;
    }
    previewScene();
  });

  FIELD["scene-media"].addEventListener("change", function () {
    if (FIELD["scene-type"].value !== "VIDEO" && !FIELD["scene-thumb"].value) {
      FIELD["scene-thumb"].value = FIELD["scene-media"].value;
    }
    previewScene();
  });

  seedRun.addEventListener("click", runSeed);
  downloadBtn.addEventListener("click", function () {
    downloadVersion(release.version, downloadBtn);
  });

  window.addEventListener("beforeunload", function (event) {
    var dirty = Object.keys(editors).some(function (kind) {
      return editors[kind].open && formDirty(kind);
    });
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // ---------- Khởi động ----------

  renderMeta();
  renderCounts();
  renderState();
  loadKind(active).catch(function (err) {
    setNote(noteEl, err.message || "Không đọc được nội dung.", "error");
  });
  loadVersions();
})();
