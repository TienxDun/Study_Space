/* Chạy trước hydration: ẩn lớp Splash tĩnh trong HTML khi phiên này đã xem Splash rồi. */
try {
  // Bật tràn viền sớm nhất có thể: nếu chờ React gọi thì WebView cao thêm một dải
  // thanh trạng thái sau khi trang đã vẽ, mọi nội dung đang giữa màn hình bị đẩy lệch.
  var cap = window.Capacitor;
  if (cap && cap.Plugins && cap.Plugins.StatusBar) {
    cap.Plugins.StatusBar.setOverlaysWebView({ overlay: true });
  }

  var addRule = function (css) {
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      try {
        var rules = sheets[i].cssRules;
        sheets[i].insertRule(css, rules.length);
        return true;
      } catch (e) {}
    }
    return false;
  };

  var KEY = "zenstudy_mobile_splash_completed";
  var q = new URLSearchParams(window.location.search);
  var preview =
    q.get("splash") === "preview" ||
    q.get("splash") === "true" ||
    q.get("splash") === "1" ||
    q.get("preview") === "splash";
  var shown = !window.sessionStorage.getItem(KEY) || preview;
  if (!shown) {
    var hide = function () {
      if (addRule("#pre-splash{display:none}")) return true;
      var el = document.getElementById("pre-splash");
      if (!el) return false;
      el.style.display = "none";
      return true;
    };
    if (!hide()) {
      var hideWatch = function () {
        if (!hide()) requestAnimationFrame(hideWatch);
      };
      requestAnimationFrame(hideWatch);
    }
  } else {
    // WebView có thể cao thêm một dải (vùng thanh trạng thái) ngay sau khung hình đầu.
    // Chỉ hiện nội dung splash khi chiều cao khung nhìn đứng yên, nếu không logo bị đẩy
    // xuống giữa chừng, người dùng thấy logo "nhảy" trong khoảnh khắc đầu.
    var revealed = false;
    var reveal = function () {
      if (revealed) return;
      revealed = true;
      // Không thêm/sửa nút DOM (kể cả thuộc tính <html> hay thẻ <style>) vì React so
      // khớp với HTML máy chủ và sẽ lỗi hydrate (#418), dựng lại cả cây. Chèn thẳng
      // quy tắc vào stylesheet đã có bằng CSSOM.
      if (!addRule("#pre-splash .ps-body{opacity:1}")) {
        var body = document.querySelector("#pre-splash .ps-body");
        if (body) body.style.opacity = "1";
      }
      window.__zenSplashStable = true;
    };
    // Chỉ hiện nội dung khi chiều cao khung nhìn đứng yên, tránh logo bị đẩy lệch nếu
    // WebView còn đổi kích thước sau khung hình đầu. Quá 1500ms thì hiện để không treo.
    var lastH = -1;
    var stableSince = 0;
    var startedAt = performance.now();
    var watch = function (now) {
      if (window.innerHeight !== lastH) {
        lastH = window.innerHeight;
        stableSince = now;
      }
      if (now - stableSince > 120 || now - startedAt > 1500) {
        reveal();
        return;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  }
} catch (e) {}
