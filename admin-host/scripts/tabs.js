(function () {
  "use strict";

  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-admin-tab]"));
  var panels = Array.prototype.slice.call(document.querySelectorAll("[data-tab-panel]"));
  if (!tabs.length || !panels.length) return;

  var DEFAULT_TAB = "overview";
  var activeId = null;

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
