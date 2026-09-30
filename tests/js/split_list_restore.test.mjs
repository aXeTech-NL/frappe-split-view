import assert from "node:assert/strict";
import test from "node:test";

const nativeCalls = [];
globalThis.frappe = {
  views: {
    ListView: class {
      setup_defaults() {
        this.filters = [["ToDo", "status", "=", "Closed"]];
        this.sort_by = "modified";
        this.sort_order = "desc";
        this.page_length = 100;
        this.selected_page_count = 100;
        return Promise.resolve();
      }
      set_breadcrumbs() {
        nativeCalls.push("breadcrumbs");
        // Frappe's breadcrumb renderer reads the document on a Form route.
        // A cold Split shell has not fetched it yet.
        if (frappe.get_route()[0] === "Form") return frappe.get_doc().name;
      }
      before_refresh() {
        nativeCalls.push("before_refresh");
        return Promise.resolve();
      }
      update_url_with_filters() {
        nativeCalls.push("update_url");
      }
      setup_paging_area() {
        nativeCalls.push("paging");
      }
      process_document_refreshes() {
        nativeCalls.push("realtime");
      }
    },
  },
};
const { SplitView } =
  await import("../../frappe_split_view/public/js/split_view/split_view.js");

function fixture() {
  nativeCalls.length = 0;
  const state = {
    filters: [],
    sortBy: "name",
    sortOrder: "asc",
    pageLength: 40,
    pageCount: 20,
    scrollTop: 10,
    resultScrollTop: 200,
  };
  globalThis.window = {
    location: { search: "?split_view=1" },
    history: { state: null },
    sessionStorage: { getItem: () => JSON.stringify(state) },
  };
  frappe.get_route = () => ["Form", "ToDo", "A"];
  frappe.route_options = { split_view: "1", scroll_to: "priority" };
  const list = Object.assign(Object.create(SplitView.prototype), {
    doctype: "ToDo",
    documentRoute: {
      isActive: () => true,
      persist: () => nativeCalls.push("persist"),
    },
  });
  return { list, state };
}

test("restore overrides saved/default settings, including intentionally empty filters", async () => {
  const { list, state } = fixture();
  await list.setup_defaults();
  assert.deepEqual(list.filters, []);
  assert.equal(list.sort_by, state.sortBy);
  assert.equal(list.sort_order, state.sortOrder);
  assert.equal(list.page_length, 40);
  assert.equal(list.selected_page_count, 20);
  assert.equal(list.page_name, "List/ToDo/Split");
  await list.before_refresh();
  assert.deepEqual(nativeCalls, []);
  assert.deepEqual(frappe.route_options, {
    split_view: "1",
    scroll_to: "priority",
  });
});

test("cold document route leaves breadcrumbs to the Form without reading an unloaded document", () => {
  const { list } = fixture();
  frappe.get_doc = () => null;
  assert.doesNotThrow(() => list.set_breadcrumbs());
  assert.deepEqual(nativeCalls, []);
  assert.deepEqual(frappe.get_route(), ["Form", "ToDo", "A"]);

  frappe.get_route = () => ["List", "ToDo", "Split"];
  list.set_breadcrumbs();
  assert.deepEqual(nativeCalls, ["breadcrumbs"]);
});

test("Close restores list breadcrumbs after a document-first entry", () => {
  const { list } = fixture();
  list.splitFormAdapter = { close: () => true };
  list.documentRoute.close = () => {
    frappe.get_route = () => ["List", "ToDo", "Split"];
  };
  list.detailPane = { hidden: false };
  list.splitRoot = { classList: { remove() {} } };
  assert.equal(list.closeDetail(), true);
  assert.equal(list.detailPane.hidden, true);
  assert.deepEqual(nativeCalls, ["breadcrumbs"]);
});

test("restored paging control highlights batch size rather than total loaded range", async () => {
  const { list } = fixture();
  await list.setup_defaults();
  const selectors = [];
  const chain = {
    removeClass() {
      return this;
    },
    addClass() {
      return this;
    },
    prop() {
      return this;
    },
  };
  list.$paging_area = {
    find: (selector) => {
      selectors.push(selector);
      return chain;
    },
  };
  list.setup_paging_area();
  assert.deepEqual(selectors, [".btn-paging", '.btn-paging[data-value="20"]']);
});

test("list refresh persists state without rewriting the document URL", () => {
  const { list } = fixture();
  list.update_url_with_filters();
  assert.deepEqual(nativeCalls, ["persist"]);
  frappe.get_route = () => ["List", "ToDo", "Split"];
  list.update_url_with_filters();
  assert.deepEqual(nativeCalls, ["persist", "update_url", "persist"]);
});

test("visible embedded list processes realtime notifications instead of unsubscribing", () => {
  const { list } = fixture();
  list.pending_document_refreshes = [{ name: "A" }];
  list.refresh = () => nativeCalls.push("refresh");
  list.process_document_refreshes();
  assert.deepEqual(nativeCalls, ["refresh"]);
  assert.deepEqual(list.pending_document_refreshes, []);
  list.process_document_refreshes();
  assert.deepEqual(nativeCalls, ["refresh"]);
  frappe.get_route = () => ["List", "ToDo", "Split"];
  list.process_document_refreshes();
  assert.deepEqual(nativeCalls, ["refresh", "realtime"]);
});
