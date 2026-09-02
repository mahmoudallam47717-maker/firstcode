(function () {
  "use strict";
  var TF = window.TF = window.TF || {};

  var region = null;

  function ensureRegion() {
    if (!region) region = document.getElementById("toast-region");
    return region;
  }

  function show(message, type) {
    var el = document.createElement("div");
    el.className = "toast toast-" + (type || "");
    el.setAttribute("role", "status");
    el.textContent = message;
    var box = ensureRegion();
    if (!box) return;
    box.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity .3s";
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, 3400);
  }

  TF.Notify = {
    success: function (msg) { show(msg, "success"); },
    error: function (msg) { show(msg, "error"); },
    info: function (msg) { show(msg, ""); }
  };
})();