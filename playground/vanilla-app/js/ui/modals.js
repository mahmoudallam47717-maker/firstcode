(function () {
  "use strict";
  var TF = window.TF = window.TF || {};

  var lastFocused = null;
  var onSubmit = null;

  function getEl(id) { return document.getElementById(id); }

  function openModal(modal, firstFocusId) {
    lastFocused = document.activeElement;
    modal.hidden = false;
    var first = firstFocusId ? getEl(firstFocusId) : null;
    if (first) first.focus();
  }

  function closeModal(modal) {
    modal.hidden = true;
    if (lastFocused && lastFocused.focus && lastFocused.parentNode) lastFocused.focus();
    lastFocused = null;
  }

  function setFieldError(id, msg) {
    var field = getEl(id);
    if (!field) return;
    var wrap = field.closest(".field");
    if (wrap) wrap.classList.toggle("is-invalid", !!msg);
    var err = getEl("err-" + id.split("-")[1]);
    if (err) err.textContent = msg || "";
  }

  function clearErrors() {
    setFieldError("f-title", "");
    setFieldError("f-notes", "");
    setFieldError("f-due", "");
  }

  function fillForm(task) {
    getEl("f-id").value = task ? task.id : "";
    getEl("f-title").value = task ? task.title : "";
    getEl("f-notes").value = task ? task.notes : "";
    getEl("f-due").value = task ? (task.due || "") : "";
    getEl("f-priority").value = task ? task.priority : "medium";
    getEl("f-tags").value = task ? task.tags.join(", ") : "";
  }

  function collectForm() {
    return {
      id: getEl("f-id").value,
      title: getEl("f-title").value,
      notes: getEl("f-notes").value,
      due: getEl("f-due").value,
      priority: getEl("f-priority").value,
      tags: getEl("f-tags").value
    };
  }

  var Modals = {
    init: function (submitHandler) {
      onSubmit = submitHandler;

      getEl("task-form").addEventListener("submit", function (e) {
        e.preventDefault();
        clearErrors();
        var input = collectForm();
        var titleCheck = TF.Validation.title(input.title);
        if (!titleCheck.ok) {
          setFieldError("f-title", titleCheck.error);
          getEl("f-title").focus();
          return;
        }
        input.title = titleCheck.value;

        var notesCheck = TF.Validation.notes(input.notes);
        if (!notesCheck.ok) {
          setFieldError("f-notes", notesCheck.error);
          return;
        }
        input.notes = notesCheck.value;

        var dueCheck = TF.Validation.due(input.due);
        if (!dueCheck.ok) {
          setFieldError("f-due", dueCheck.error);
          return;
        }
        input.due = dueCheck.value;

        var priCheck = TF.Validation.priority(input.priority);
        if (!priCheck.ok) { TF.Notify.error(priCheck.error); return; }
        input.priority = priCheck.value;

        var tagsCheck = TF.Validation.tags(input.tags);
        input.tags = tagsCheck.value;

        if (onSubmit) onSubmit(input);
        Modals.closeTask();
      });
    },

    openTask: function (task) {
      fillForm(task || null);
      getEl("modal-title").textContent = task ? "تعديل المهمة" : "مهمة جديدة";
      getEl("submit-task").textContent = task ? "حفظ التغييرات" : "إضافة";
      openModal(getEl("task-modal"), "f-title");
    },

    closeTask: function () {
      closeModal(getEl("task-modal"));
      clearErrors();
    },

    openHelp: function () {
      openModal(getEl("help-modal"), null);
    },

    closeHelp: function () {
      closeModal(getEl("help-modal"));
    },

    handleEscape: function () {
      var task = getEl("task-modal");
      var help = getEl("help-modal");
      if (!help.hidden) { Modals.closeHelp(); return true; }
      if (!task.hidden) { Modals.closeTask(); return true; }
      return false;
    }
  };

  getEl("btn-new-task").addEventListener("click", function () { Modals.openTask(null); });
  getEl("btn-help").addEventListener("click", function () { Modals.openHelp(); });

  document.querySelectorAll("[data-close-modal]").forEach(function (btn) {
    btn.addEventListener("click", function () { Modals.closeTask(); });
  });
  document.querySelectorAll("[data-close-help]").forEach(function (btn) {
    btn.addEventListener("click", function () { Modals.closeHelp(); });
  });

  TF.Modals = Modals;
})();