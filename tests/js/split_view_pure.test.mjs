import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LIST_WIDTH,
  MAX_LIST_WIDTH,
  MIN_LIST_WIDTH,
  clampListWidth,
  isNarrowViewport,
  isPrimaryActivation,
  unsupportedMetaReason,
} from "../../frappe_split_view/public/js/split_view/split_view_state.js";
import {
  canonicalFormPath,
  isCanonicalRecordAnchor,
  isDeskNavigation,
  shouldCaptureFormLink,
} from "../../frappe_split_view/public/js/split_view/split_view_router.js";
import {
  compatibilityStatus,
  installRouteCompatibility,
  routeArgumentsToPath,
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
  assert.equal(unsupportedMetaReason({}, { isSingle: true }), "single");
  assert.equal(unsupportedMetaReason({}, {}), null);
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
    isDeskNavigation(anchor("https://example.test/desk/todo/view/split#menu"), locationObject),
    false,
  );
  assert.equal(isDeskNavigation(anchor("#"), locationObject), false);
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
    route_options: { status: "Open" },
    route_hash: "#section",
  };
  assert.equal(
    installRouteCompatibility(frappeObject, () => activeOwner).valid,
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
  assert.equal(delegatedPath, "/desk/Form/ToDo/ABC?status=%22Open%22#section");
  assert.equal(nativeCalls, 1);
  assert.deepEqual(frappeObject.route_flags, {});
  assert.equal(frappeObject.route_options, null);
  assert.equal(frappeObject.route_hash, null);
});

test("compatibility gate fails closed", () => {
  assert.equal(compatibilityStatus({}).valid, false);
  const frappeObject = {
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
  };
  frappeObject.views.BaseList.prototype.setup_main_section = () => {};
  frappeObject.views.ListViewSelect.prototype.setup_views = () => {};
  frappeObject.views.ListViewSelect.prototype.add_view_to_menu = () => {};
  assert.equal(compatibilityStatus(frappeObject).valid, true);
});
