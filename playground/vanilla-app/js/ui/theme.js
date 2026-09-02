(function () {
  "use strict";
  var TF = window.TF = window.TF || {};

  var Theme = {
    current: function () {
      return TF.State.get().settings.theme;
    },

    apply: function (theme) {
      var resolved = theme;
      if (resolved === "auto") {
        resolved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      document.documentElement.setAttribute("data-theme", resolved);
    },

    set: function (theme) {
      TF.State.update(function (s) {
        s.settings.theme = theme;
        return s;
      });
      this.apply(theme);
      this.syncButton();
    },

    toggle: function () {
      var themes = ["auto", "light", "dark"];
      var idx = themes.indexOf(this.current());
      this.set(themes[(idx + 1) % themes.length]);
    },

    syncButton: function () {
      var btn = document.getElementById("btn-theme");
      if (!btn) return;
      btn.setAttribute("aria-label", "المظهر الحالي: " + this.current() + ". اضغط للتبديل");
      btn.title = "تبديل المظهر (T)";
    }
  };

  TF.Theme = Theme;
})();