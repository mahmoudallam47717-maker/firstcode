(function () {
  "use strict";
  var TF = window.TF = window.TF || {};

  var STORAGE_KEY = "taskflow.v1.data";

  var DEFAULT_STATE = {
    schemaVersion: 1,
    savedAt: null,
    tasks: [],
    settings: { theme: "auto" }
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function isValidTask(t) {
    return !!t && typeof t === "object" && typeof t.id === "string" && t.id.length > 0;
  }

  function sanitizeTask(raw, index) {
    raw = raw && typeof raw === "object" ? raw : {};
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : "repaired-" + index + "-" + (Date.now() % 1000),
      title: typeof raw.title === "string" ? raw.title.slice(0, 120) : "",
      notes: typeof raw.notes === "string" ? raw.notes.slice(0, 2000) : "",
      done: raw.done === true,
      priority: ["low", "medium", "high"].indexOf(raw.priority) >= 0 ? raw.priority : "medium",
      due: typeof raw.due === "string" && raw.due ? raw.due : null,
      tags: Array.isArray(raw.tags) ? raw.tags.map(function (s) { return String(s); }).filter(Boolean).slice(0, 20) : [],
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
    };
  }

  var Storage = {
    load: function () {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return clone(DEFAULT_STATE);
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return clone(DEFAULT_STATE);

        var repair = [];
        var tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        tasks.forEach(function (t, i) {
          if (isValidTask(t)) repair.push(sanitizeTask(t, i));
        });

        var state = clone(DEFAULT_STATE);
        state.schemaVersion = parsed.schemaVersion || 1;
        state.savedAt = typeof parsed.savedAt === "string" ? parsed.savedAt : null;
        state.tasks = repair;
        if (parsed.settings && parsed.settings.theme && ["auto", "light", "dark"].indexOf(parsed.settings.theme) >= 0) {
          state.settings.theme = parsed.settings.theme;
        }
        return state;
      } catch (err) {
        return clone(DEFAULT_STATE);
      }
    },

    save: function (state) {
      try {
        var out = clone(state);
        out.savedAt = new Date().toISOString();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
        return true;
      } catch (err) {
        return false;
      }
    },

    clear: function () {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        return true;
      } catch (err) {
        return false;
      }
    },

    exportJSON: function (state) {
      var out = clone(state);
      out.savedAt = new Date().toISOString();
      return JSON.stringify(out, null, 2);
    },

    parseImport: function (text, currentSettings) {
      try {
        var parsed = JSON.parse(text);
        if (!parsed) return clone(DEFAULT_STATE);
        var sanitized = clone(DEFAULT_STATE);
        var tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
        sanitized.tasks = tasks.map(sanitizeTask).filter(function (t) { return t.title; });
        if (currentSettings && currentSettings.theme && ["auto", "light", "dark"].indexOf(currentSettings.theme) >= 0) {
          sanitized.settings.theme = currentSettings.theme;
        }
        return sanitized;
      } catch (err) {
        return null;
      }
    }
  };

  TF.Storage = Storage;
})();