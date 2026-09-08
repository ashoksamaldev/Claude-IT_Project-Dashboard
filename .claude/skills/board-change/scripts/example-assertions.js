// Example assertions file for run-harness.sh. Copy it to the scratchpad, edit,
// and run:  run-harness.sh index.html /tmp/.../my-assertions.js
// In scope: app (board internals), ok(cond,label), eq(actual,expected,label).
//
// Task shape: { id, title, description, project, category, assignee, priority,
//               dueDate, status }.  Filters: { project, assignee, priority },
// where "" means "no filter" (not "All").

var s = app.state;

// --- seed data -------------------------------------------------------------
ok(s.tasks.length > 0, "seed tasks exist");
ok(s.tasks.some(function (t) { return app.isOverdue(t); }), "a seed task is overdue, so the badge demonstrates");
ok(!s.tasks.some(function (t) { return t.status === "Done" && app.isOverdue(t); }), "Done tasks are never overdue");

// --- escaping: the load-bearing invariant ----------------------------------
// Be precise. Substring checks like indexOf('"><') match legitimate tag
// boundaries and already-escaped text, and report false failures.
var evil = '<img src=x onerror="steal()">& "quoted"';
var esc = app.escapeHtml(evil);
eq(esc.indexOf("&lt;img"), 0, "escapeHtml encodes the leading < as &lt;");
ok(esc.indexOf("<img") === -1, "escapeHtml neutralises the tag opener");
ok(esc.indexOf('"') === -1, "escapeHtml encodes double quotes, so attributes stay safe");

var task = app.addTask({
  title: evil, description: evil, project: "Core Banking", category: "Build",
  assignee: evil, priority: "High", dueDate: app.daysFromToday(3), status: "To Do"
});
var card = app.renderCard(task);
ok(card.indexOf("<img src=x") === -1, "renderCard never emits the raw injected tag");
ok(card.indexOf('onerror="steal()"') === -1, "renderCard never emits the raw event-handler attribute");
ok(card.indexOf("&lt;img") !== -1, "the injected text still shows up, escaped");
ok(card.indexOf('data-id="' + task.id + '"') !== -1, "the card carries its data-id");

// --- mutators keep state coherent ------------------------------------------
var before = s.tasks.length;
app.moveTask(task.id, "Done");
eq(task.status, "Done", "moveTask updates status");
app.moveTask(task.id, "Nonsense");
eq(task.status, "Done", "moveTask rejects a status outside STATUSES");
s.pendingDeleteId = task.id;
app.deleteTask(task.id);
eq(s.tasks.length, before - 1, "deleteTask removes exactly one task");
eq(s.pendingDeleteId, null, "deleteTask clears pendingDeleteId");

// --- filters ---------------------------------------------------------------
s.filters.priority = "Critical";
ok(app.applyFilters().every(function (t) { return t.priority === "Critical"; }), "priority filter excludes everything else");
s.filters.priority = "";
eq(app.applyFilters().length, s.tasks.length, "clearing the filter restores every task");
s.filters.assignee = "  ";
eq(app.applyFilters().length, s.tasks.length, "a whitespace-only assignee filter matches everything");
s.filters.assignee = "";

// --- dates are local-midnight, not UTC -------------------------------------
var iso = app.toISODate(app.todayMidnight());
ok(/^\d{4}-\d{2}-\d{2}$/.test(iso), "toISODate emits YYYY-MM-DD");
eq(app.toISODate(app.parseISODate(iso)), iso, "parseISODate/toISODate round-trip without UTC drift");
