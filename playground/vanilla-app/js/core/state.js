(function () {
  "use strict";
  var TF = window.TF = window.TF || {};

  var listeners = {};

  var State = {
    data: null,

    init: function (initial) {
      this.data = initial;
    },

    get: function () {
      return this.data;
    },

    set: function (next) {
      this.data = next;
      this.persist();
      this.emit("change", next);
    },

    update: function (fn) {
      var next = fn(this.data);
      this.set(next);
      return next;
    },

    persist: function () {
      TF.Storage.save(this.data);
    },

    on: function (event, handler) {
      (listeners[event] = listeners[event] || []).push(handler);
    },

    off: function (event, handler) {
      var arr = listeners[event];
      if (!arr) return;
      var i = arr.indexOf(handler);
      if (i >= 0) arr.splice(i, 1);
    },

    emit: function (event) {
      var arr = listeners[event];
      if (!arr) return;
      var args = Array.prototype.slice.call(arguments, 1);
      for (var i = 0; i < arr.length; i++) {
        try { arr[i].apply(null, args); } catch (e) {}
      }
    }
  };

  TF.State = State;
})();