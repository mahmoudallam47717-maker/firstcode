(function () {
  "use strict";
  var TF = window.TF = window.TF || {};

  var PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  var uiState = {
    view: "all",
    priority: "",
    tag: "",
    search: "",
    sort: "created_desc",
    selected: null
  };

  function tasks() { return TF.State.get().tasks; }

  function matchesTask(t) {
    if (uiState.view === "today" && !TF.Utils.isToday(t.due)) return false;
    if (uiState.view === "upcoming" && !(t.due && !t.done && !TF.Utils.isToday(t.due) && !TF.Utils.isOverdue(t.due))) return false;
    if (uiState.view === "completed" && !t.done) return false;
    if (uiState.view === "all" && t.done && !showCompleted()) return false;

    if (uiState.priority && t.priority !== uiState.priority) return false;
    if (uiState.tag && t.tags.indexOf(uiState.tag) < 0) return false;

    var q = uiState.search.trim().toLowerCase();
    if (q) {
      var hay = (t.title + " " + t.notes + " " + t.tags.join(" ")).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }

  function showCompleted() {
    return true;
  }

  function sortTasks(list) {
    var sort = uiState.sort;
    var copy = list.slice();
    copy.sort(function (a, b) {
      if (sort === "due_asc") {
        if (!a.due && b.due) return 1;
        if (a.due && !b.due) return -1;
        if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
      } else if (sort === "priority") {
        var d = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (d !== 0) return d;
      } else if (sort === "title") {
        return a.title.localeCompare(b.title, "ar", { sensitivity: "base" });
      }
      return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
    });
    return copy;
  }

  function renderTask(t) {
    var el = document.createElement("article");
    el.className = "task-item" + (t.done ? " is-done" : "") + (t.id === uiState.selected ? " is-selected" : "");
    el.dataset.id = t.id;

    var priLabel = { high: "عالية", medium: "متوسطة", low: "منخفضة" }[t.priority] || "متوسطة";
    var priClass = t.priority === "high" ? "pri-high" : t.priority === "medium" ? "pri-med" : "pri-low";

    var dueHtml = "";
    if (t.due) {
      var overdue = !t.done && TF.Utils.isOverdue(t.due);
      dueHtml = '<span class="badge badge-due' + (overdue ? " overdue" : "") + '">' +
        (overdue ? "متأخرة — " : "") + TF.Utils.escapeHtml(TF.Utils.formatDate(t.due)) + "</span>";
    }

    var tagsHtml = t.tags.map(function (tag) {
      return '<span class="badge badge-tag">#' + TF.Utils.escapeHtml(tag) + "</span>";
    }).join("");

    var notesHtml = t.notes
      ? '<p class="task-notes">' + TF.Utils.escapeHtml(t.notes) + "</p>"
      : "";

    el.innerHTML =
      '<label class="check" title="تبديل الإكمال">' +
        '<input type="checkbox" data-action="toggle" ' + (t.done ? "checked" : "") + ' aria-label="إتمام: ' + TF.Utils.escapeHtml(t.title) + '">' +
        '<span class="check-box"><svg viewBox="0 0 24 24" width="14" height="14" focusable="false"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
      '</label>' +
      '<div class="task-body">' +
        '<h3 class="task-title">' + TF.Utils.escapeHtml(t.title) + "</h3>" +
        notesHtml +
        '<div class="task-meta">' +
          '<span class="badge badge-pri ' + priClass + '">' + priLabel + "</span>" +
          dueHtml +
          tagsHtml +
        "</div>" +
      "</div>" +
      '<div class="task-actions">' +
        '<button class="icon-btn" type="button" data-action="edit" aria-label="تعديل: ' + TF.Utils.escapeHtml(t.title) + '" title="تعديل">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" focusable="false"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/></svg>' +
        "</button>" +
        '<button class="icon-btn" type="button" data-action="delete" aria-label="حذف: ' + TF.Utils.escapeHtml(t.title) + '" title="حذف">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" focusable="false"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        "</button>" +
      "</div>";

    return el;
  }

  function renderList() {
    var listEl = document.getElementById("task-list");
    var emptyEl = document.getElementById("empty-state");
    var hintEl = document.getElementById("empty-hint");

    var filtered = tasks().filter(matchesTask);
    var sorted = sortTasks(filtered);

    listEl.innerHTML = "";
    sorted.forEach(function (t) { listEl.appendChild(renderTask(t)); });

    if (tasks().length > 0 && sorted.length === 0) {
      hintEl.textContent = "لا توجد نتائج مطابقة للتصفية الحالية.";
    } else {
      hintEl.textContent = "ابدأ بإضافة مهمة جديدة.";
    }
    emptyEl.hidden = sorted.length > 0;
  }

  function renderTagCloud() {
    var counts = {};
    tasks().forEach(function (t) {
      t.tags.forEach(function (tag) {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    var keys = Object.keys(counts).sort(function (a, b) { return a.localeCompare(b, "ar"); });
    var box = document.getElementById("tag-cloud");
    if (!box) return;
    box.innerHTML = "";
    if (keys.length === 0) {
      var note = document.createElement("span");
      note.className = "side-empty-note";
      note.textContent = "لا وسوم بعد.";
      box.appendChild(note);
      return;
    }
    keys.forEach(function (tag) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip" + (uiState.tag === tag ? " is-active" : "");
      chip.textContent = "#" + tag + " (" + counts[tag] + ")";
      chip.setAttribute("aria-pressed", uiState.tag === tag ? "true" : "false");
      chip.addEventListener("click", function () {
        uiState.tag = uiState.tag === tag ? "" : tag;
        TF.Render.render();
      });
      box.appendChild(chip);
    });
  }

  function updateCounts() {
    var total = tasks();
    var done = total.filter(function (t) { return t.done; }).length;
    var today = total.filter(function (t) { return !t.done && TF.Utils.isToday(t.due); }).length;
    var upcoming = total.filter(function (t) { return !t.done && t.due && !TF.Utils.isToday(t.due) && !TF.Utils.isOverdue(t.due); }).length;

    var map = { all: total.length, today: today, upcoming: upcoming, completed: done };
    Object.keys(map).forEach(function (k) {
      var el = document.querySelector('[data-count="' + k + '"]');
      if (el) el.textContent = map[k];
    });
  }

  function updateTitle() {
    var titles = { all: "كل المهام", today: "مهام اليوم", upcoming: "مهام قادمة", completed: "المكتملة" };
    var el = document.getElementById("content-title");
    el.textContent = titles[uiState.view] || "كل المهام";

    var sub = [];
    if (uiState.priority) sub.push("أولوية: " + ({ high: "عالية", medium: "متوسطة", low: "منخفضة" }[uiState.priority]));
    if (uiState.tag) sub.push("وسم: #" + uiState.tag);
    if (uiState.search.trim()) sub.push("بحث: «" + uiState.search.trim() + "»");
    document.getElementById("content-subtitle").textContent = sub.join(" • ");
  }

  var Render = {
    getUIState: function () { return uiState; },
    setUIState: function (patch) {
      for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) uiState[k] = patch[k];
    },
    render: function () {
      renderTagCloud();
      renderList();
      updateCounts();
      updateTitle();
    },
    selectFirst: function () {
      var listEl = document.getElementById("task-list");
      var first = listEl.querySelector(".task-item");
      if (first) {
        uiState.selected = first.dataset.id;
        Render.render();
        return first.dataset.id;
      }
      return null;
    }
  };

  document.getElementById("task-list").addEventListener("change", function (e) {
    var cb = e.target;
    if (cb.dataset.action !== "toggle") return;
    var item = cb.closest(".task-item");
    if (!item) return;
    var id = item.dataset.id;
    TF.Tasks.update(id, { done: cb.checked });
    TF.Notify.info(cb.checked ? "تم إتمام المهمة." : "تمت إعادة المهمة.");
  });

  document.getElementById("task-list").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var item = btn.closest(".task-item");
    if (!item) return;
    var id = item.dataset.id;
    var action = btn.dataset.action;

    if (action === "edit") {
      var task = TF.Tasks.find(id);
      if (task) TF.Modals.openTask(task);
    } else if (action === "delete") {
      uiState.selected = id;
      Render.render();
      var task = TF.Tasks.find(id);
      if (task && window.confirm("حذف المهمة «" + task.title + "» نهائيًا؟")) {
        TF.Tasks.remove(id);
        TF.Notify.success("تم حذف المهمة.");
      }
    }
  });

  document.getElementById("task-list").addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      var target = e.target;
      if (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.type === "checkbox") return;
      var item = target.closest(".task-item");
      if (item) {
        uiState.selected = item.dataset.id;
        Render.render();
      }
    }
  });

  TF.Render = Render;
})();