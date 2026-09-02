(function (global) {
  "use strict";

  var TF = global.TF = global.TF || {};

  var Utils = {
    uid: function () {
      if (global.crypto && typeof global.crypto.randomUUID === "function") {
        return global.crypto.randomUUID();
      }
      return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
    },

    nowISO: function () {
      return new Date().toISOString();
    },

    todayISO: function () {
      return dateToISODate(new Date());
    },

    formatDate: function (iso) {
      if (!iso) return "";
      var d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
    },

    isOverdue: function (dueISO) {
      if (!dueISO) return false;
      var due = new Date(dueISO.length <= 10 ? dueISO + "T00:00:00" : dueISO);
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      return due.getTime() < today.getTime();
    },

    isToday: function (dueISO) {
      if (!dueISO) return false;
      return dateToISODate(new Date(dueISO.length <= 10 ? dueISO + "T00:00:00" : dueISO)) === dateToISODate(new Date());
    },

    escapeHtml: function (value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    debounce: function (fn, wait) {
      var timer = null;
      return function () {
        var ctx = this, args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
      };
    },

    clamp: function (n, min, max) {
      return Math.max(min, Math.min(max, n));
    }
  };

  function dateToISODate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  TF.Utils = Utils;
})(window);