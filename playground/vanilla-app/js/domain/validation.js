(function () {
  "use strict";
  var TF = window.TF = window.TF || {};

  var VALID_PRIORITIES = ["low", "medium", "high"];

  var Validation = {
    title: function (value) {
      value = String(value == null ? "" : value).trim();
      if (!value) return { ok: false, error: "العنوان مطلوب." };
      if (value.length > 120) return { ok: false, error: "العنوان يجب ألا يتجاوز 120 حرفًا." };
      return { ok: true, value: value };
    },

    notes: function (value) {
      value = String(value == null ? "" : value).trim();
      if (value.length > 2000) return { ok: false, error: "الملاحظات يجب ألا تتجاوز 2000 حرف." };
      return { ok: true, value: value };
    },

    due: function (value) {
      if (!value) return { ok: true, value: null };
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!m) return { ok: false, error: "تاريخ غير صالح." };
      var d = new Date(m[1], m[2] - 1, m[3]);
      if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
        return { ok: false, error: "تاريخ غير صالح." };
      }
      return { ok: true, value: value };
    },

    priority: function (value) {
      if (VALID_PRIORITIES.indexOf(value) < 0) return { ok: false, error: "أولوية غير معروفة." };
      return { ok: true, value: value };
    },

    tags: function (value) {
      if (!value) return { ok: true, value: [] };
      var list = value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      list = list.slice(0, 20);
      list = list.map(function (s) { return s.slice(0, 24); });
      return { ok: true, value: list };
    }
  };

  TF.Validation = Validation;
})();