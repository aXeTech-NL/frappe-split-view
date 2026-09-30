import assert from "node:assert/strict";
import test from "node:test";

globalThis.frappe = { views: { ListView: class {} } };
const { SplitView } = await import(
  "../../frappe_split_view/public/js/split_view/split_view.js"
);

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.dataset = {};
    this.children = [];
    this.attributes = {};
  }

  append(...children) {
    for (const child of children) {
      if (child.parentElement) {
        const siblings = child.parentElement.children;
        siblings.splice(siblings.indexOf(child), 1);
      }
      child.parentElement = this;
      this.children.push(child);
    }
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  addEventListener() {}
}

const wrapped = (element) => ({ get: () => element, on() {} });

test("split layout retains the stock header and filters above both panes", (t) => {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    __: globalThis.__,
  };
  t.after(() => Object.assign(globalThis, previous));
  globalThis.document = { createElement: (tag) => new Element(tag) };
  globalThis.window = {
    history: { state: null },
    location: { href: "https://example.test/desk/todo/A?split_view=1" },
    addEventListener() {},
  };
  globalThis.__ = (text) => text;

  const page = new Element("section");
  const head = new Element("header");
  const body = new Element("div");
  const main = new Element("main");
  const filters = new Element("div");
  const results = new Element("div");
  page.append(head, body);
  body.append(main);
  main.append(filters, results);

  const view = Object.assign(Object.create(SplitView.prototype), {
    doctype: "ToDo",
    instanceId: 1,
    page: {
      main: wrapped(main),
      page_head: wrapped(head),
      page_form: wrapped(filters),
      wrapper: wrapped(page),
    },
    $frappe_list: { ...wrapped(results), find: () => wrapped(null) },
    applyStoredWidth() {},
    bindSplitEvents() {},
  });

  view.setupSplitLayout();
  const root = view.splitRoot;
  const [listPane, divider, detail] = root.children;
  assert.deepEqual(
    page.children,
    [head, body],
    "toolbar keeps its native page position",
  );
  assert.deepEqual(
    main.children,
    [filters, root],
    "filters precede the full split grid",
  );
  assert.deepEqual(
    listPane.children,
    [results],
    "only results/paging move into the list pane",
  );
  assert.equal(divider.dataset.splitViewDivider, "");
  assert.equal(detail, view.detailPane);
  assert.equal(
    view.formHost.parentElement,
    detail,
    "Form controls stay in the detail pane",
  );

  view.setupSplitLayout();
  assert.equal(view.splitRoot, root, "setup remains idempotent");
  assert.deepEqual(main.children, [filters, root]);
});
