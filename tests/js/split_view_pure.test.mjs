import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LIST_WIDTH,
  MAX_LIST_WIDTH,
  MIN_LIST_WIDTH,
  clampListWidth,
  isNarrowViewport,
  isPrimaryActivation,
  splitViewEligibilityReason,
  unsupportedMetaReason,
} from "../../frappe_split_view/public/js/split_view/split_view_state.js";
import {
  canonicalFormPath,
  isCanonicalRecordAnchor,
  isDeskNavigation,
  shouldCaptureFormLink,
} from "../../frappe_split_view/public/js/split_view/split_view_router.js";
import { normalizeEmbeddedDocumentTitle } from "../../frappe_split_view/public/js/split_view/split_form_adapter.js";
import {
  appendSplitDefaultViewOption,
  compatibilityStatus,
  encodeRouteOption,
  installRouteCompatibility,
  installSelectorCompatibility,
  routeArgumentsToPath,
  supportsSplitDefaultView,
} from "../../frappe_split_view/public/js/split_view/compatibility.js";

const locationObject = {
  href: "https://example.test/desk/todo/view/split",
  origin: "https://example.test",
};
const anchor = (href, { target = "", download = false } = {}) => ({
  href,
  hasAttribute: (name) => name === "download" && download,
  getAttribute: (name) => {
    if (name === "target") return target;
    if (name === "href") return href;
    return null;
  },
});

test("bounded divider state", () => {
  assert.equal(clampListWidth("invalid"), DEFAULT_LIST_WIDTH);
  assert.equal(clampListWidth(1), MIN_LIST_WIDTH);
  assert.equal(clampListWidth(9999), MAX_LIST_WIDTH);
  assert.equal(isNarrowViewport(899), true);
  assert.equal(isNarrowViewport(900), false);
});

test("unsupported metadata decisions fail closed", () => {
  assert.equal(unsupportedMetaReason(null), "missing-meta");
  assert.equal(unsupportedMetaReason({ istable: 1 }), "table");
  assert.equal(unsupportedMetaReason({ is_tree: 1 }), null);
  assert.equal(unsupportedMetaReason({}, { isSingle: true }), "single");
  assert.equal(unsupportedMetaReason({}, {}), null);
  const frappeObject = {
    get_meta: () => ({}),
    treeview_settings: {},
    router: {},
    model: { is_single: () => false, with_doc() {} },
    ui: { form: { Form: class {} } },
    after_ajax() {},
  };
  assert.equal(splitViewEligibilityReason(frappeObject, "ToDo"), null);
  frappeObject.router.doctype_layout = "custom-layout";
  assert.equal(
    splitViewEligibilityReason(frappeObject, "ToDo"),
    "custom-layout",
  );
  delete frappeObject.router.doctype_layout;
  delete frappeObject.ui.form.Form;
  assert.equal(
    splitViewEligibilityReason(frappeObject, "ToDo"),
    "unavailable-api",
  );
});

test("only ordinary primary activation is intercepted", () => {
  assert.equal(isPrimaryActivation({ button: 0 }), true);
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
    assert.equal(isPrimaryActivation({ button: 0, [modifier]: true }), false);
  }
  assert.equal(isPrimaryActivation({ button: 1 }), false);
});

test("form-host capture preserves modified, non-left, download, and non-self targets", () => {
  const ordinary = { button: 0 };
  const desk = anchor("https://example.test/desk/todo/ABC");
  assert.equal(shouldCaptureFormLink(ordinary, desk, locationObject), true);
  assert.equal(
    shouldCaptureFormLink(
      ordinary,
      anchor(desk.href, { target: "_self" }),
      locationObject,
    ),
    true,
  );
  for (const modifier of ["ctrlKey", "metaKey", "shiftKey", "altKey"]) {
    assert.equal(
      shouldCaptureFormLink(
        { button: 0, [modifier]: true },
        desk,
        locationObject,
      ),
      false,
    );
  }
  assert.equal(
    shouldCaptureFormLink({ button: 1 }, desk, locationObject),
    false,
  );
  assert.equal(
    shouldCaptureFormLink(
      ordinary,
      anchor(desk.href, { download: true }),
      locationObject,
    ),
    false,
  );
  for (const target of ["_blank", "report-frame", "_parent", "_top"]) {
    assert.equal(
      shouldCaptureFormLink(
        ordinary,
        anchor(desk.href, { target }),
        locationObject,
      ),
      false,
    );
  }
  assert.equal(
    shouldCaptureFormLink(
      ordinary,
      anchor("https://elsewhere.test/desk/todo/ABC"),
      locationObject,
    ),
    false,
  );
});

test("canonical list activation preserves custom form-link pathnames", () => {
  assert.equal(
    isCanonicalRecordAnchor(
      anchor("https://example.test/desk/todo/ABC?x=1"),
      "/desk/todo/ABC",
      locationObject,
    ),
    true,
  );
  assert.equal(
    isCanonicalRecordAnchor(
      anchor("https://example.test/desk/custom/ABC"),
      "/desk/todo/ABC",
      locationObject,
    ),
    false,
  );
});

test("canonical hard-boundary helpers", () => {
  const frappeObject = {
    utils: { get_form_link: (doctype, name) => `/desk/${doctype}/${name}` },
  };
  assert.equal(
    canonicalFormPath(frappeObject, "ToDo", "ABC"),
    "/desk/ToDo/ABC",
  );
  const desk = anchor("https://example.test/desk/todo/ABC");
  assert.equal(isDeskNavigation(desk, locationObject), true);
  assert.equal(
    isDeskNavigation(
      anchor("https://example.test/desk/todo/view/split#menu"),
      locationObject,
    ),
    false,
  );
  assert.equal(isDeskNavigation(anchor("#"), locationObject), false);
});

test("route option encoding keeps scalar filters raw and structured filters JSON", () => {
  assert.equal(encodeRouteOption("Open"), "Open");
  assert.equal(encodeRouteOption("User Name"), "User%20Name");
  assert.equal(
    encodeRouteOption(["in", ["Open", "Closed"]]),
    "%5B%22in%22%2C%5B%22Open%22%2C%22Closed%22%5D%5D",
  );
});

test("route conversion uses the stock router helper sequence", () => {
  const calls = [];
  const router = {
    get_route_from_arguments: (args) => (calls.push("arguments"), args),
    convert_from_standard_route: (route) => (
      calls.push("convert"),
      route.map(String)
    ),
    make_url: (route) => (calls.push("url"), `/desk/${route.join("/")}`),
  };
  assert.equal(
    routeArgumentsToPath(router, ["Form", "ToDo", "ABC"]),
    "/desk/Form/ToDo/ABC",
  );
  assert.deepEqual(calls, ["arguments", "convert", "url"]);
  assert.equal(routeArgumentsToPath({}, ["Form"]), null);
});

test("route compatibility wrapper is active-owner-only and idempotent", async () => {
  let nativeCalls = 0;
  let activeOwner = null;
  const router = {
    set_route() {
      nativeCalls += 1;
      return "native";
    },
    get_route_from_arguments: (args) => args,
    convert_from_standard_route: (route) => route,
    make_url: (route) => `/desk/${route.join("/")}`,
  };
  const frappeObject = {
    router,
    route_flags: { test: true },
    route_options: {
      status: "Open",
      priority: ["in", ["High", "Low"]],
    },
    route_hash: "#section",
  };
  const openedTabs = [];
  const browserWindow = {
    localStorage: {},
    open: (...args) => openedTabs.push(args),
  };
  assert.equal(
    installRouteCompatibility(frappeObject, () => activeOwner, browserWindow)
      .valid,
    true,
  );
  const wrapped = router.set_route;
  assert.equal(
    installRouteCompatibility(frappeObject, () => activeOwner).valid,
    true,
  );
  assert.equal(router.set_route, wrapped);
  assert.equal(await router.set_route("List", "ToDo"), "native");
  assert.equal(nativeCalls, 1);
  let delegatedPath;
  activeOwner = {
    onRoute: (path) => {
      delegatedPath = path;
      return true;
    },
  };
  assert.equal(await router.set_route("Form", "ToDo", "ABC"), true);
  assert.equal(
    delegatedPath,
    "/desk/Form/ToDo/ABC?status=Open&priority=%5B%22in%22%2C%5B%22High%22%2C%22Low%22%5D%5D#section",
  );
  assert.equal(nativeCalls, 1);
  assert.deepEqual(frappeObject.route_flags, {});
  assert.equal(frappeObject.route_options, null);
  assert.equal(frappeObject.route_hash, null);
  assert.equal(frappeObject.open_in_new_tab, false);

  delegatedPath = null;
  frappeObject.route_flags = { test: true };
  frappeObject.route_options = { priority: "High" };
  frappeObject.route_hash = "#details";
  frappeObject.open_in_new_tab = true;
  assert.equal(await router.set_route("Form", "ToDo", "XYZ"), true);
  assert.equal(delegatedPath, null);
  assert.deepEqual(openedTabs, [["/desk/Form/ToDo/XYZ#details", "_blank"]]);
  assert.equal(
    browserWindow.localStorage.route_options,
    JSON.stringify({ priority: "High" }),
  );
  assert.deepEqual(frappeObject.route_flags, {});
  assert.equal(frappeObject.route_options, null);
  assert.equal(frappeObject.route_hash, null);
  assert.equal(frappeObject.open_in_new_tab, false);
});

function compatibleFrappe(overrides = {}) {
  const frappeObject = {
    get_meta: () => ({}),
    treeview_settings: {},
    after_ajax() {},
    ui: { form: { Form: class {} } },
    model: {
      is_single: () => false,
      with_doc() {},
      set_default_views_for_doctype(doctype, frm) {
        return frm.set_df_property("default_view", "options", [
          "List",
          "Report",
        ]);
      },
    },
    views: {
      BaseList: class {},
      ListView: class {},
      ListViewSelect: class {},
      view_modes: ["List"],
    },
    router: {
      list_views: ["list"],
      list_views_route: { list: "List" },
      set_route() {},
      get_route_from_arguments() {},
      convert_from_standard_route() {},
      make_url() {},
    },
    ...overrides,
  };
  frappeObject.views.BaseList.prototype.setup_main_section = () => {};
  frappeObject.views.ListViewSelect.prototype.setup_views = () => {};
  frappeObject.views.ListViewSelect.prototype.add_view_to_menu = () => {};
  return frappeObject;
}

test("compatibility gate fails closed", () => {
  assert.equal(compatibilityStatus({}).valid, false);
  const frappeObject = compatibleFrappe();
  assert.equal(compatibilityStatus(frappeObject).valid, true);
  delete frappeObject.model.set_default_views_for_doctype;
  assert.equal(compatibilityStatus(frappeObject).valid, false);
  assert.deepEqual(frappeObject.views.view_modes, ["List"]);
});

test("embedded document title replaces host breadcrumbs with plain text", () => {
  const elements = [];
  const ownerDocument = {
    createElement(tagName) {
      const element = {
        tagName,
        className: "",
        dataset: {},
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
        append(child) {
          this.child = child;
        },
      };
      elements.push(element);
      return element;
    },
  };
  let replacement;
  const host = {
    ownerDocument,
    querySelectorAll: () => [
      {
        replaceChildren(item) {
          replacement = item;
        },
      },
    ],
  };
  assert.equal(
    normalizeEmbeddedDocumentTitle(host, "Selected <Project>"),
    true,
  );
  assert.equal(replacement.tagName, "li");
  assert.equal(replacement.child.textContent, "Selected <Project>");
  assert.equal(replacement.child.dataset.splitDocumentTitle, "");
  assert.equal(replacement.child.attributes["aria-current"], "page");
  assert.equal(elements.length, 2);
  assert.equal(normalizeEmbeddedDocumentTitle(host, ""), false);
});

test("default view option helpers preserve stock options and exclusions", () => {
  const stock = ["List", "Report"];
  assert.deepEqual(appendSplitDefaultViewOption(stock), [
    "List",
    "Report",
    "Split",
  ]);
  assert.deepEqual(stock, ["List", "Report"]);
  assert.deepEqual(appendSplitDefaultViewOption(["List", "Split"]), [
    "List",
    "Split",
  ]);
  assert.equal(
    appendSplitDefaultViewOption("List\nReport"),
    "List\nReport\nSplit",
  );
  assert.equal(appendSplitDefaultViewOption("List\nSplit"), "List\nSplit");
  assert.equal(appendSplitDefaultViewOption(null), null);

  const frappeObject = compatibleFrappe();
  assert.equal(supportsSplitDefaultView(frappeObject, "ToDo"), true);
  assert.equal(supportsSplitDefaultView(frappeObject, "File"), false);
  frappeObject.get_meta = () => ({ istable: 1 });
  assert.equal(supportsSplitDefaultView(frappeObject, "Child Row"), false);
  frappeObject.get_meta = () => ({ is_tree: 1 });
  assert.equal(supportsSplitDefaultView(frappeObject, "Account"), true);
  frappeObject.get_meta = () => ({});
  frappeObject.treeview_settings.Account = {};
  assert.equal(supportsSplitDefaultView(frappeObject, "Account"), true);
  frappeObject.model.is_single = () => true;
  assert.equal(
    supportsSplitDefaultView(frappeObject, "System Settings"),
    false,
  );
});

test("selector compatibility adds Split once to normal DocType default views", () => {
  const frappeObject = compatibleFrappe();
  assert.equal(installSelectorCompatibility(frappeObject).valid, true);
  const wrapped = frappeObject.model.set_default_views_for_doctype;
  assert.equal(installSelectorCompatibility(frappeObject).valid, true);
  assert.equal(frappeObject.model.set_default_views_for_doctype, wrapped);

  let captured;
  const frm = {
    set_df_property(fieldname, property, options) {
      captured = { fieldname, property, options };
      return "native-result";
    },
  };
  assert.equal(
    frappeObject.model.set_default_views_for_doctype("ToDo", frm),
    "native-result",
  );
  assert.deepEqual(captured, {
    fieldname: "default_view",
    property: "options",
    options: ["List", "Report", "Split"],
  });
  frappeObject.model.set_default_views_for_doctype("ToDo", frm);
  assert.deepEqual(captured.options, ["List", "Report", "Split"]);
  frappeObject.get_meta = () => ({ is_tree: 1 });
  frappeObject.model.set_default_views_for_doctype("Account", frm);
  assert.deepEqual(captured.options, ["List", "Report", "Split"]);
  assert.deepEqual(frappeObject.views.view_modes, ["List", "Split"]);
  assert.deepEqual(frappeObject.router.list_views, ["list", "split"]);
  assert.equal(frappeObject.router.list_views_route.split, "Split");

  frappeObject.model.set_default_views_for_doctype("File", frm);
  assert.deepEqual(captured.options, ["List", "Report"]);
});

test("default view eligibility remains invocation-scoped across async callbacks", () => {
  const frappeObject = compatibleFrappe();
  const pending = [];
  frappeObject.get_meta = (doctype) =>
    doctype === "Child Row" ? { istable: 1 } : {};
  frappeObject.model.set_default_views_for_doctype = (doctype, frm) => {
    pending.push({
      doctype,
      run: () => frm.set_df_property("default_view", "options", ["List"]),
    });
    return doctype;
  };
  assert.equal(installSelectorCompatibility(frappeObject).valid, true);

  const captured = [];
  const nativeSetDfProperty = function (fieldname, property, options) {
    captured.push({ fieldname, property, options });
  };
  const frm = { set_df_property: nativeSetDfProperty };
  assert.equal(
    frappeObject.model.set_default_views_for_doctype("ToDo", frm),
    "ToDo",
  );
  assert.equal(
    frappeObject.model.set_default_views_for_doctype("Child Row", frm),
    "Child Row",
  );
  assert.equal(frm.set_df_property, nativeSetDfProperty);

  pending.find(({ doctype }) => doctype === "Child Row").run();
  pending.find(({ doctype }) => doctype === "ToDo").run();
  assert.deepEqual(captured[0].options, ["List"]);
  assert.deepEqual(captured[1].options, ["List", "Split"]);
});
