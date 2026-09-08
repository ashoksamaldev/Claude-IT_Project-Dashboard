// Celebration dialog: state, rendering, share URL and dismissal.
var backdrop = elements["celebrate-backdrop"];
var share    = elements["celebrate-share"];
var options  = elements["celebrate-options"];
var closeBtn = elements["celebrate-close"];

ok(backdrop && share && options && closeBtn, "dialog elements were touched by render/bind");
eq(app.state.celebrate, null, "no dialog on a freshly seeded board");
eq(backdrop.hidden, true, "backdrop starts hidden");

// A task that is not already Done.
var task = app.state.tasks.filter(function (t) { return t.status !== "Done"; })[0];
ok(!!task, "found a non-Done seed task to move");

// --- moving to a non-Done column must NOT celebrate ------------------------
app.moveTask(task.id, "Blocked");
eq(app.state.celebrate, null, "moving to Blocked does not open the dialog");
eq(backdrop.hidden, true, "backdrop still hidden after a non-Done move");

// --- moving to Done opens it ----------------------------------------------
app.moveTask(task.id, "Done");
ok(app.state.celebrate !== null, "moving to Done opens the dialog");
eq(app.state.celebrate.taskId, task.id, "dialog points at the moved task");
eq(app.state.celebrate.messageIndex, 0, "first message is preselected");
eq(backdrop.hidden, false, "backdrop is shown");

// --- share link ------------------------------------------------------------
ok(share.href.indexOf("https://wa.me/?text=") === 0, "share link is a wa.me share URL");
ok(share.href.indexOf(encodeURIComponent(task.title)) !== -1, "share text carries the task title");
ok(share.href.indexOf(" ") === -1, "share text is percent-encoded (no raw spaces)");
var href0 = share.href;

// --- choosing another message updates only the link ------------------------
options.fire("change", { target: { name: "celebrate-message", value: "3" } });
eq(app.state.celebrate.messageIndex, 3, "choosing a message updates state");
ok(share.href !== href0, "share link follows the chosen message");
ok(share.href.indexOf(encodeURIComponent("delivered")) !== -1, "message 4 is the delivered one");

// A change from an unrelated control must not touch the selection.
options.fire("change", { target: { name: "something-else", value: "0" } });
eq(app.state.celebrate.messageIndex, 3, "unrelated change events are ignored");

// --- title escaping: the URL must not be able to carry a raw quote ---------
var nasty = app.addTask({
  title: 'Ship "v2" & <img src=x onerror=alert(1)>',
  description: "", project: "Core Banking", category: "Feature",
  assignee: "QA", priority: "High", dueDate: app.daysFromToday(2), status: "In Progress"
});
app.moveTask(nasty.id, "Done");
ok(share.href.indexOf('"') === -1, "no raw double quote reaches the share URL");
ok(share.href.indexOf("<img src=x") === -1, "no raw markup reaches the share URL");
ok(share.href.indexOf("%3Cimg%20src%3Dx") !== -1, "markup is percent-encoded instead");
eq(decodeURIComponent(share.href.slice("https://wa.me/?text=".length)).indexOf(nasty.title) !== -1,
   true, "the decoded text is exactly what the user typed");
eq(app.state.celebrate.messageIndex, 0, "a new celebration resets to the first message");

// --- dismissal -------------------------------------------------------------
closeBtn.fire("click");
eq(app.state.celebrate, null, "Close clears the dialog state");
eq(backdrop.hidden, true, "Close hides the backdrop");

// Backdrop click: only when the backdrop itself is the target.
app.moveTask(task.id, "Backlog");
app.moveTask(task.id, "Done");
backdrop.fire("click", { target: options });
ok(app.state.celebrate !== null, "a click inside the dialog does not dismiss it");
backdrop.fire("click", { target: backdrop });
eq(app.state.celebrate, null, "a click on the backdrop dismisses it");

// Escape closes; other keys do not.
app.moveTask(task.id, "Backlog");
app.moveTask(task.id, "Done");
backdrop.fire("keydown", { key: "a" });
ok(app.state.celebrate !== null, "an unrelated key does not dismiss it");
backdrop.fire("keydown", { key: "Escape" });
eq(app.state.celebrate, null, "Escape dismisses it");

// Sharing closes it too.
app.moveTask(task.id, "Backlog");
app.moveTask(task.id, "Done");
share.fire("click");
eq(app.state.celebrate, null, "sharing closes the dialog");

// --- a move within Done must not re-open ----------------------------------
app.moveTask(task.id, "Done");
eq(app.state.celebrate, null, "moving a Done task to Done again is a no-op");

// --- deleting the celebrated task clears the dialog ------------------------
app.moveTask(task.id, "Backlog");
app.moveTask(task.id, "Done");
app.deleteTask(task.id);
eq(app.state.celebrate, null, "deleting the celebrated task clears the dialog");
eq(backdrop.hidden, true, "and hides the backdrop");

// --- the board itself is untouched by all of this --------------------------
ok(app.state.tasks.length > 0, "board survived");
ok(app.applyFilters().every(function (t) { return typeof t.status === "string"; }), "tasks still well-formed");
