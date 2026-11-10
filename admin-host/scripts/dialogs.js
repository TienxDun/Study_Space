(function () {
  "use strict";

  // Hộp thoại xác nhận dùng chung cho shell admin.
  // window.confirm/prompt không đổi được giao diện, không hiện được ngữ cảnh
  // (đường dẫn tệp) và trình duyệt có thể chặn khi tab không được focus.

  var els = null;
  var current = null;

  function build() {
    if (els) return els;

    var overlay = document.createElement("div");
    overlay.className = "admin-dialog";
    overlay.hidden = true;

    var backdrop = document.createElement("div");
    backdrop.className = "admin-dialog-backdrop";

    var card = document.createElement("div");
    card.className = "admin-dialog-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "admin-dialog-title");
    card.setAttribute("aria-describedby", "admin-dialog-desc");

    var head = document.createElement("header");
    head.className = "admin-dialog-head";
    var icon = document.createElement("span");
    icon.className = "admin-dialog-icon";
    icon.setAttribute("aria-hidden", "true");
    var title = document.createElement("h2");
    title.className = "admin-dialog-title";
    title.id = "admin-dialog-title";
    head.appendChild(icon);
    head.appendChild(title);

    var desc = document.createElement("p");
    desc.className = "admin-dialog-desc";
    desc.id = "admin-dialog-desc";

    var detail = document.createElement("code");
    detail.className = "admin-dialog-detail";

    var field = document.createElement("label");
    field.className = "admin-dialog-field";
    var fieldLabel = document.createElement("span");
    fieldLabel.className = "admin-dialog-label";
    var input = document.createElement("input");
    input.className = "flag-input admin-dialog-input";
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    var hint = document.createElement("span");
    hint.className = "admin-dialog-hint";
    field.appendChild(fieldLabel);
    field.appendChild(input);
    field.appendChild(hint);

    var actions = document.createElement("footer");
    actions.className = "admin-dialog-actions";
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn-ghost admin-dialog-cancel";
    var ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn-primary admin-dialog-ok";
    actions.appendChild(cancel);
    actions.appendChild(ok);

    card.appendChild(head);
    card.appendChild(desc);
    card.appendChild(detail);
    card.appendChild(field);
    card.appendChild(actions);
    overlay.appendChild(backdrop);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    els = {
      overlay: overlay,
      backdrop: backdrop,
      card: card,
      icon: icon,
      title: title,
      desc: desc,
      detail: detail,
      field: field,
      fieldLabel: fieldLabel,
      input: input,
      hint: hint,
      cancel: cancel,
      ok: ok
    };

    backdrop.addEventListener("click", function () {
      cancelDialog();
    });
    cancel.addEventListener("click", function () {
      cancelDialog();
    });
    ok.addEventListener("click", function () {
      if (!current || ok.disabled) return;
      if (!current.isPrompt) {
        close(true);
        return;
      }
      var value = input.value.trim();
      if (current.required !== null && value !== current.required) return;
      close(value);
    });
    input.addEventListener("input", syncInput);

    return els;
  }

  function cancelDialog() {
    if (!current) return;
    close(current.isPrompt ? null : false);
  }

  function syncInput() {
    if (!current || !current.isPrompt) return;
    var ui = build();
    if (current.required === null) return;

    var value = ui.input.value.trim();
    var match = value === current.required;
    ui.ok.disabled = !match;
    ui.hint.classList.toggle("is-ok", match);
    ui.hint.classList.toggle("is-error", !match && value.length > 0);
    if (match) ui.hint.textContent = "Đã khớp, có thể xác nhận.";
    else if (value) ui.hint.textContent = "Chưa khớp tên tệp.";
    else ui.hint.textContent = current.emptyHint;
  }

  function focusables() {
    var list = els.card.querySelectorAll("button, input, [href]");
    return Array.prototype.filter.call(list, function (node) {
      return !node.disabled && !node.closest("[hidden]");
    });
  }

  function onKeydown(event) {
    if (!current) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelDialog();
      return;
    }

    if (
      event.key === "Enter" &&
      current.isPrompt &&
      event.target === els.input &&
      !els.ok.disabled
    ) {
      event.preventDefault();
      close(els.input.value.trim());
      return;
    }

    if (event.key !== "Tab") return;
    var list = focusables();
    if (!list.length) return;
    var index = list.indexOf(document.activeElement);
    var next;
    if (event.shiftKey) next = index <= 0 ? list[list.length - 1] : list[index - 1];
    else next = index === -1 || index === list.length - 1 ? list[0] : list[index + 1];
    event.preventDefault();
    next.focus();
  }

  function close(value) {
    if (!current) return;
    var done = current;
    current = null;
    els.overlay.hidden = true;
    document.body.classList.remove("admin-dialog-open");
    document.removeEventListener("keydown", onKeydown, true);
    if (done.lastFocus && document.contains(done.lastFocus) && typeof done.lastFocus.focus === "function") {
      done.lastFocus.focus();
    }
    done.resolve(value);
  }

  function open(options) {
    var ui = build();
    if (current) close(current.isPrompt ? null : false);

    options = options || {};
    var isPrompt = options.mode === "prompt";
    var required = isPrompt && typeof options.required === "string" ? options.required : null;

    ui.title.textContent = options.title || "Xác nhận";
    ui.desc.textContent = options.description || "";
    ui.desc.hidden = !options.description;
    ui.detail.textContent = options.detail || "";
    ui.detail.hidden = !options.detail;
    ui.field.hidden = !isPrompt;
    ui.fieldLabel.textContent = options.inputLabel || "Giá trị";
    ui.input.value = "";
    ui.input.placeholder = options.placeholder || "";
    ui.hint.textContent = "";
    ui.hint.className = "admin-dialog-hint";
    ui.cancel.textContent = options.cancelLabel || "Hủy";
    ui.ok.textContent = options.confirmLabel || "Xác nhận";
    ui.ok.disabled = isPrompt && required !== null;
    ui.ok.classList.toggle("is-danger", options.tone === "danger");
    ui.icon.classList.toggle("is-danger", options.tone === "danger");
    ui.icon.textContent = options.tone === "danger" ? "!" : "?";

    return new Promise(function (resolve) {
      current = {
        resolve: resolve,
        isPrompt: isPrompt,
        required: required,
        emptyHint: options.inputHint || "",
        lastFocus: document.activeElement
      };
      ui.overlay.hidden = false;
      document.body.classList.add("admin-dialog-open");
      document.addEventListener("keydown", onKeydown, true);
      // Hộp thoại xóa mặc định đặt focus vào Hủy để lỡ bấm Enter không xóa nhầm.
      if (isPrompt) {
        ui.input.focus();
        syncInput();
      } else if (options.tone === "danger") ui.cancel.focus();
      else ui.ok.focus();
    });
  }

  window.AdminDialog = {
    confirm: function (options) {
      return open(Object.assign({ mode: "confirm" }, options)).then(function (value) {
        return value === true;
      });
    },
    prompt: function (options) {
      return open(Object.assign({ mode: "prompt" }, options)).then(function (value) {
        return typeof value === "string" ? value : null;
      });
    }
  };
})();
