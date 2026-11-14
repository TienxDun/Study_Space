(function () {
  "use strict";

  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-admin-tab]"));
  var panels = Array.prototype.slice.call(document.querySelectorAll("[data-tab-panel]"));
  if (!tabs.length || !panels.length) return;

  var DEFAULT_TAB = "overview";
  var activeId = null;

  // Tiêu đề lớn đổi theo tab; pill trạng thái ở topbar đã thay cho dòng eyebrow cũ.
  var PAGE_COPY = {
    overview: [
      "Bảng điều khiển hệ thống",
      "Theo dõi tình trạng hoạt động, quản lý kho nội dung, cấu hình trợ lý AI và xử lý tài khoản tại một nơi tập trung."
    ],
    diagnostics: [
      "Chẩn đoán hệ thống",
      "Xem sự cố gần đây, nhật ký thao tác quản trị và tình trạng từng dịch vụ thành phần."
    ],
    flags: [
      "Tính năng & giới hạn",
      "Bật tắt trợ lý AI, phòng học nhóm, chế độ bảo trì và đặt hạn mức câu hỏi mỗi ngày."
    ],
    chat: [
      "Trợ lý chat",
      "Sắp thứ tự chuỗi mô hình dự phòng và quản lý nhà cung cấp kèm khoá kết nối."
    ],
    content: [
      "Kho nội dung",
      "Quản lý cảnh nền, âm thanh, bài nhạc và tệp lưu trữ; thay đổi lên sóng ngay và có lịch sử để hoàn tác."
    ],
    reports: [
      "Báo cáo vi phạm",
      "Tiếp nhận phản ánh từ trợ lý AI và phòng học nhóm, đánh dấu xử lý hoặc áp dụng hạn chế tài khoản."
    ],
    feedback: [
      "Góp ý & báo lỗi",
      "Đọc góp ý của học viên, đánh dấu đã xử lý hoặc bỏ qua kèm ghi chú."
    ],
    users: [
      "Người dùng",
      "Tra cứu tài khoản theo email, xem mức sử dụng và hạn chế tính năng khi cần."
    ]
  };
  var pageTitleEl = document.getElementById("page-title");
  var pageSubtitleEl = document.getElementById("page-subtitle");

  // Rail dọc ở desktop, dải ngang ở mobile — đổi aria-orientation theo bố cục.
  var wideQuery = typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 1024px)") : null;
  var tablist = document.querySelector(".admin-tabs-inner");

  function syncOrientation() {
    if (!tablist) return;
    tablist.setAttribute("aria-orientation", wideQuery && wideQuery.matches ? "vertical" : "horizontal");
  }

  syncOrientation();
  if (wideQuery && wideQuery.addEventListener) {
    wideQuery.addEventListener("change", syncOrientation);
  }

  function tabIds() {
    return tabs.map(function (tab) {
      return tab.getAttribute("data-admin-tab");
    });
  }

  function tabFromHash() {
    var id = String(window.location.hash || "").replace(/^#\/?/, "");
    return tabIds().indexOf(id) >= 0 ? id : DEFAULT_TAB;
  }

  function activate(id, options) {
    if (tabIds().indexOf(id) < 0) id = DEFAULT_TAB;
    var changed = id !== activeId;
    activeId = id;

    var copy = PAGE_COPY[id];
    if (copy) {
      if (pageTitleEl) pageTitleEl.textContent = copy[0];
      if (pageSubtitleEl) pageSubtitleEl.textContent = copy[1];
    }

    tabs.forEach(function (tab) {
      var on = tab.getAttribute("data-admin-tab") === id;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      if (on) {
        // Dùng nhãn, không dùng textContent: badge số mục chờ cũng nằm trong nút.
        var label = tab.querySelector(".admin-tab-label");
        document.title = "ZenStudy · " + (label ? label.textContent : tab.textContent).trim() + " · Bảng điều khiển hệ thống";
      }
    });

    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-tab-panel") !== id;
    });

    if (options && options.updateHash && window.location.hash !== "#" + id) {
      window.history.replaceState(null, "", "#" + id);
    }

    if (changed && options && options.scroll) {
      window.scrollTo(0, 0);
    }
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () {
      activate(tab.getAttribute("data-admin-tab"), { updateHash: true, scroll: true });
    });

    tab.addEventListener("keydown", function (event) {
      var next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = tabs[(index + 1) % tabs.length];
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === "Home") next = tabs[0];
      else if (event.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      next.focus();
      activate(next.getAttribute("data-admin-tab"), { updateHash: true, scroll: false });
    });
  });

  window.addEventListener("hashchange", function () {
    activate(tabFromHash(), {});
  });

  activate(tabFromHash(), {});
})();
