import assert from "node:assert/strict";
import test from "node:test";
import {
  SplitDocumentRoute,
  installDocumentRouteCompatibility,
  isSplitDocumentRoute,
  readListState,
  splitDocumentPath,
  validListState,
} from "../../frappe_split_view/public/js/split_view/split_document_route.js";

function fixture() {
  const entries = [
    {
      url: "https://example.test/desk/todo/view/split?status=Open",
      state: null,
    },
  ];
  let position = 0;
  let reloads = 0;
  const events = {};
  const storage = new Map();
  const attributes = {};
  const browser = {
    get location() {
      const url = new URL(entries[position].url);
      url.reload = () => {
        reloads += 1;
      };
      return url;
    },
    document: {
      body: {
        setAttribute: (key, value) => {
          attributes[key] = value;
        },
      },
    },
    innerWidth: 1200,
    addEventListener: (name, callback) => {
      events[name] = callback;
    },
    sessionStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    history: {
      get state() {
        return entries[position].state;
      },
      replaceState(state, _, path) {
        entries[position] = {
          state: structuredClone(state),
          url: path
            ? new URL(path, browser.location.href).href
            : browser.location.href,
        };
      },
      pushState(state, _, path) {
        const url = new URL(path, browser.location.href).href;
        entries.splice(++position, entries.length, {
          state: structuredClone(state),
          url,
        });
      },
      go(delta) {
        position += delta;
      },
    },
  };
  const f = {
    session: { user: "user@example.test" },
    get_meta: () => ({}),
    model: { is_single: () => false, with_doc() {} },
    after_ajax() {},
    ui: { pages: {}, form: { Form: class {} } },
    route_history: [],
    make_page() {},
    utils: {
      get_form_link: (doctype, name) =>
        `/desk/${doctype.toLowerCase()}/${encodeURIComponent(name)}`,
      set_title() {},
    },
    router: {
      current_route: ["List", "ToDo", "Split"],
      get_sub_path: () =>
        decodeURIComponent(browser.location.pathname.replace("/desk/", "")),
      trigger() {},
      convert_from_standard_route: () => ["todo", "view", "split"],
      make_url: (route) => `/desk/${route.join("/")}`,
    },
    get_route: () => f.router.current_route,
  };
  let dirty = false;
  const list = {
    doctype: "ToDo",
    parent: {},
    page: { wrapper: { is: () => true } },
    splitFormAdapter: {
      frm: { page: { form: true } },
      guardDirty: () => !dirty,
      isDirty: () => dirty,
    },
    filter_area: {
      get: () => [
        ["ToDo", "status", "=", "Open"],
        ["Child", "value", "in", ["one", "two"]],
      ],
    },
    sort_selector: { sort_by: "priority", sort_order: "asc" },
    start: 0,
    page_length: 40,
    selected_page_count: 20,
    data: Array(40),
    splitRoot: { querySelector: () => ({ scrollTop: 60 }) },
    $frappe_list: { find: () => ({ get: () => ({ scrollTop: 120 }) }) },
    get_search_params: () => new URLSearchParams("status=Open"),
  };
  const controller = new SplitDocumentRoute(list, f, browser);
  return {
    controller,
    list,
    f,
    browser,
    entries,
    events,
    attributes,
    storage,
    setDirty: (value) => {
      dirty = value;
    },
    getReloads: () => reloads,
  };
}

test("only explicitly marked document routes opt in; names are encoded once", () => {
  const { f } = fixture();
  assert.equal(
    isSplitDocumentRoute(["Form", "ToDo", "ABC"], "?split_view=1"),
    true,
  );
  assert.equal(
    isSplitDocumentRoute(["List", "ToDo", "Split"], "?split_view=1"),
    false,
  );
  assert.equal(isSplitDocumentRoute(["Form", "ToDo", "ABC"], ""), false);
  assert.equal(
    isSplitDocumentRoute(["Form", "ToDo", "ABC"], "?split_view=0"),
    false,
  );
  assert.equal(
    splitDocumentPath(f, "ToDo", "name / #?%é"),
    "/desk/todo/name%20%2F%20%23%3F%25%C3%A9?split_view=1",
  );
});

test("document context precedes render; commit keeps one list and records history", () => {
  const { controller, list, f, browser, entries, attributes } = fixture();
  const data = list.data;
  const previous = controller.begin("A");
  assert.deepEqual(f.get_route(), ["Form", "ToDo", "A"]);
  assert.equal(attributes["data-route"], "Form/ToDo/A");
  assert.equal(browser.location.pathname, "/desk/todo/A");
  assert.equal(entries.length, 1, "pending render does not add history");
  controller.commit(previous);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].url, previous.url);
  assert.equal(browser.location.search, "?split_view=1");
  assert.equal(f.ui.pages["Form/ToDo/A"], list.splitFormAdapter.frm.page);
  controller.commit(controller.begin("B"));
  assert.equal(entries.length, 3);
  assert.equal(list.data, data);
  assert.equal(browser.location.pathname, "/desk/todo/B");
  assert.equal(entries[2].state.frappeSplitView.index, 2);
  controller.close();
  assert.deepEqual(f.get_route(), ["List", "ToDo", "Split"]);
  assert.equal(f.ui.pages["List/ToDo/Split"], list.page);
  assert.equal(browser.location.search, "?status=Open");
  assert.equal(list.data, data);
});

test("failed activation restores URL, Frappe context and history without an extra entry", () => {
  const { controller, f, browser, entries } = fixture();
  controller.commit(controller.begin("A"));
  const previous = controller.begin("missing");
  controller.rollback(previous);
  assert.equal(entries.length, 2);
  assert.deepEqual(f.get_route(), ["Form", "ToDo", "A"]);
  assert.equal(browser.location.pathname, "/desk/todo/A");
});

test("reload snapshot keeps compound filters, ordering, loaded page count and both scroll positions", () => {
  const { controller, f, browser } = fixture();
  controller.commit(controller.begin("A"));
  const expected = controller.capture();
  assert.equal(validListState(expected), true);
  assert.deepEqual(readListState(f, "ToDo", browser), expected);
  // History survives disabled sessionStorage.
  browser.sessionStorage.getItem = () => {
    throw new Error("disabled");
  };
  browser.sessionStorage.setItem = () => {
    throw new Error("disabled");
  };
  assert.doesNotThrow(() => controller.persist());
  assert.deepEqual(readListState(f, "ToDo", browser), expected);
  assert.equal(readListState(f, "Other", browser), null);
  assert.equal(validListState({ ...expected, filters: ["invalid"] }), false);
  assert.equal(validListState({ ...expected, pageLength: -1 }), false);
  assert.equal(validListState({ ...expected, sortOrder: "invalid" }), false);
});

test("session snapshot is scoped to the user and never applied to an ordinary list entry", () => {
  const { controller, f, browser } = fixture();
  controller.commit(controller.begin("A"));
  browser.history.replaceState(null, "");
  assert.deepEqual(readListState(f, "ToDo", browser), controller.capture());
  f.session.user = "someone-else";
  assert.equal(readListState(f, "ToDo", browser), null);
  f.session.user = "user@example.test";
  f.router.current_route = ["List", "ToDo", "Split"];
  assert.equal(readListState(f, "ToDo", browser), null);
});

test("dirty Back is reversed before Desk sees it; clean Back reloads without overwriting destination state", () => {
  const { controller, list, browser, events, setDirty, getReloads } = fixture();
  controller.commit(controller.begin("A"));
  controller.commit(controller.begin("B"));
  let stopped = 0;
  const pop = () =>
    events.popstate({
      state: browser.history.state,
      stopImmediatePropagation: () => {
        stopped++;
      },
    });
  setDirty(true);
  browser.history.go(-1);
  pop();
  assert.equal(browser.location.pathname, "/desk/todo/B");
  pop(); // the compensating history.go event
  assert.equal(stopped, 2);
  assert.equal(getReloads(), 0);
  setDirty(false);
  list.filter_area.get = () => [];
  browser.history.go(-1);
  const destination = structuredClone(browser.history.state);
  pop();
  events.beforeunload({});
  events.pagehide();
  assert.equal(getReloads(), 1);
  assert.deepEqual(browser.history.state, destination);
});

test("dirty Back never subtracts history indices from a different chain", () => {
  const { controller, browser, entries, events, setDirty, getReloads } =
    fixture();
  controller.commit(controller.begin("A"));
  controller.commit(controller.begin("B"));
  entries[1].state.frappeSplitView.chain = "unrelated-split-chain";
  entries[1].state.frappeSplitView.index = 42;
  setDirty(true);
  browser.history.go(-1);
  events.popstate({
    state: browser.history.state,
    stopImmediatePropagation() {},
  });
  assert.equal(browser.location.pathname, "/desk/todo/B");
  assert.equal(browser.history.state.frappeSplitView.chain, controller.chain);
  assert.equal(getReloads(), 0);
});

test("cancelled activation leaves only committed document history before Close", () => {
  const { controller, browser, entries } = fixture();
  controller.commit(controller.begin("A"));
  const pending = controller.begin("B");
  controller.rollback(pending);
  controller.close();
  assert.equal(browser.location.pathname, "/desk/todo/view/split");
  assert.deepEqual(
    entries.map((entry) => new URL(entry.url).pathname),
    ["/desk/todo/view/split", "/desk/todo/A", "/desk/todo/view/split"],
  );
});

test("beforeunload protects unsaved changes and persists list state", () => {
  const { events, setDirty, browser } = fixture();
  setDirty(true);
  let prevented = false;
  const event = {
    preventDefault: () => {
      prevented = true;
    },
  };
  events.beforeunload(event);
  assert.equal(prevented, true);
  assert.equal(event.returnValue, "");
  assert.equal(
    validListState(browser.history.state.frappeSplitView.list),
    true,
  );
});

test("router restores marked documents without FormFactory; native, unsupported and narrow routes stay native", () => {
  const { f, browser } = fixture();
  let native = 0;
  let split = 0;
  f.router.render_page = () => {
    native++;
  };
  const show = (route) => {
    split++;
    assert.deepEqual(route, ["Form", "ToDo", "A"]);
  };
  assert.equal(installDocumentRouteCompatibility(f, show, browser).valid, true);
  const installed = f.router.render_page;
  assert.equal(installDocumentRouteCompatibility(f, show, browser).valid, true);
  assert.equal(f.router.render_page, installed);
  f.router.render_page();
  assert.equal(native, 1);
  f.router.current_route = ["Form", "ToDo", "A"];
  f.router.render_page();
  assert.equal(native, 2);
  browser.history.replaceState(null, "", "/desk/todo/A?split_view=1");
  f.route_options = { split_view: "1", scroll_to: "priority" };
  f.router.render_page();
  assert.equal(split, 1);
  assert.deepEqual(f.route_options, { scroll_to: "priority" });
  browser.innerWidth = 800;
  f.router.render_page();
  assert.equal(native, 3);
  assert.equal(browser.location.search, "");
  browser.innerWidth = 1200;
  browser.history.replaceState(null, "", "/desk/todo/A?split_view=1");
  f.get_meta = () => ({ issingle: 1 });
  f.router.render_page();
  assert.equal(native, 4);
  assert.equal(split, 1);
});
