// SPDX-License-Identifier: MIT

import { splitViewEligibilityReason } from "./split_view_state.js";

// Private API adapter tested against Frappe 6a329d068416768ec47ccd3326b9cc95a8d7bf99.
// Frappe v16 has no third-party view registration API and ListViewSelect closes over
// its view definition map. Every mutation below is feature-detected and reversible by reload.
export const TESTED_FRAPPE_COMMIT = "6a329d068416768ec47ccd3326b9cc95a8d7bf99";
const PATCH_FLAG = Symbol.for("frappe_split_view.v16_selector_patch");
const DEFAULT_VIEW_PATCH_FLAG = Symbol.for(
  "frappe_split_view.v16_default_view_patch",
);
const ROUTE_PATCH_FLAG = Symbol.for("frappe_split_view.v16_route_patch");

export function appendSplitDefaultViewOption(options) {
  if (Array.isArray(options))
    return options.includes("Split") ? options : [...options, "Split"];
  if (typeof options !== "string") return options;
  const values = options.split(/\r?\n/);
  if (values.includes("Split")) return options;
  return `${options.replace(/\s+$/, "")}\nSplit`;
}

export function supportsSplitDefaultView(frappeObject, doctype) {
  return !splitViewEligibilityReason(frappeObject, doctype);
}

function defaultViewFormProxy(frappeObject, doctype, frm) {
  if (!frm || typeof frm.set_df_property !== "function") return frm;
  const proxy = Object.create(frm);
  proxy.set_df_property = function splitViewSetDfProperty(
    fieldname,
    property,
    value,
    ...args
  ) {
    if (
      fieldname === "default_view" &&
      property === "options" &&
      supportsSplitDefaultView(frappeObject, doctype)
    ) {
      value = appendSplitDefaultViewOption(value);
    }
    return frm.set_df_property.call(frm, fieldname, property, value, ...args);
  };
  return proxy;
}

function installDefaultViewCompatibility(frappeObject) {
  const { model } = frappeObject;
  if (model[DEFAULT_VIEW_PATCH_FLAG]) return;
  const nativeSetDefaultViews = model.set_default_views_for_doctype;
  model.set_default_views_for_doctype = function splitViewSetDefaultViews(
    doctype,
    frm,
    ...args
  ) {
    return nativeSetDefaultViews.call(
      this,
      doctype,
      defaultViewFormProxy(frappeObject, doctype, frm),
      ...args,
    );
  };
  Object.defineProperty(model, DEFAULT_VIEW_PATCH_FLAG, { value: true });
}

export function compatibilityStatus(frappeObject) {
  const views = frappeObject?.views;
  const router = frappeObject?.router;
  const Select = views?.ListViewSelect;
  const ListView = views?.ListView;
  const valid = Boolean(
    ListView &&
      typeof views?.BaseList?.prototype?.setup_main_section === "function" &&
      typeof frappeObject?.get_meta === "function" &&
      typeof frappeObject?.model?.is_single === "function" &&
      typeof frappeObject?.model?.set_default_views_for_doctype ===
        "function" &&
      Select?.prototype?.setup_views &&
      Select?.prototype?.add_view_to_menu &&
      Array.isArray(views?.view_modes) &&
      views.view_modes.includes("List") &&
      Array.isArray(router?.list_views) &&
      router.list_views.includes("list") &&
      router?.list_views_route?.list === "List" &&
      typeof router.set_route === "function" &&
      typeof router.get_route_from_arguments === "function" &&
      typeof router.convert_from_standard_route === "function" &&
      typeof router.make_url === "function",
  );
  return {
    valid,
    reason: valid
      ? null
      : "Required Frappe v16 ListView/router/default-view APIs are unavailable.",
  };
}

export function routeArgumentsToPath(router, args) {
  if (
    !router ||
    typeof router.get_route_from_arguments !== "function" ||
    typeof router.convert_from_standard_route !== "function" ||
    typeof router.make_url !== "function"
  ) {
    return null;
  }
  try {
    let route = router.get_route_from_arguments(Array.from(args));
    route = router.convert_from_standard_route(route);
    return router.make_url(route);
  } catch (_) {
    return null;
  }
}

export function encodeRouteOption(value) {
  const serialized =
    typeof value === "string" ? value : JSON.stringify(value);
  return encodeURIComponent(serialized);
}

export function installRouteCompatibility(
  frappeObject,
  getActiveOwner,
  browserWindow = globalThis.window,
) {
  const router = frappeObject?.router;
  if (
    !router ||
    typeof router.set_route !== "function" ||
    typeof getActiveOwner !== "function"
  ) {
    return {
      valid: false,
      reason: "Required Frappe v16 router APIs are unavailable.",
    };
  }
  if (router[ROUTE_PATCH_FLAG]) return { valid: true, reason: null };

  const nativeSetRoute = router.set_route;
  router.set_route = function splitViewSetRouteBoundary(...args) {
    const owner = getActiveOwner();
    if (!owner) return nativeSetRoute.apply(this, args);
    try {
      let path = routeArgumentsToPath(this, args);
      if (!path || (path !== "/desk" && !String(path).startsWith("/desk/"))) {
        owner.onUnsafeRoute?.();
        return Promise.resolve(false);
      }
      const routeHash = frappeObject.route_hash || "";
      if (frappeObject.open_in_new_tab) {
        if (
          !browserWindow?.localStorage ||
          typeof browserWindow.open !== "function"
        ) {
          owner.onUnsafeRoute?.();
          return Promise.resolve(false);
        }
        browserWindow.localStorage.route_options = JSON.stringify(
          frappeObject.route_options,
        );
        browserWindow.open(`${path}${routeHash}`, "_blank");
        return Promise.resolve(true);
      }
      const routeOptions = frappeObject.route_options || {};
      const query = Object.entries(routeOptions)
        .map(
          ([key, value]) =>
            `${encodeURIComponent(key)}=${encodeRouteOption(value)}`,
        )
        .join("&");
      if (query) path += `${path.includes("?") ? "&" : "?"}${query}`;
      path += routeHash;
      return Promise.resolve(owner.onRoute(path));
    } finally {
      // Match native set_route cleanup even for a blocked or hard-routed call.
      frappeObject.route_flags = {};
      frappeObject.route_options = null;
      frappeObject.route_hash = null;
      frappeObject.open_in_new_tab = false;
    }
  };
  Object.defineProperty(router, ROUTE_PATCH_FLAG, { value: true });
  return { valid: true, reason: null };
}

export function installSelectorCompatibility(frappeObject) {
  const status = compatibilityStatus(frappeObject);
  if (!status.valid) return status;

  const { views, router } = frappeObject;
  if (
    (views.view_modes.includes("Split") &&
      !router.list_views.includes("split")) ||
    (!views.view_modes.includes("Split") &&
      router.list_views.includes("split")) ||
    (router.list_views_route.split && router.list_views_route.split !== "Split")
  ) {
    return {
      valid: false,
      reason: "Conflicting Split view compatibility state.",
    };
  }
  installDefaultViewCompatibility(frappeObject);
  const proto = views.ListViewSelect.prototype;
  if (!proto[PATCH_FLAG]) {
    const nativeSetupViews = proto.setup_views;
    proto.setup_views = function splitViewSetupViews() {
      const allModes = views.view_modes;
      // Native setup would dereference views.Split from its closed local map.
      views.view_modes = allModes.filter((mode) => mode !== "Split");
      try {
        nativeSetupViews.call(this);
      } finally {
        views.view_modes = allModes;
      }
      if (this.doctype !== "File" && this.current_view !== "Split") {
        this.add_view_to_menu("Split", () => this.set_route("split"));
      }
    };
    Object.defineProperty(proto, PATCH_FLAG, { value: true });
  }

  if (!views.view_modes.includes("Split")) views.view_modes.push("Split");
  if (!router.list_views.includes("split")) router.list_views.push("split");
  if (!router.list_views_route.split) router.list_views_route.split = "Split";
  return { valid: true, reason: null };
}
