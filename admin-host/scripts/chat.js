(function () {
  "use strict";

  var API = "/api/admin/chat";
  var CHAIN_MAX_FALLBACK = 5;
  var PROVIDERS_MAX = 10;
  var PROMPT_MAX = 4000;
  var PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-_]{0,39}$/i;
  var CUSTOM_MODEL = "__custom__";

  var ERROR_TEXT = {
    missing_config: "chưa cấu hình địa chỉ hoặc mã chat-proxy",
    chat_proxy_unreachable: "không kết nối được chat-proxy",
    invalid_body: "dữ liệu chưa hợp lệ, kiểm tra lại các ô",
    audit_failed: "không ghi được nhật ký hành động nên chưa lưu",
    rate_limited: "bạn vừa thao tác quá nhiều lần, chờ một phút rồi thử lại"
  };

  var panel = document.getElementById("chat-panel");
  if (!panel) return;

  var stateEl = document.getElementById("chat-state");
  var modelNote = document.getElementById("chat-model-note");
  var tryBlock = document.getElementById("chat-try");
  var tryProvider = document.getElementById("chat-try-provider");
  var tryModelSlot = document.getElementById("chat-try-model");
  var tryRun = document.getElementById("chat-try-run");
  var tryResult = document.getElementById("chat-try-result");

  var chainEl = document.getElementById("chat-chain");
  var chainChip = document.getElementById("chat-chain-chip");
  var chainHint = document.getElementById("chat-chain-hint");
  var chainNote = document.getElementById("chat-chain-note");
  var chainAdd = document.getElementById("chat-chain-add");
  var chainSave = document.getElementById("chat-chain-save");

  var promptInput = document.getElementById("chat-prompt");
  var promptCount = document.getElementById("chat-prompt-count");
  var promptChip = document.getElementById("chat-prompt-chip");
  var promptNote = document.getElementById("chat-prompt-note");
  var promptSave = document.getElementById("chat-prompt-save");
  var safetyPrompt = document.getElementById("chat-safety-prompt");

  var providersEl = document.getElementById("chat-providers");
  var providerChip = document.getElementById("chat-provider-chip");
  var providerToggle = document.getElementById("chat-provider-toggle");
  var providerForm = document.getElementById("chat-provider-form");
  var providerId = document.getElementById("chat-provider-id");
  var providerType = document.getElementById("chat-provider-type");
  var providerLabel = document.getElementById("chat-provider-label");
  var providerUrl = document.getElementById("chat-provider-url");
  var providerKey = document.getElementById("chat-provider-key");
  var providerKeyHint = document.getElementById("chat-provider-key-hint");
  var providerCheckResult = document.getElementById("chat-provider-check-result");
  var providerNote = document.getElementById("chat-provider-note");
  var providerCheck = document.getElementById("chat-provider-check");
  var providerReset = document.getElementById("chat-provider-reset");
  var providerApply = document.getElementById("chat-provider-apply");
  var providerSave = document.getElementById("chat-provider-save");
  var providerSaveNote = document.getElementById("chat-provider-save-note");

  var cfg = null;
  var readable = false;
  var busy = false;
  var busyButton = null;
  var chain = [];
  var chainBase = [];
  var providers = [];
  var providersBase = [];
  var providerModels = {};
  var editId = "";
  var promptBase = "";
  var tryProviderId = "";
  var tryModelId = "";
  var tryCustomModel = false;

  function fmt(value) {
    var num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString("vi-VN") : "--";
  }

  function errorText(code) {
    if (!code) return "lỗi chưa xác định";
    if (ERROR_TEXT[code]) return ERROR_TEXT[code];
    if (/^chat_proxy_http_\d+$/.test(code)) return "chat-proxy báo lỗi " + code.slice(16);
    if (/^http_\d+$/.test(code)) return "chat-proxy báo lỗi " + code.slice(5);
    return String(code);
  }

  function node(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function makeOption(value, label) {
    var el = document.createElement("option");
    el.value = value;
    el.textContent = label;
    return el;
  }

  function cloneList(list) {
    return (Array.isArray(list) ? list : []).map(function (item) {
      return Object.assign({}, item);
    });
  }

  function plainChain(list) {
    return list.map(function (entry) {
      return { provider: entry.provider, modelId: entry.modelId };
    });
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

  function modelIds(models) {
    return (Array.isArray(models) ? models : [])
      .map(function (model) {
        if (typeof model === "string") return model;
        return model && typeof model.id === "string" ? model.id : "";
      })
      .filter(Boolean);
  }

  function maxChain() {
    return cfg && cfg.maxChain ? cfg.maxChain : CHAIN_MAX_FALLBACK;
  }

  function editable() {
    return readable && !busy;
  }

  function cfModels() {
    return cfg && Array.isArray(cfg.available) ? cfg.available : [];
  }

  function cfKeys() {
    return cfModels().map(function (model) {
      return model.key;
    });
  }

  function cfDefaultModel() {
    var keys = cfKeys();
    if (cfg && cfg.current && keys.indexOf(cfg.current) >= 0) return cfg.current;
    return keys.length ? keys[0] : "";
  }

  function presetLabel(type) {
    if (cfg && cfg.presets && cfg.presets[type] && cfg.presets[type].label) {
      return cfg.presets[type].label;
    }
    return type || "custom";
  }

  function modelState(id) {
    if (!providerModels[id]) {
      providerModels[id] = { status: "idle", list: [], error: "" };
    }
    return providerModels[id];
  }

  function loadModels(id, force) {
    if (!id || id === "cf") return;
    var state = modelState(id);
    if (!force && state.status !== "idle") return;
    state.status = "loading";
    state.error = "";
    renderChain();
    renderProviders();
    renderTry();

    call("/provider-models?id=" + encodeURIComponent(id))
      .then(function (res) {
        if (!res.ok || res.data.ok !== true) {
          state.status = "error";
          state.error = errorText(res.data && res.data.error);
          return;
        }
        state.list = modelIds(res.data.models);
        state.status = "ready";
      })
      .catch(function (err) {
        state.status = "error";
        state.error = (err && err.message) || "Không kết nối được máy chủ.";
      })
      .then(function () {
        renderChain();
        renderProviders();
        renderTry();
        updateUi();
      });
  }

  function ensureChainModels() {
    chain.forEach(function (entry) {
      if (entry.provider !== "cf") loadModels(entry.provider);
    });
  }

  function autoLoadModels() {
    providers.forEach(function (provider) {
      if (provider.enabled !== false) loadModels(provider.id);
    });
    ensureChainModels();
  }

  function chainDirty() {
    return JSON.stringify(plainChain(chain)) !== JSON.stringify(plainChain(chainBase));
  }

  function chainValid() {
    if (!chain.length || chain.length > maxChain()) return false;
    var keys = {};
    cfKeys().forEach(function (key) {
      keys[key] = true;
    });
    return chain.every(function (entry) {
      if (!entry.modelId) return false;
      if (entry.provider === "cf") return keys[entry.modelId] === true;
      return providers.some(function (provider) {
        return provider.id === entry.provider && provider.enabled !== false;
      });
    });
  }

  function promptDirty() {
    return promptInput.value !== promptBase;
  }

  function providersDirty() {
    return JSON.stringify(providers) !== JSON.stringify(providersBase);
  }

  function readProviderForm() {
    return {
      id: providerId.value.trim(),
      type: providerType.value || "custom",
      label: providerLabel.value.trim(),
      baseUrl: providerUrl.value.trim().replace(/\/+$/, ""),
      apiKey: providerKey.value.trim(),
      enabled: true
    };
  }

  function providerFormValid() {
    var form = readProviderForm();
    if (!PROVIDER_ID_RE.test(form.id)) return false;
    if (!/^https:\/\/.+/.test(form.baseUrl) || form.baseUrl.length > 200) return false;
    if (!form.apiKey || form.apiKey.length > 500) return false;
    if (!editId) {
      return !providers.some(function (provider) {
        return provider.id === form.id;
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

  function setChip(el, mode) {
    el.classList.toggle("is-dirty", mode === "dirty");
    el.classList.toggle("is-error", mode === "error");
    el.textContent =
      mode === "dirty"
        ? "Có thay đổi"
        : mode === "error"
          ? "Chưa đọc được"
          : "Đã lưu";
  }

  function updateChips() {
    if (!readable) {
      [chainChip, promptChip, providerChip].forEach(function (el) {
        setChip(el, "error");
      });
      return;
    }
    setChip(chainChip, chainDirty() ? "dirty" : "saved");
    setChip(promptChip, promptDirty() ? "dirty" : "saved");
    setChip(providerChip, providersDirty() ? "dirty" : "saved");
  }

  function updateChainHint() {
    if (!readable) {
      chainHint.textContent = "Chưa đọc được thứ tự dự phòng.";
      return;
    }
    if (!chain.length) {
      chainHint.textContent = "Cần ít nhất một bước. Bấm “Thêm bước” để chọn hãng và model.";
      return;
    }
    if (!chainValid()) {
      chainHint.textContent =
        "Có bước chưa xong: chọn model cho từng bước và bật lại hãng đang tắt.";
      return;
    }
    chainHint.textContent =
      "Bước 1 chạy trước, lỗi mới sang bước sau. Tối đa " + maxChain() + " bước.";
  }

  function setBusyLabels() {
    [chainSave, promptSave, providerSave].forEach(function (btn) {
      var loading = busy && busyButton === btn;
      btn.classList.toggle("is-loading", loading);
      var span = btn.querySelector("span");
      if (span) span.textContent = loading ? "Đang lưu…" : btn.getAttribute("data-label");
    });
  }

  function updateUi() {
    var can = editable();
    promptInput.disabled = !can;

    chainAdd.disabled = !can || chain.length >= maxChain();
    chainSave.disabled = !can || !chainDirty() || !chainValid();
    promptSave.disabled = !can || !promptDirty();
    providerSave.disabled = !can || !providersDirty();

    providerToggle.disabled = !can;
    providerId.disabled = !can || !!editId;
    providerType.disabled = !can;
    providerLabel.disabled = !can;
    providerUrl.disabled = !can;
    providerKey.disabled = !can;
    providerCheck.disabled = !can || !checkKeyValid();
    providerReset.disabled = !can;
    providerApply.disabled = !can || !providerFormValid();

    updateChips();
    updateChainHint();
    updateTryUi();
    setBusyLabels();
  }

  function testText(res) {
    if (!res.ok || res.data.ok !== true) {
      return { text: "Lỗi: " + errorText(res.data && res.data.error), kind: "error" };
    }
    var text = String(res.data.text || "").trim();
    // provider/model do chat-proxy trả về từ lần gọi thật, không phải giá trị gửi lên.
    var provider = String(res.data.provider || "");
    var route = [(provider === "cf" ? "Cloudflare" : provider), String(res.data.model || "")]
      .filter(Boolean)
      .join(":");
    return {
      text:
        (text ? text.slice(0, 200) : "(không có chữ trả về)") +
        (route ? " · " + route : "") +
        " · " +
        Math.round(Number(res.data.ms) || 0).toLocaleString("vi-VN") +
        " ms",
      kind: "ok"
    };
  }

  function tryProviders() {
    var list = [{ id: "cf", label: "Cloudflare" }];
    providers.forEach(function (provider) {
      if (provider.enabled === false) return;
      var saved = providersBase.some(function (item) {
        return item.id === provider.id;
      });
      if (saved) list.push({ id: provider.id, label: provider.label || provider.id });
    });
    return list;
  }

  function showTryFeedback(text, kind) {
    tryResult.hidden = false;
    tryResult.className = "chat-feedback" + (kind ? " is-" + kind : "");
    tryResult.textContent = text;
  }

  function clearTryFeedback() {
    tryResult.hidden = true;
    tryResult.className = "chat-feedback";
    tryResult.textContent = "";
  }

  function tryInput(className) {
    var input = document.createElement("input");
    input.className = "flag-input " + className;
    input.type = "text";
    input.maxLength = 200;
    input.value = tryModelId;
    input.placeholder = "Nhập mã model";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Mã model để thử");
    input.disabled = !editable();
    input.addEventListener("input", function () {
      tryModelId = input.value.trim();
      clearTryFeedback();
      updateTryUi();
    });
    return input;
  }

  function renderTryModel() {
    tryModelSlot.innerHTML = "";
    if (!tryProviderId) return;

    if (tryProviderId === "cf") {
      if (!tryModelId) tryModelId = cfDefaultModel();
      var cfSelect = document.createElement("select");
      cfSelect.className = "flag-input chat-try-model";
      cfSelect.setAttribute("aria-label", "Model để thử");
      cfModels().forEach(function (model) {
        cfSelect.appendChild(makeOption(model.key, modelOptionLabel(model)));
      });
      cfSelect.value = tryModelId;
      cfSelect.disabled = !editable();
      cfSelect.addEventListener("change", function () {
        tryModelId = cfSelect.value;
        clearTryFeedback();
        updateTryUi();
      });
      tryModelSlot.appendChild(cfSelect);
      return;
    }

    var state = modelState(tryProviderId);

    if (tryCustomModel) {
      tryModelSlot.appendChild(tryInput("chat-try-model-input"));
      var listBtn = node("button", "btn-ghost chat-mini-btn", "Danh sách");
      listBtn.type = "button";
      listBtn.disabled = !editable();
      listBtn.addEventListener("click", function () {
        tryCustomModel = false;
        if (!tryModelId && state.status === "ready" && state.list.length) {
          tryModelId = state.list[0];
        }
        renderTryModel();
        updateTryUi();
      });
      tryModelSlot.appendChild(listBtn);
      return;
    }

    if (state.status === "ready") {
      var list = state.list.slice();
      if (tryModelId && list.indexOf(tryModelId) < 0) list = list.concat([tryModelId]);
      if (!tryModelId && list.length) tryModelId = list[0];

      var select = document.createElement("select");
      select.className = "flag-input chat-try-model";
      select.setAttribute("aria-label", "Model để thử");
      list.forEach(function (key) {
        var label = state.list.indexOf(key) < 0 ? key + " (ngoài danh sách)" : key;
        select.appendChild(makeOption(key, label));
      });
      select.appendChild(makeOption(CUSTOM_MODEL, "Nhập mã model khác…"));
      select.value = tryModelId;
      select.disabled = !editable();
      select.addEventListener("change", function () {
        if (select.value === CUSTOM_MODEL) {
          tryCustomModel = true;
          tryModelId = "";
          clearTryFeedback();
          renderTryModel();
          updateTryUi();
          var box = tryModelSlot.querySelector(".chat-try-model-input");
          if (box) box.focus();
          return;
        }
        tryModelId = select.value;
        clearTryFeedback();
        updateTryUi();
      });
      tryModelSlot.appendChild(select);
      return;
    }

    if (state.status === "error") {
      tryModelSlot.appendChild(tryInput("chat-try-model-input"));
      var retryBtn = node("button", "btn-ghost chat-mini-btn", "Tải lại");
      retryBtn.type = "button";
      retryBtn.disabled = !editable();
      retryBtn.addEventListener("click", function () {
        loadModels(tryProviderId, true);
      });
      tryModelSlot.appendChild(retryBtn);
      tryModelSlot.appendChild(
        node(
          "span",
          "chat-help",
          "Không tải được danh sách model — nhập mã model hoặc bấm Tải lại."
        )
      );
      return;
    }

    var loading = document.createElement("select");
    loading.className = "flag-input chat-try-model";
    loading.setAttribute("aria-label", "Model để thử");
    loading.setAttribute("data-locked", "1");
    loading.disabled = true;
    loading.appendChild(makeOption("", "Đang tải model…"));
    tryModelSlot.appendChild(loading);
  }

  function updateTryUi() {
    var can = editable();
    tryBlock.hidden = !readable;
    tryProvider.disabled = !can;
    tryRun.disabled = !can || !tryModelId;
    Array.prototype.forEach.call(
      tryModelSlot.querySelectorAll(".flag-input, .chat-mini-btn"),
      function (field) {
        field.disabled = !can || field.getAttribute("data-locked") === "1";
      }
    );
  }

  function renderTry() {
    var list = tryProviders();
    if (!readable || !list.length) {
      tryBlock.hidden = true;
      tryProviderId = "";
      tryModelId = "";
      tryCustomModel = false;
      tryModelSlot.innerHTML = "";
      clearTryFeedback();
      return;
    }

    var stillThere = list.some(function (provider) {
      return provider.id === tryProviderId;
    });
    if (!stillThere) {
      tryProviderId = list[0].id;
      tryModelId = "";
      tryCustomModel = false;
      clearTryFeedback();
    }

    tryProvider.innerHTML = "";
    list.forEach(function (provider) {
      tryProvider.appendChild(makeOption(provider.id, provider.label || provider.id));
    });
    tryProvider.value = tryProviderId;

    if (tryProviderId !== "cf" && modelState(tryProviderId).status === "idle") {
      loadModels(tryProviderId);
    }
    renderTryModel();
    updateTryUi();
  }

  function runTry() {
    if (busy || !readable || !tryProviderId || !tryModelId) return;
    var provider = tryProviderId;
    var modelId = tryModelId;
    busy = true;
    busyButton = null;
    updateUi();
    showTryFeedback("Đang thử " + modelId + "…", "");
    call("/test", { method: "POST", body: { provider: provider, modelId: modelId } })
      .then(function (res) {
        var out = testText(res);
        showTryFeedback(out.text, out.kind);
      })
      .catch(function (err) {
        showTryFeedback((err && err.message) || "Không kết nối được máy chủ.", "error");
      })
      .then(function () {
        busy = false;
        updateUi();
      });
  }

  function chainProviderOptions() {
    var list = [{ id: "cf", label: "Cloudflare" }];
    providers.forEach(function (provider) {
      list.push({
        id: provider.id,
        label:
          (provider.label || provider.id) + (provider.enabled === false ? " (đang tắt)" : "")
      });
    });
    return list;
  }

  function modelOptionLabel(model) {
    return model.label ? model.label + " (" + model.key + ")" : model.key;
  }

  function buildModelControl(entry, index) {
    var wrap = node("div", "chat-model-control");

    function customInput(retry) {
      var input = document.createElement("input");
      input.className = "flag-input chat-step-model-input";
      input.type = "text";
      input.maxLength = 200;
      input.value = entry.modelId;
      input.placeholder = "Nhập mã model";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.setAttribute("aria-label", "Mã model cho bước " + (index + 1));
      input.disabled = !editable();
      input.addEventListener("input", function () {
        entry.modelId = input.value.trim();
        entry.testText = "";
        updateUi();
      });
      wrap.appendChild(input);

      if (retry) {
        var retryBtn = node("button", "btn-ghost chat-mini-btn", "Tải lại");
        retryBtn.type = "button";
        retryBtn.disabled = !editable();
        retryBtn.addEventListener("click", function () {
          loadModels(entry.provider, true);
        });
        wrap.appendChild(retryBtn);
        wrap.appendChild(
          node(
            "span",
            "chat-help",
            "Không tải được danh sách model — nhập mã model hoặc bấm Tải lại."
          )
        );
        return wrap;
      }

      var listBtn = node("button", "btn-ghost chat-mini-btn", "Danh sách");
      listBtn.type = "button";
      listBtn.disabled = !editable();
      listBtn.addEventListener("click", function () {
        entry.customModel = false;
        if (!entry.modelId) {
          var state = modelState(entry.provider);
          if (state.status === "ready" && state.list.length) entry.modelId = state.list[0];
        }
        renderChain();
        updateUi();
      });
      wrap.appendChild(listBtn);
      return wrap;
    }

    if (entry.provider === "cf") {
      if (!entry.modelId) {
        var cfList = cfKeys();
        if (cfList.length) entry.modelId = cfList[0];
      }
      var cfSelect = document.createElement("select");
      cfSelect.className = "flag-input chat-step-model";
      cfSelect.setAttribute("aria-label", "Model cho bước " + (index + 1));
      cfModels().forEach(function (model) {
        cfSelect.appendChild(makeOption(model.key, modelOptionLabel(model)));
      });
      if (entry.modelId && cfKeys().indexOf(entry.modelId) < 0) {
        cfSelect.appendChild(
          makeOption(entry.modelId, entry.modelId + " (không có trong danh sách)")
        );
      }
      cfSelect.value = entry.modelId;
      cfSelect.disabled = !editable();
      cfSelect.addEventListener("change", function () {
        entry.modelId = cfSelect.value;
        entry.testText = "";
        updateUi();
      });
      wrap.appendChild(cfSelect);
      return wrap;
    }

    var state = modelState(entry.provider);
    if (entry.customModel) return customInput(false);

    if (state.status === "ready") {
      var list = state.list.slice();
      if (entry.modelId && list.indexOf(entry.modelId) < 0) {
        list = list.concat([entry.modelId]);
      }
      if (!entry.modelId && list.length) entry.modelId = list[0];

      var select = document.createElement("select");
      select.className = "flag-input chat-step-model";
      select.setAttribute("aria-label", "Model cho bước " + (index + 1));
      list.forEach(function (key) {
        var label = state.list.indexOf(key) < 0 ? key + " (ngoài danh sách)" : key;
        select.appendChild(makeOption(key, label));
      });
      select.appendChild(makeOption(CUSTOM_MODEL, "Nhập mã model khác…"));
      select.value = entry.modelId;
      select.disabled = !editable();
      select.addEventListener("change", function () {
        if (select.value === CUSTOM_MODEL) {
          entry.customModel = true;
          entry.modelId = "";
          entry.testText = "";
          renderChain();
          updateUi();
          var rows = chainEl.querySelectorAll(".chat-step-row");
          var input = rows[index] && rows[index].querySelector(".chat-step-model-input");
          if (input) input.focus();
          return;
        }
        entry.modelId = select.value;
        entry.testText = "";
        updateUi();
      });
      wrap.appendChild(select);
      return wrap;
    }

    if (state.status === "error") return customInput(true);

    var loading = document.createElement("select");
    loading.className = "flag-input chat-step-model";
    loading.setAttribute("aria-label", "Model cho bước " + (index + 1));
    loading.disabled = true;
    loading.appendChild(makeOption("", "Đang tải model…"));
    wrap.appendChild(loading);
    return wrap;
  }

  function changeProvider(entry, value, index) {
    entry.provider = value;
    entry.customModel = false;
    entry.testText = "";
    entry.testKind = "";
    if (value === "cf") {
      entry.modelId = cfDefaultModel();
    } else {
      var state = modelState(value);
      entry.modelId = state.status === "ready" && state.list.length ? state.list[0] : "";
      loadModels(value);
    }
    renderChain();
    updateUi();
    var rows = chainEl.querySelectorAll(".chat-step-row");
    var providerSelect = rows[index] && rows[index].querySelector(".chat-step-provider");
    if (providerSelect) providerSelect.focus();
  }

  function buildStepRow(entry, index) {
    var row = node("div", "chat-step-row");
    row.appendChild(node("span", "chat-step-index", String(index + 1)));

    var fields = node("div", "chat-step-fields");

    var providerField = node("div", "chat-step-field");
    providerField.appendChild(node("span", "chat-step-label", "Hãng"));
    var providerSelect = document.createElement("select");
    providerSelect.className = "flag-input chat-step-provider";
    providerSelect.setAttribute("aria-label", "Hãng cho bước " + (index + 1));
    var options = chainProviderOptions();
    options.forEach(function (option) {
      providerSelect.appendChild(makeOption(option.id, option.label));
    });
    if (
      !options.some(function (option) {
        return option.id === entry.provider;
      })
    ) {
      providerSelect.appendChild(
        makeOption(entry.provider, entry.provider + " (không còn)")
      );
    }
    providerSelect.value = entry.provider;
    providerSelect.disabled = !editable();
    providerSelect.addEventListener("change", function () {
      changeProvider(entry, providerSelect.value, index);
    });
    providerField.appendChild(providerSelect);

    var modelField = node("div", "chat-step-field");
    modelField.appendChild(node("span", "chat-step-label", "Model"));
    modelField.appendChild(buildModelControl(entry, index));

    fields.appendChild(providerField);
    fields.appendChild(modelField);

    var actions = node("div", "chat-step-actions");
    var testBtn = node("button", "btn-ghost chat-mini-btn", "Thử");
    testBtn.type = "button";
    testBtn.disabled = !editable() || !entry.modelId;
    testBtn.addEventListener("click", function () {
      runEntryTest(entry);
    });
    actions.appendChild(testBtn);

    var upBtn = node("button", "btn-ghost chat-mini-btn chat-icon-btn", "↑");
    upBtn.type = "button";
    upBtn.title = "Đưa lên trước";
    upBtn.setAttribute("aria-label", "Đưa bước " + (index + 1) + " lên trước");
    upBtn.disabled = !editable() || index === 0;
    upBtn.addEventListener("click", function () {
      moveChain(index, -1);
    });
    actions.appendChild(upBtn);

    var downBtn = node("button", "btn-ghost chat-mini-btn chat-icon-btn", "↓");
    downBtn.type = "button";
    downBtn.title = "Đưa xuống sau";
    downBtn.setAttribute("aria-label", "Đưa bước " + (index + 1) + " xuống sau");
    downBtn.disabled = !editable() || index === chain.length - 1;
    downBtn.addEventListener("click", function () {
      moveChain(index, 1);
    });
    actions.appendChild(downBtn);

    var removeBtn = node("button", "btn-ghost chat-mini-btn chat-icon-btn is-danger", "✕");
    removeBtn.type = "button";
    removeBtn.title = "Bỏ bước này";
    removeBtn.setAttribute("aria-label", "Bỏ bước " + (index + 1));
    removeBtn.disabled = !editable();
    removeBtn.addEventListener("click", function () {
      chain.splice(index, 1);
      renderChain();
      updateUi();
    });
    actions.appendChild(removeBtn);

    row.appendChild(fields);
    row.appendChild(actions);

    if (entry.testText) {
      row.appendChild(
        node(
          "p",
          "chat-feedback" + (entry.testKind ? " is-" + entry.testKind : ""),
          entry.testText
        )
      );
    }

    return row;
  }

  function renderChain() {
    var active = document.activeElement;
    var keepFocus = active && chainEl.contains(active) ? active.getAttribute("aria-label") : "";
    var caret = keepFocus && typeof active.selectionStart === "number" ? active.selectionStart : null;

    chainEl.innerHTML = "";
    if (!chain.length) {
      chainEl.appendChild(
        node("p", "chat-empty", "Chưa có bước nào. Bấm “Thêm bước” để chọn hãng và model.")
      );
    }
    chain.forEach(function (entry, index) {
      chainEl.appendChild(buildStepRow(entry, index));
    });
    ensureChainModels();

    if (keepFocus) {
      var target = chainEl.querySelector('[aria-label="' + keepFocus + '"]');
      if (target && !target.disabled) {
        target.focus();
        if (caret !== null && typeof target.setSelectionRange === "function") {
          try {
            target.setSelectionRange(caret, caret);
          } catch (err) {
            // select không hỗ trợ caret, bỏ qua
          }
        }
      }
    }
  }

  function moveChain(index, delta) {
    var next = index + delta;
    if (next < 0 || next >= chain.length) return;
    var item = chain[index];
    chain[index] = chain[next];
    chain[next] = item;
    renderChain();
    updateUi();
  }

  function addChain() {
    if (!editable() || chain.length >= maxChain()) return;
    var firstProvider = providers.filter(function (provider) {
      return provider.enabled !== false;
    })[0];
    var provider = firstProvider ? firstProvider.id : "cf";
    var state = provider === "cf" ? null : modelState(provider);
    var modelId =
      provider === "cf"
        ? cfDefaultModel()
        : state && state.status === "ready" && state.list.length
          ? state.list[0]
          : "";
    chain.push({
      provider: provider,
      modelId: modelId,
      customModel: false,
      testText: "",
      testKind: ""
    });
    if (provider !== "cf") loadModels(provider);
    renderChain();
    updateUi();
  }

  function runEntryTest(entry) {
    if (busy || !entry.modelId) return;
    entry.testText = "Đang thử " + entry.modelId + "…";
    entry.testKind = "";
    busy = true;
    busyButton = null;
    renderChain();
    updateUi();
    call("/test", { method: "POST", body: { provider: entry.provider, modelId: entry.modelId } })
      .then(function (res) {
        var out = testText(res);
        entry.testText = out.text;
        entry.testKind = out.kind;
      })
      .catch(function (err) {
        entry.testText = (err && err.message) || "Không kết nối được máy chủ.";
        entry.testKind = "error";
      })
      .then(function () {
        busy = false;
        renderChain();
        updateUi();
      });
  }

  function buildProviderStatus(provider) {
    var status = node("div", "chat-provider-status");
    if (provider.enabled === false) {
      status.textContent = "Đang tắt — không dùng để trả lời.";
      return status;
    }
    var state = modelState(provider.id);
    if (state.status === "ready") {
      status.textContent = fmt(state.list.length) + " model đã tải.";
    } else if (state.status === "loading") {
      status.textContent = "Đang tải danh sách model…";
    } else if (state.status === "error") {
      status.classList.add("is-error");
      status.textContent = "Không tải được model: " + state.error;
    } else {
      status.textContent = "Chưa tải danh sách model.";
    }
    if (state.status === "error" || state.status === "ready") {
      var retry = node(
        "button",
        "chat-link-btn",
        state.status === "error" ? "Tải lại" : "Làm mới"
      );
      retry.type = "button";
      retry.disabled = !editable();
      retry.addEventListener("click", function () {
        loadModels(provider.id, true);
      });
      status.appendChild(retry);
    }
    return status;
  }

  function renderProviders() {
    providersEl.innerHTML = "";
    if (!providers.length) {
      providersEl.appendChild(
        node(
          "p",
          "chat-empty",
          "Chưa có nhà cung cấp nào. Cloudflare vẫn trả lời được nếu chỉ dùng một hãng."
        )
      );
      return;
    }

    providers.forEach(function (provider) {
      var row = node("div", "chat-provider-row" + (provider.enabled === false ? " is-off" : ""));
      var info = node("div", "chat-provider-info");

      var title = node("div", "chat-provider-title");
      title.appendChild(node("span", "chat-provider-name", provider.label || provider.id));
      title.appendChild(node("span", "chat-provider-id", provider.id));

      info.appendChild(title);
      info.appendChild(
        node(
          "div",
          "chat-provider-meta",
          presetLabel(provider.type) +
            " · " +
            provider.baseUrl +
            " · " +
            (provider.apiKey ? "đã có key" : "chưa có key")
        )
      );
      info.appendChild(buildProviderStatus(provider));

      var actions = node("div", "chat-provider-actions");

      var switchLabel = node("label", "chat-mini-switch");
      switchLabel.title = provider.enabled === false ? "Đang tắt" : "Đang bật";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = provider.enabled !== false;
      checkbox.disabled = !editable();
      checkbox.setAttribute("aria-label", "Bật hoặc tắt hãng " + (provider.label || provider.id));
      checkbox.addEventListener("change", function () {
        provider.enabled = checkbox.checked;
        if (checkbox.checked) loadModels(provider.id);
        renderProviders();
        renderTry();
        updateUi();
      });
      switchLabel.appendChild(checkbox);
      switchLabel.appendChild(node("span", "switch-track"));
      actions.appendChild(switchLabel);

      var editBtn = node("button", "btn-ghost chat-mini-btn", "Sửa");
      editBtn.type = "button";
      editBtn.disabled = !editable();
      editBtn.addEventListener("click", function () {
        openProviderForm(provider);
      });
      actions.appendChild(editBtn);

      var removeBtn = node("button", "btn-ghost chat-mini-btn is-danger", "Xóa");
      removeBtn.type = "button";
      removeBtn.disabled = !editable();
      removeBtn.addEventListener("click", function () {
        removeProvider(provider.id);
      });
      actions.appendChild(removeBtn);

      row.appendChild(info);
      row.appendChild(actions);
      providersEl.appendChild(row);
    });
  }

  function resetProviderForm() {
    editId = "";
    providerId.value = "";
    providerLabel.value = "";
    providerUrl.value = "";
    providerKey.value = "";
    providerKeyHint.textContent = "Key chỉ gửi lên máy chủ, không lưu trong trình duyệt.";
    if (providerType.options.length) {
      providerType.value = providerType.options[0].value;
      var preset = cfg && cfg.presets ? cfg.presets[providerType.value] : null;
      if (preset && preset.baseUrl) providerUrl.value = preset.baseUrl;
    }
    providerApply.textContent = "Thêm vào danh sách";
    providerCheckResult.hidden = true;
    providerCheckResult.textContent = "";
    providerNote.textContent = "Điền thông tin rồi thêm vào danh sách nháp.";
  }

  function openProviderForm(provider) {
    if (!editable()) return;
    resetProviderForm();
    if (provider) {
      editId = provider.id;
      providerId.value = provider.id;
      providerType.value = provider.type || "custom";
      providerLabel.value = provider.label || "";
      providerUrl.value = provider.baseUrl || "";
      providerKey.value = provider.apiKey || "";
      providerKeyHint.textContent = provider.apiKey
        ? "Đang giữ key đã lưu. Xóa ô rồi dán key mới nếu muốn đổi."
        : "Chưa có key đã lưu, dán key của hãng vào đây.";
      providerApply.textContent = "Cập nhật trong danh sách";
      providerNote.textContent =
        "Đang sửa “" + (provider.label || provider.id) + "”. Bấm cập nhật để đưa vào danh sách nháp.";
    }
    providerForm.hidden = false;
    providerToggle.hidden = true;
    updateUi();
    var focusTarget = provider ? providerLabel : providerId;
    focusTarget.focus();
  }

  function closeProviderForm() {
    providerForm.hidden = true;
    providerToggle.hidden = false;
    resetProviderForm();
    updateUi();
  }

  function applyProvider() {
    if (!editable() || !providerFormValid()) {
      providerNote.textContent = "Kiểm tra mã, địa chỉ https và key trước khi thêm.";
      return;
    }
    var entry = readProviderForm();
    entry.label = entry.label || entry.id;
    if (editId) {
      providers = providers.map(function (provider) {
        if (provider.id !== editId) return provider;
        return Object.assign({}, provider, {
          type: entry.type,
          label: entry.label,
          baseUrl: entry.baseUrl,
          apiKey: entry.apiKey
        });
      });
      delete providerModels[editId];
    } else {
      if (providers.length >= PROVIDERS_MAX) {
        providerNote.textContent = "Tối đa " + PROVIDERS_MAX + " nhà cung cấp.";
        return;
      }
      providers.push(entry);
    }
    closeProviderForm();
    renderProviders();
    renderTry();
    providerSaveNote.textContent =
      "Đã cập nhật danh sách nháp. Bấm “Lưu nhà cung cấp” để áp dụng.";
    updateUi();
  }

  function removeProvider(id) {
    var usedInChain = chain.some(function (entry) {
      return entry.provider === id;
    });
    if (usedInChain) {
      providerSaveNote.textContent =
        "Bỏ bước “" + id + "” khỏi thứ tự dự phòng trước khi xóa nhà cung cấp.";
      return;
    }
    if (
      !window.confirm(
        "Xóa nhà cung cấp “" +
          id +
          "” khỏi danh sách nháp?\n\nChưa áp dụng tới khi bấm “Lưu nhà cung cấp”."
      )
    ) {
      return;
    }
    providers = providers.filter(function (provider) {
      return provider.id !== id;
    });
    delete providerModels[id];
    if (editId === id) closeProviderForm();
    renderProviders();
    renderTry();
    providerSaveNote.textContent =
      "Đã bỏ “" + id + "” khỏi danh sách nháp. Bấm “Lưu nhà cung cấp” để áp dụng.";
    updateUi();
  }

  function checkProviderKey() {
    if (!editable() || !checkKeyValid()) {
      providerNote.textContent =
        "Cần địa chỉ https và key thật (không phải key đã che) để kiểm tra.";
      return;
    }
    var form = readProviderForm();
    busy = true;
    busyButton = null;
    updateUi();
    providerNote.textContent = "Đang kiểm tra key…";
    providerCheckResult.hidden = true;
    call("/check-key", { method: "POST", body: form })
      .then(function (res) {
        if (!res.ok || res.data.ok !== true) {
          providerNote.textContent =
            "Key chưa dùng được: " + errorText(res.data && res.data.error) + ".";
          return;
        }
        var models = modelIds(res.data.models);
        providerCheckResult.hidden = false;
        providerCheckResult.className = "chat-feedback is-ok";
        providerCheckResult.textContent =
          "Key dùng được, thấy " +
          fmt(res.data.count || models.length) +
          " model" +
          (models.length
            ? ": " + models.slice(0, 12).join(", ") + (models.length > 12 ? "…" : "")
            : ".");
        providerNote.textContent =
          "Chưa lưu gì. Kiểm tra xong thì bấm “Thêm vào danh sách”.";
      })
      .catch(function (err) {
        providerNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
      })
      .then(function () {
        busy = false;
        updateUi();
      });
  }

  function postConfig(kind, payload) {
    return call("/config", {
      method: "POST",
      body: Object.assign({ kind: kind }, payload)
    }).then(function (res) {
      if (!res.ok || res.data.ok !== true) {
        return { ok: false, error: res.data && res.data.error };
      }
      return { ok: true };
    });
  }

  function setDefaultNotes() {
    modelNote.textContent = "Chỉ thử, không lưu. Model trả lời thật đặt ở mục 2.";
    chainNote.textContent =
      "Bước 1 chạy trước, lỗi mới xuống bước sau. Thay đổi chỉ áp dụng sau khi bấm “Lưu thứ tự”.";
    promptNote.textContent = "Câu lệnh áp dụng cho mọi câu trả lời của trợ lý.";
    providerSaveNote.textContent = "Sửa danh sách xong bấm “Lưu nhà cung cấp” để áp dụng.";
  }

  function renderPresets(config) {
    var presets = config.presets && typeof config.presets === "object" ? config.presets : {};
    providerType.innerHTML = "";
    Object.keys(presets).forEach(function (key) {
      providerType.appendChild(makeOption(key, presets[key].label || key));
    });
    if (!presets.custom) {
      providerType.appendChild(makeOption("custom", "Tự nhập địa chỉ"));
    }
  }

  function renderConfig(config) {
    cfg = config;
    readable = true;

    renderPresets(config);

    chain = cloneList(config.chain).map(function (entry) {
      return {
        provider: entry.provider,
        modelId: entry.modelId,
        customModel: false,
        testText: "",
        testKind: ""
      };
    });
    chainBase = cloneList(config.chain);

    providers = cloneList(config.providers);
    providersBase = cloneList(config.providers);

    promptBase = typeof config.prompt === "string" ? config.prompt : "";
    promptInput.value = promptBase;
    promptCount.textContent = String(promptBase.length);
    safetyPrompt.textContent =
      typeof config.safetyPrompt === "string" && config.safetyPrompt
        ? config.safetyPrompt
        : "Chưa đọc được quy tắc an toàn.";

    closeProviderForm();
    renderChain();
    renderProviders();
    renderTry();
    updateUi();
  }

  function loadConfig(silent) {
    if (!silent) stateEl.textContent = "Đang đọc…";
    return call("/config")
      .then(function (res) {
        if (!res.ok || res.data.ok !== true || !res.data.config) {
          readable = false;
          panel.classList.add("is-degraded");
          stateEl.textContent = "Không đọc được";
          var reason = errorText(res.data && res.data.error);
          modelNote.textContent = "Không đọc được cấu hình chat: " + reason + ".";
          chainNote.textContent = "Chưa đọc được thứ tự dự phòng.";
          promptNote.textContent = "Chưa đọc được câu lệnh hệ thống.";
          safetyPrompt.textContent = "Chưa đọc được quy tắc an toàn.";
          providerSaveNote.textContent = "Chưa đọc được danh sách nhà cung cấp.";
          updateUi();
          return false;
        }
        renderConfig(res.data.config);
        panel.classList.remove("is-degraded");
        stateEl.textContent = "Đang dùng cấu hình đã lưu";
        setDefaultNotes();
        updateUi();
        autoLoadModels();
        return true;
      })
      .catch(function (err) {
        readable = false;
        panel.classList.add("is-degraded");
        stateEl.textContent = "Không kết nối được";
        modelNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        chainNote.textContent = "Chưa đọc được thứ tự dự phòng.";
        promptNote.textContent = "Chưa đọc được câu lệnh hệ thống.";
        safetyPrompt.textContent = "Chưa đọc được quy tắc an toàn.";
        providerSaveNote.textContent = "Chưa đọc được danh sách nhà cung cấp.";
        updateUi();
        return false;
      });
  }

  function reloadConfig() {
    return loadConfig(true).then(function (ok) {
      busy = false;
      busyButton = null;
      updateUi();
      return ok;
    });
  }

  function saveChain() {
    if (busy || !readable || !chainDirty() || !chainValid()) return;
    var lines = ["Lưu thứ tự dự phòng?"];
    chain.forEach(function (entry, index) {
      lines.push(index + 1 + ". " + entry.provider + " · " + entry.modelId);
    });
    if (!window.confirm(lines.join("\n"))) return;

    busy = true;
    busyButton = chainSave;
    updateUi();
    chainNote.textContent = "Đang lưu…";
    postConfig("chain", { chain: plainChain(chain) })
      .then(function (res) {
        if (!res.ok) {
          busy = false;
          busyButton = null;
          chainNote.textContent = "Không lưu được: " + errorText(res.error) + ".";
          updateUi();
          return;
        }
        return reloadConfig().then(function () {
          chainNote.textContent = "Đã lưu thứ tự. Chờ khoảng 60 giây để chat-proxy áp dụng.";
        });
      })
      .catch(function (err) {
        busy = false;
        busyButton = null;
        chainNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        updateUi();
      });
  }

  function savePrompt() {
    if (busy || !readable || !promptDirty()) return;
    var prompt = promptInput.value;
    if (!prompt.trim()) {
      promptNote.textContent = "Câu lệnh không được để trống.";
      promptInput.focus();
      return;
    }
    if (prompt.length > PROMPT_MAX) {
      promptNote.textContent = "Câu lệnh tối đa " + PROMPT_MAX + " ký tự.";
      return;
    }
    if (!window.confirm("Lưu câu lệnh hệ thống mới? (" + prompt.length + " ký tự)")) return;

    busy = true;
    busyButton = promptSave;
    updateUi();
    promptNote.textContent = "Đang lưu…";
    postConfig("prompt", { prompt: prompt })
      .then(function (res) {
        if (!res.ok) {
          busy = false;
          busyButton = null;
          promptNote.textContent = "Không lưu được: " + errorText(res.error) + ".";
          updateUi();
          return;
        }
        return reloadConfig().then(function () {
          promptNote.textContent = "Đã lưu câu lệnh. Chờ khoảng 60 giây để chat-proxy áp dụng.";
        });
      })
      .catch(function (err) {
        busy = false;
        busyButton = null;
        promptNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        updateUi();
      });
  }

  function saveProviders() {
    if (busy || !readable || !providersDirty()) return;
    var seen = {};
    for (var i = 0; i < providers.length; i += 1) {
      var provider = providers[i];
      if (!PROVIDER_ID_RE.test(provider.id) || seen[provider.id]) {
        providerSaveNote.textContent =
          "Mã nhà cung cấp “" + provider.id + "” không hợp lệ hoặc bị trùng.";
        return;
      }
      seen[provider.id] = true;
      if (!/^https:\/\/.+/.test(provider.baseUrl)) {
        providerSaveNote.textContent =
          "Địa chỉ của “" + provider.id + "” phải bắt đầu bằng https://";
        return;
      }
      if (!provider.apiKey) {
        providerSaveNote.textContent = "“" + provider.id + "” chưa có API key.";
        return;
      }
    }
    if (
      !window.confirm(
        "Lưu danh sách " +
          providers.length +
          " nhà cung cấp?\n\nKey đã che sẽ giữ nguyên key cũ trên máy chủ."
      )
    ) {
      return;
    }

    busy = true;
    busyButton = providerSave;
    updateUi();
    providerSaveNote.textContent = "Đang lưu…";
    var payload = providers.map(function (provider) {
      return {
        id: provider.id,
        type: provider.type,
        label: provider.label,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        enabled: provider.enabled !== false
      };
    });
    postConfig("providers", { providers: payload })
      .then(function (res) {
        if (!res.ok) {
          busy = false;
          busyButton = null;
          providerSaveNote.textContent = "Không lưu được: " + errorText(res.error) + ".";
          updateUi();
          return;
        }
        providerModels = {};
        return reloadConfig().then(function () {
          providerSaveNote.textContent =
            "Đã lưu danh sách. Chờ khoảng 60 giây để chat-proxy áp dụng.";
        });
      })
      .catch(function (err) {
        busy = false;
        busyButton = null;
        providerSaveNote.textContent = (err && err.message) || "Không kết nối được máy chủ.";
        updateUi();
      });
  }

  tryProvider.addEventListener("change", function () {
    tryProviderId = tryProvider.value;
    tryModelId = "";
    tryCustomModel = false;
    clearTryFeedback();
    if (tryProviderId !== "cf" && modelState(tryProviderId).status === "idle") {
      loadModels(tryProviderId);
    }
    renderTryModel();
    updateTryUi();
  });
  tryRun.addEventListener("click", runTry);

  chainAdd.addEventListener("click", addChain);
  chainSave.addEventListener("click", saveChain);

  promptInput.addEventListener("input", function () {
    promptCount.textContent = String(promptInput.value.length);
    updateUi();
  });
  promptSave.addEventListener("click", savePrompt);

  providerToggle.addEventListener("click", function () {
    openProviderForm(null);
  });
  providerReset.addEventListener("click", closeProviderForm);
  providerApply.addEventListener("click", applyProvider);
  providerCheck.addEventListener("click", checkProviderKey);
  providerSave.addEventListener("click", saveProviders);

  providerType.addEventListener("change", function () {
    var preset = cfg && cfg.presets ? cfg.presets[providerType.value] : null;
    if (preset && preset.baseUrl) providerUrl.value = preset.baseUrl;
    updateUi();
  });
  providerKey.addEventListener("input", function () {
    if (editId && providerKey.value.trim().indexOf("***") === 0) {
      providerKeyHint.textContent =
        "Đang giữ key đã lưu. Xóa ô rồi dán key mới nếu muốn đổi.";
    } else if (editId) {
      providerKeyHint.textContent = "Key mới sẽ thay key cũ khi bấm cập nhật.";
    } else {
      providerKeyHint.textContent = "Key chỉ gửi lên máy chủ, không lưu trong trình duyệt.";
    }
    updateUi();
  });
  [providerId, providerLabel, providerUrl].forEach(function (el) {
    el.addEventListener("input", updateUi);
  });

  updateUi();
  loadConfig();
})();
