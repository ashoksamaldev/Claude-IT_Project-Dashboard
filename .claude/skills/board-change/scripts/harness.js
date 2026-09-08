// Fake-DOM harness for index.html's script block, run under JavaScriptCore.
//
//   jsc harness.js -- /abs/path/to/app.js /abs/path/to/your-assertions.js
//
// app.js is the extracted <script> block (see extract-js.sh). It is evaluated with
// a stub DOM, so init() -> seedTasks() -> renderBoard() runs for real. The harness
// then loads your assertions file, which is evaluated with `app` in scope: an object
// exposing the board's internals (state, applyFilters, renderCard, escapeHtml,
// isOverdue, addTask, moveTask, deleteTask, the date helpers, and the overview
// pieces: statusCounts, renderStatusChart, barPath, renderSummary, sanitizeText,
// sortTasks).
//
// Assertion files use ok(condition, label) / eq(actual, expected, label), both
// provided as globals, and the harness exits non-zero if any check fails.

var APP_PATH = arguments[0];
var TEST_PATH = arguments[1];

// ---- stub DOM -------------------------------------------------------------
function El(id) {
  this.id = id || "";
  this.value = "";
  this.textContent = "";
  this.innerHTML = "";
  this.min = "";
  this.checked = false;
  this.className = "";
  this.dataset = {};
  this.style = {};
  this.children = [];
  this.parentNode = null;
  this._attrs = {};
  this._classes = {};
  this._listeners = {};
  var self = this;
  this.classList = {
    add: function (c) { self._classes[c] = true; },
    remove: function (c) { delete self._classes[c]; },
    toggle: function (c, on) { if (on === undefined) { on = !self._classes[c]; } if (on) { self._classes[c] = true; } else { delete self._classes[c]; } },
    contains: function (c) { return !!self._classes[c]; }
  };
}
El.prototype.addEventListener = function (type, fn) {
  (this._listeners[type] = this._listeners[type] || []).push(fn);
};
El.prototype.removeEventListener = function () {};
El.prototype.setAttribute = function (k, v) { this._attrs[k] = v; };
El.prototype.getAttribute = function (k) { return this._attrs[k]; };
El.prototype.appendChild = function (c) { this.children.push(c); c.parentNode = this; return c; };
El.prototype.removeChild = function (c) {
  var i = this.children.indexOf(c);
  if (i !== -1) { this.children.splice(i, 1); }
  c.parentNode = null;
  return c;
};
Object.defineProperty(El.prototype, "firstChild", {
  get: function () { return this.children.length ? this.children[0] : null; }
});
El.prototype.querySelector = function () { return new El(); };
El.prototype.querySelectorAll = function () { return []; };
El.prototype.closest = function () { return null; };
El.prototype.focus = function () {};
El.prototype.reset = function () {};
El.prototype.preventDefault = function () {};
// Fire a listener registered on this element: el.fire("click", {target: ...})
El.prototype.fire = function (type, event) {
  var fns = this._listeners[type] || [];
  event = event || {};
  if (!event.preventDefault) { event.preventDefault = function () {}; }
  if (!event.target) { event.target = this; }
  for (var i = 0; i < fns.length; i++) { fns[i].call(this, event); }
  return event;
};

var elements = {};
function getEl(id) {
  if (!elements[id]) { elements[id] = new El(id); }
  return elements[id];
}

var document = {
  getElementById: getEl,
  querySelector: function (sel) { return getEl("sel:" + sel); },
  querySelectorAll: function () { return []; },
  createElement: function (tag) { var e = new El(); e.tagName = String(tag).toUpperCase(); return e; },
  createTextNode: function (text) { var e = new El(); e.tagName = "#text"; e.textContent = String(text); return e; },
  createElementNS: function (ns, tag) {
    var e = new El();
    e.tagName = String(tag).toUpperCase();
    e.namespaceURI = ns;
    return e;
  },
  body: new El("body"),
  activeElement: null,
  // Nodes built by the stub are never attached to a live tree, so nothing is
  // "in the document" — code that checks before restoring focus takes the
  // same branch it would take after a re-render replaced the node.
  contains: function () { return false; },
  addEventListener: function () {}
};
function setTimeout(fn) { return 0; }        // toasts never auto-hide under test
function clearTimeout() {}
var window = {
  document: document,
  addEventListener: function () {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  matchMedia: function () { return { matches: false, addEventListener: function () {} }; }
};
// Default: FormSubmit fails, matching the shipped YOUR_EMAIL@example.com placeholder.
// Override in an assertions file with `fetchMode = "ok"` before triggering a submit.
var fetchMode = "fail";
function fetch() {
  if (fetchMode === "ok") { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } }); }
  return Promise.reject(new Error("stub fetch failure"));
}

// ---- evaluate the board ---------------------------------------------------
var EXPORTS = "\nreturn {" +
  "state: state, seedTasks: seedTasks, applyFilters: applyFilters, renderCard: renderCard," +
  "renderBoard: renderBoard, addTask: addTask, moveTask: moveTask, deleteTask: deleteTask," +
  "escapeHtml: escapeHtml, isOverdue: isOverdue, validateForm: validateForm," +
  "toISODate: toISODate, parseISODate: parseISODate, daysFromToday: daysFromToday," +
  "todayMidnight: todayMidnight, formatDate: formatDate," +
  "statusCounts: statusCounts, renderStatusChart: renderStatusChart, barPath: barPath," +
  "renderSummary: renderSummary, sanitizeText: sanitizeText, sortTasks: sortTasks," +
  "el: function(id){ return elements[id]; }" +
  "};\n";

var src = readFile(APP_PATH) + EXPORTS;
var app;
try {
  app = new Function("document", "window", "setTimeout", "clearTimeout", "fetch", "elements", src)(
    document, window, setTimeout, clearTimeout, fetch, elements
  );
} catch (e) {
  print("HARNESS ERROR while evaluating app.js: " + e);
  throw e;
}

// ---- assertion helpers ----------------------------------------------------
var passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; print("  ok   " + label); }
  else { failed++; print("  FAIL " + label); }
}
function eq(actual, expected, label) {
  if (actual === expected) { ok(true, label); }
  else { ok(false, label + "  (expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual) + ")"); }
}

if (TEST_PATH) {
  new Function("app", "ok", "eq", "elements", readFile(TEST_PATH))(app, ok, eq, elements);
} else {
  // Smoke test when run with no assertions file.
  ok(app.state.tasks.length > 0, "seedTasks() populated state.tasks");
  ok(app.escapeHtml('<img src=x onerror="a">').indexOf("<") === -1, "escapeHtml() removes raw <");
}

print("");
print(failed === 0 ? "ALL PASS (" + passed + ")" : "FAILED " + failed + " of " + (passed + failed));
if (failed > 0) { throw new Error("assertions failed"); }
