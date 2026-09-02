(function () {
  "use strict";
  var TF = window.TF = window.TF || {};

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function initTheme() {
    TF.Theme.apply(TF.State.get().settings.theme);
    TF.Theme.syncButton();
    document.getElementById("btn-theme").addEventListener("click", function () {
      TF.Theme.toggle();
      TF.Notify.info("تم تبديل المظهر.");
    });
  }

  function initNav() {
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        TF.Render.setUIState({ view: btn.dataset.view });
        document.querySelectorAll(".nav-item").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        TF.Render.render();
      });
    });

    document.querySelectorAll('input[name="priority-filter"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        TF.Render.setUIState({ priority: radio.value });
        TF.Render.render();
      });
    });
  }

  function initToolbar() {
    var search = document.getElementById("search-input");
    search.addEventListener("input", TF.Utils.debounce(function () {
      TF.Render.setUIState({ search: search.value });
      TF.Render.render();
    }, 180));

    var sort = document.getElementById("sort-select");
    sort.addEventListener("change", function () {
      TF.Render.setUIState({ sort: sort.value });
      TF.Render.render();
    });
  }

  function initKeyboard() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (TF.Modals.handleEscape()) return;
        return;
      }
      var tag = (e.target.tagName || "").toLowerCase();
      var typing = tag === "input" || tag === "textarea" || tag === "select";
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (typing) {
        if (e.key === "/" && tag === "input") {
          e.preventDefault();
          document.getElementById("search-input").focus();
        }
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        TF.Modals.openTask(null);
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        TF.Render.selectFirst();
        var id = TF.Render.getUIState().selected;
        var task = id ? TF.Tasks.find(id) : null;
        if (task) TF.Modals.openTask(task);
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        TF.Theme.toggle();
        TF.Notify.info("تم تبديل المظهر.");
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("search-input").focus();
      } else if (e.key === "Delete") {
        var sel = TF.Render.getUIState().selected;
        var task = sel ? TF.Tasks.find(sel) : null;
        if (task) {
          e.preventDefault();
          if (window.confirm("حذف المهمة «" + task.title + "» نهائيًا؟")) {
            TF.Tasks.remove(sel);
            TF.Notify.success("تم حذف المهمة.");
          }
        }
      }
    });
  }

  function initExportImport() {
    document.getElementById("btn-export").addEventListener("click", function () {
      var json = TF.Storage.exportJSON(TF.State.get());
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "taskflow-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      TF.Notify.success("تم تصدير البيانات.");
    });

    var fileInput = document.getElementById("import-file");
    document.getElementById("btn-import").addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var imported = TF.Storage.parseImport(String(reader.result), TF.State.get().settings);
        if (!imported) {
          TF.Notify.error("ملف غير صالح: تعذر قراءة البيانات.");
          fileInput.value = "";
          return;
        }
        var ok = window.confirm("استيراد " + imported.tasks.length + " مهمة؟ سيتم استبدال المهام الحالية.");
        if (!ok) { fileInput.value = ""; return; }
        TF.State.set(imported);
        TF.Notify.success("تم استيراد البيانات بنجاح.");
        fileInput.value = "";
      };
      reader.onerror = function () {
        TF.Notify.error("تعذر قراءة الملف.");
        fileInput.value = "";
      };
      reader.readAsText(file);
    });
  }

  function initStorageWarnings() {
    var el = document.createElement("div");
    if (!window.localStorage) {
      el.className = "toast toast-error";
      el.textContent = "المتصفح لا يدعم التخزين المحلي — لن تُحفظ البيانات.";
      document.getElementById("toast-region").appendChild(el);
    }
  }

  TF.App = {
    start: function () {
      TF.State.init(TF.Storage.load());
      initTheme();
      initNav();
      initToolbar();
      initKeyboard();
      initExportImport();
      initStorageWarnings();
      TF.Modals.init(function (input) {
        if (input.id) {
          TF.Tasks.update(input.id, {
            title: input.title,
            notes: input.notes,
            due: input.due,
            priority: input.priority,
            tags: input.tags
          });
          TF.Notify.success("تم حفظ التعديلات.");
        } else {
          TF.Tasks.create({
            title: input.title,
            notes: input.notes,
            due: input.due,
            priority: input.priority,
            tags: input.tags
          });
          TF.Notify.success("تمت إضافة المهمة.");
        }
      });
      TF.Render.render();
    }
  };

  onReady(function () {
    TF.App.start();
  });
})();