import assert from "node:assert/strict";
import test from "node:test";
import {
  SplitFormAdapter,
  getActiveEmbeddedFormOwner,
} from "../../frappe_split_view/public/js/split_view/split_form_adapter.js";

function setup(t) {
  let route = ["List", "ToDo", "Split"];
  let dirty = false;
  const commits = [];
  const messages = [];
  const browser = { location: { search: "?split_view=1" } };
  const f = {
    get_route: () => route,
    get_route_str: () => route.join("/"),
    get_doc: () => ({}),
    model: { with_doc: async () => {} },
    msgprint: (message) => messages.push(message),
  };
  for (const [key, value] of Object.entries({
    window: browser,
    frappe: f,
    __: (s) => s,
    $: () => ({ trigger() {} }),
  })) {
    const before = globalThis[key];
    globalThis[key] = value;
    t.after(() => {
      if (before === undefined) delete globalThis[key];
      else globalThis[key] = before;
    });
  }
  t.mock.method(console, "error", () => {});
  const host = {
    addEventListener() {},
    classList: { add() {}, remove() {} },
    dataset: {},
  };
  const list = {
    page: { wrapper: { is: () => true } },
    documentRoute: {
      begin(name) {
        const old = route;
        route = ["Form", "ToDo", name];
        return old;
      },
      commit() {
        commits.push([...route]);
      },
      rollback(old) {
        if (old) route = old;
      },
    },
  };
  const adapter = new SplitFormAdapter({
    doctype: "ToDo",
    host,
    listView: list,
  });
  adapter.isSupported = () => ({ supported: true });
  adapter.ensureForm = () => {
    adapter.frm ||= { is_dirty: () => dirty };
  };
  adapter.refreshAndWait = async (name) => {
    assert.deepEqual(
      route,
      ["Form", "ToDo", name],
      "hooks see the document route",
    );
    adapter.frm.docname = name;
  };
  return {
    adapter,
    f,
    list,
    browser,
    commits,
    messages,
    setDirty: (value) => {
      dirty = value;
    },
  };
}

test("adapter serializes rapid clicks under the correct Form context and reopens closed selection", async (t) => {
  const { adapter, f, commits, browser } = setup(t);
  assert.deepEqual(await Promise.all([adapter.open("A"), adapter.open("B")]), [
    true,
    true,
  ]);
  assert.deepEqual(commits, [
    ["Form", "ToDo", "A"],
    ["Form", "ToDo", "B"],
  ]);
  const identity = adapter.frm;
  assert.equal(browser.cur_frm, identity);
  assert.equal(adapter.close(), true);
  assert.equal(browser.cur_frm, null);
  // The caller switches to the list route on close; the adapter must not
  // short-circuit opening the same selectedName when detailOpen is false.
  assert.equal(await adapter.open("B"), true);
  assert.equal(commits.length, 3);
  assert.equal(adapter.frm, identity);
  assert.deepEqual(f.get_route(), ["Form", "ToDo", "B"]);
});

test("dirty selection and edits made during fetch never switch the Form", async (t) => {
  const { adapter, f, commits, setDirty } = setup(t);
  await adapter.open("A");
  setDirty(true);
  assert.equal(await adapter.open("B"), false);
  assert.equal(adapter.close(), false);
  assert.deepEqual(f.get_route(), ["Form", "ToDo", "A"]);
  setDirty(false);
  f.model.with_doc = async () => {
    setDirty(true);
  };
  assert.equal(await adapter.open("B"), false);
  assert.equal(adapter.frm.docname, "A");
  assert.deepEqual(f.get_route(), ["Form", "ToDo", "A"]);
  assert.equal(commits.length, 1);
});

test("fetch and refresh failures restore both route and persistent Form", async (t) => {
  const { adapter, f, commits } = setup(t);
  await adapter.open("A");
  const identity = adapter.frm;
  f.model.with_doc = async () => {
    throw new Error("not found");
  };
  assert.equal(await adapter.open("missing"), false);
  assert.equal(adapter.frm.docname, "A");
  assert.deepEqual(f.get_route(), ["Form", "ToDo", "A"]);
  f.model.with_doc = async () => {};
  const refresh = adapter.refreshAndWait;
  adapter.refreshAndWait = async (name) => {
    await refresh(name);
    if (name === "B") throw new Error("render failed");
  };
  assert.equal(await adapter.open("B"), false);
  assert.equal(adapter.frm, identity);
  assert.equal(adapter.frm.docname, "A");
  assert.equal(adapter.selectedName, "A");
  assert.deepEqual(f.get_route(), ["Form", "ToDo", "A"]);
  assert.equal(commits.length, 1);
});

test("closing during fetch invalidates pending Form work", async (t) => {
  const { adapter, f, commits } = setup(t);
  await adapter.open("A");
  let loaded;
  f.model.with_doc = () =>
    new Promise((resolve) => {
      loaded = resolve;
    });
  const pending = adapter.open("B");
  const queued = adapter.open("C");
  await Promise.resolve();
  assert.deepEqual(f.get_route(), ["Form", "ToDo", "B"]);
  assert.equal(adapter.close(), true);
  assert.deepEqual(
    f.get_route(),
    ["Form", "ToDo", "A"],
    "tentative B route is rolled back before the list route is pushed",
  );
  loaded();
  assert.equal(await pending, false);
  assert.equal(await queued, false);
  assert.equal(adapter.frm.docname, "A");
  assert.equal(adapter.detailOpen, false);
  assert.equal(commits.length, 1);
});

test("navigation during the first fetch cancels pending work before a Form owner exists", async (t) => {
  const { adapter, f, list, browser } = setup(t);
  list.splitFormAdapter = adapter;
  browser.cur_list = list;
  let loaded;
  let destination;
  f.model.with_doc = () =>
    new Promise((resolve) => {
      loaded = resolve;
    });
  browser.location.assign = (path) => {
    destination = path;
  };
  const pending = adapter.open("A");
  await Promise.resolve();
  const owner = getActiveEmbeddedFormOwner();
  assert.ok(owner);
  assert.equal(owner.onRoute("/desk/user"), true);
  assert.equal(destination, "/desk/user");
  assert.deepEqual(f.get_route(), ["List", "ToDo", "Split"]);
  loaded();
  assert.equal(await pending, false);
  assert.equal(adapter.frm, undefined);
});

test("stock render queue tail, not the early render_complete event, releases activation", async (t) => {
  const { adapter, f } = setup(t);
  let earlyRender;
  globalThis.$ = () => ({
    one: (_, fn) => {
      earlyRender = fn;
    },
    off() {},
  });
  let finishHook;
  const clientHook = new Promise((resolve) => {
    finishHook = resolve;
  });
  const nativeTail = () => {};
  adapter.ensureForm();
  adapter.frm.configure_breadcrumb_width = nativeTail;
  adapter.frm.refresh = () => {
    earlyRender?.();
    clientHook.then(() => adapter.frm.configure_breadcrumb_width());
  };
  adapter.restoreGlobalPageState = (action) => action();
  adapter.normalizeDocumentTitle = () => {};
  f.after_ajax = () => Promise.resolve();
  let completed = false;
  const render = SplitFormAdapter.prototype.refreshAndWait
    .call(adapter, "A", 0)
    .then(() => {
      completed = true;
    });
  await Promise.resolve();
  assert.equal(completed, false);
  finishHook();
  await render;
  assert.equal(completed, true);
  assert.equal(adapter.frm.configure_breadcrumb_width, nativeTail);
});

test("an unfinished render times out as unsafe and restores the instance hook", async (t) => {
  const { adapter } = setup(t);
  t.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.$ = () => ({ off() {} });
  adapter.ensureForm();
  const nativeTail = () => {};
  adapter.frm.configure_breadcrumb_width = nativeTail;
  adapter.frm.refresh = () => {};
  adapter.restoreGlobalPageState = (action) => action();
  const render = SplitFormAdapter.prototype.refreshAndWait.call(
    adapter,
    "A",
    0,
  );
  const rejected = assert.rejects(
    render,
    (error) => error.unsafeFormState === true,
  );
  t.mock.timers.tick(15000);
  await rejected;
  assert.equal(adapter.frm.configure_breadcrumb_width, nativeTail);
});

test("unsafe render failure quarantines the Form rather than starting a recovery refresh", async (t) => {
  const { adapter } = setup(t);
  await adapter.open("A");
  let refreshes = 0;
  adapter.refreshAndWait = async () => {
    refreshes++;
    throw Object.assign(new Error("timed out"), { unsafeFormState: true });
  };
  adapter.renderFallback = () => {
    adapter.formUnusable = true;
    adapter.selectedName = null;
  };
  assert.equal(await adapter.open("B"), false);
  assert.equal(await adapter.open("C"), false);
  assert.equal(refreshes, 1);
  assert.equal(adapter.formUnusable, true);
});

test("Form Page remains authoritative during first asynchronous client hooks", (t) => {
  const { adapter, f, list } = setup(t);
  list.documentRoute.begin("A");
  const previousDocument = globalThis.document;
  globalThis.document = {
    body: {
      hasAttribute: () => false,
      getAttribute: () => null,
      removeAttribute() {},
    },
  };
  t.after(() => {
    globalThis.document = previousDocument;
  });
  const listPage = { list: true };
  const formPage = { form: true };
  f.ui = { pages: { "Form/ToDo/A": listPage } };
  f.container = { page: {} };
  adapter.ensureForm();
  adapter.restoreGlobalPageState(() => {
    adapter.frm.page = formPage;
    f.ui.pages["Form/ToDo/A"] = formPage;
  });
  assert.equal(f.ui.pages["Form/ToDo/A"], formPage);
});
