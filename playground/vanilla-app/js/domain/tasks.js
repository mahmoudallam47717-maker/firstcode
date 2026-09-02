(function () {
  "use strict";
  var TF = window.TF = window.TF || {};

  function makeTask(input) {
    var now = TF.Utils.nowISO();
    return {
      id: TF.Utils.uid(),
      title: input.title,
      notes: input.notes,
      done: false,
      priority: input.priority,
      due: input.due,
      tags: input.tags,
      createdAt: now,
      updatedAt: now
    };
  }

  var Tasks = {
    create: function (input) {
      var task = makeTask(input);
      TF.State.update(function (s) {
        s.tasks.push(task);
        return s;
      });
      return task;
    },

    update: function (id, patch) {
      TF.State.update(function (s) {
        for (var i = 0; i < s.tasks.length; i++) {
          if (s.tasks[i].id === id) {
            var t = s.tasks[i];
            if ("title" in patch) t.title = patch.title;
            if ("notes" in patch) t.notes = patch.notes;
            if ("done" in patch) t.done = !!patch.done;
            if ("priority" in patch) t.priority = patch.priority;
            if ("due" in patch) t.due = patch.due;
            if ("tags" in patch) t.tags = patch.tags;
            t.updatedAt = TF.Utils.nowISO();
            break;
          }
        }
        return s;
      });
    },

    remove: function (id) {
      TF.State.update(function (s) {
        s.tasks = s.tasks.filter(function (t) { return t.id !== id; });
        return s;
      });
    },

    removeCompleted: function () {
      TF.State.update(function (s) {
        s.tasks = s.tasks.filter(function (t) { return !t.done; });
        return s;
      });
    },

    find: function (id) {
      for (var i = 0; i < TF.State.get().tasks.length; i++) {
        if (TF.State.get().tasks[i].id === id) return TF.State.get().tasks[i];
      }
      return null;
    }
  };

  TF.Tasks = Tasks;
})();