// SPDX-License-Identifier: MIT

import { canonicalFormPath } from "./split_view_router.js";
import {
  isNarrowViewport,
  splitViewEligibilityReason,
} from "./split_view_state.js";

export const SPLIT_QUERY = "split_view";
const HISTORY_KEY = "frappeSplitView";
const PATCH = Symbol.for("frappe_split_view.document_route");

export function isSplitDocumentRoute(route, search) {
  return (
    route?.[0] === "Form" &&
    Boolean(route[1] && route[2]) &&
    new URLSearchParams(search).get(SPLIT_QUERY) === "1"
  );
}

export function splitDocumentPath(frappeObject, doctype, name) {
  const path = canonicalFormPath(frappeObject, doctype, name);
  return path
    ? `${path}${path.includes("?") ? "&" : "?"}${SPLIT_QUERY}=1`
    : null;
}

export function validListState(state) {
  return Boolean(
    state &&
    Array.isArray(state.filters) &&
    state.filters.every(
      (f) =>
        Array.isArray(f) &&
        f.length >= 4 &&
        f.slice(0, 3).every((v) => typeof v === "string"),
    ) &&
    typeof state.sortBy === "string" &&
    ["asc", "desc"].includes(state.sortOrder) &&
    Number.isInteger(state.pageLength) &&
    state.pageLength > 0 &&
    state.pageLength <= 100000 &&
    Number.isInteger(state.pageCount) &&
    state.pageCount > 0 &&
    state.pageCount <= 100000 &&
    Number.isFinite(state.scrollTop) &&
    state.scrollTop >= 0 &&
    Number.isFinite(state.resultScrollTop) &&
    state.resultScrollTop >= 0,
  );
}

function storageKey(frappeObject, doctype) {
  return `frappe-split-view:list:${frappeObject.session?.user || ""}:${doctype}`;
}

export function readListState(frappeObject, doctype, browser = window) {
  const entry = browser.history.state?.[HISTORY_KEY];
  if (
    entry?.doctype === doctype &&
    entry.user === (frappeObject.session?.user || "") &&
    validListState(entry.list)
  )
    return entry.list;
  if (!isSplitDocumentRoute(frappeObject.get_route(), browser.location.search))
    return null;
  try {
    const state = JSON.parse(
      browser.sessionStorage.getItem(storageKey(frappeObject, doctype)),
    );
    return validListState(state) ? state : null;
  } catch (_) {
    return null;
  }
}

// The URL and Frappe route are Form-owned. The cached ListView is only the
// layout host; it is never rebuilt or refreshed when the selected record changes.
export class SplitDocumentRoute {
  constructor(list, frappeObject = frappe, browser = window) {
    this.list = list;
    this.frappe = frappeObject;
    this.browser = browser;
    const entry = browser.history.state?.[HISTORY_KEY];
    this.chain =
      entry?.doctype === list.doctype &&
      entry.user === (frappeObject.session?.user || "") &&
      typeof entry.chain === "string"
        ? entry.chain
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.index =
      entry?.chain === this.chain && Number.isInteger(entry.index)
        ? entry.index
        : 0;
    this.url = browser.location.href;
    browser.addEventListener("pagehide", () => this.persist());
    browser.addEventListener("beforeunload", (event) => {
      if (!this.isActive()) return;
      this.persist();
      if (list.splitFormAdapter?.isDirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    // Capture before Desk's popstate listener: never let FormFactory create a
    // second live Form. Clean history traversal uses a reload; dirty traversal
    // returns to the original history entry without losing edits.
    browser.addEventListener(
      "popstate",
      (event) => this.onPopState(event),
      true,
    );
  }

  isActive() {
    return !this.departing && this.list.page?.wrapper?.is(":visible");
  }

  capture() {
    const list = this.list;
    return {
      filters: list.filter_area?.get() || [],
      sortBy: list.sort_selector?.sort_by || list.sort_by,
      sortOrder: list.sort_selector?.sort_order || list.sort_order,
      pageLength: Math.max(
        list.data?.length || 0,
        (list.start || 0) + list.page_length,
      ),
      pageCount: list.selected_page_count,
      scrollTop:
        list.splitRoot?.querySelector("[data-split-view-list]")?.scrollTop || 0,
      resultScrollTop:
        list.$frappe_list?.find(".result-container").get(0)?.scrollTop || 0,
    };
  }

  persist() {
    if (!this.isActive()) return;
    const state = this.capture();
    try {
      this.browser.sessionStorage.setItem(
        storageKey(this.frappe, this.list.doctype),
        JSON.stringify(state),
      );
    } catch (_) {
      // History state still restores this entry when storage is disabled.
    }
    this.browser.history.replaceState(
      {
        ...this.browser.history.state,
        [HISTORY_KEY]: {
          doctype: this.list.doctype,
          user: this.frappe.session?.user || "",
          chain: this.chain,
          index: this.index,
          list: state,
        },
      },
      "",
    );
    this.url = this.browser.location.href;
  }

  setContext(route) {
    const f = this.frappe;
    f.router.current_route = route;
    f.router.current_sub_path = f.router.get_sub_path();
    this.browser.document.body.setAttribute("data-route", route.join("/"));
    const page =
      route[0] === "Form"
        ? this.list.splitFormAdapter?.frm?.page
        : this.list.page;
    if (page) f.ui.pages[route.join("/")] = page;
    this.list.parent._route = f.router.current_sub_path;
  }

  begin(name) {
    this.persist();
    const previous = {
      url: this.browser.location.href,
      state: this.browser.history.state,
      route: [...this.frappe.get_route()],
    };
    const path = splitDocumentPath(this.frappe, this.list.doctype, name);
    if (!path) throw new Error("Canonical Form route is unavailable");
    // Tentative replace ensures client hooks see the document's URL/context.
    // Only commit a new history entry after the Form has rendered successfully.
    this.browser.history.replaceState(previous.state, "", path);
    this.setContext(["Form", this.list.doctype, name]);
    return previous;
  }

  commit(previous) {
    const url = this.browser.location.href;
    if (previous.url !== url) {
      this.browser.history.replaceState(previous.state, "", previous.url);
      this.browser.history.pushState(previous.state, "", url);
      this.index += 1;
    }
    this.setContext(this.frappe.get_route());
    this.persist();
    this.frappe.route_history.push([...this.frappe.get_route()]);
    this.frappe.router.trigger("change", this.frappe.router);
  }

  rollback(previous) {
    if (!previous) return;
    this.browser.history.replaceState(previous.state, "", previous.url);
    this.setContext(previous.route);
    this.url = previous.url;
  }

  close() {
    const f = this.frappe;
    const route = ["List", this.list.doctype, "Split"];
    const path = f.router.make_url(f.router.convert_from_standard_route(route));
    const query = this.list.get_search_params().toString();
    this.persist();
    this.browser.history.pushState(
      this.browser.history.state,
      "",
      `${path}${query ? `?${query}` : ""}`,
    );
    this.index += 1;
    this.setContext(route);
    this.persist();
    f.utils.set_title(this.list.page_title);
    f.route_history.push(route);
    f.router.trigger("change", f.router);
  }

  onPopState(event) {
    if (!this.isActive()) return;
    event.stopImmediatePropagation();
    if (this.reverting) {
      this.reverting = false;
      return;
    }
    const adapter = this.list.splitFormAdapter;
    if (!adapter?.guardDirty()) {
      const target = event.state?.[HISTORY_KEY];
      const targetIndex = target?.index;
      if (
        target?.chain === this.chain &&
        Number.isInteger(targetIndex) &&
        targetIndex !== this.index
      ) {
        this.reverting = true;
        this.browser.history.go(this.index - targetIndex);
      } else {
        // Entries created outside Split have no index. Keep the current document
        // reachable without allowing Desk to replace the unsaved Form.
        this.browser.history.pushState(null, "", this.url);
        this.persist();
      }
      return;
    }
    // The destination history entry already contains its own list snapshot.
    // Do not overwrite it from beforeunload/pagehide while reloading.
    this.departing = true;
    this.browser.location.reload();
  }
}

export function installDocumentRouteCompatibility(
  frappeObject,
  showDocument,
  browser = window,
) {
  const router = frappeObject?.router;
  if (
    typeof router?.render_page !== "function" ||
    typeof frappeObject.make_page !== "function"
  )
    return {
      valid: false,
      reason: "Required document route APIs are unavailable.",
    };
  if (router[PATCH]) return { valid: true };
  const nativeRender = router.render_page;
  router.render_page = function () {
    const route = this.current_route;
    if (!isSplitDocumentRoute(route, browser.location.search))
      return nativeRender.apply(this, arguments);
    // The marker is layout state, never a list filter or document field.
    if (frappeObject.route_options)
      delete frappeObject.route_options[SPLIT_QUERY];
    if (
      isNarrowViewport(browser.innerWidth) ||
      splitViewEligibilityReason(frappeObject, route[1])
    ) {
      const url = new URL(browser.location.href);
      url.searchParams.delete(SPLIT_QUERY);
      browser.history.replaceState(browser.history.state, "", url);
      return nativeRender.apply(this, arguments);
    }
    return showDocument([...route]);
  };
  Object.defineProperty(router, PATCH, { value: true });
  return { valid: true };
}
