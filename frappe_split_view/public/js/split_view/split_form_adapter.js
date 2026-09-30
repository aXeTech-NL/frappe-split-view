// SPDX-License-Identifier: MIT

import {
  hardNavigateToForm,
  shouldCaptureFormLink,
} from "./split_view_router.js";
import { splitViewEligibilityReason } from "./split_view_state.js";
import { isSplitDocumentRoute } from "./split_document_route.js";

const OWNER_KEY = "__frappe_split_view_form_owner";
const RENDER_TIMEOUT_MS = 15000;

function showBlockedMessage() {
  const message = __(
    "Save or discard the current changes before leaving Split View.",
  );
  if (frappe.msgprint)
    frappe.msgprint({
      title: __("Unsaved changes"),
      message,
      indicator: "orange",
    });
  else frappe.show_alert?.({ message, indicator: "orange" });
}

function showUnsafeRouteMessage() {
  frappe.show_alert?.({
    message: __("Split View blocked a route it could not safely convert."),
    indicator: "orange",
  });
}

function snapshotAttribute(element, name) {
  return {
    present: element.hasAttribute(name),
    value: element.getAttribute(name),
  };
}

function restoreAttribute(element, name, snapshot) {
  if (snapshot.present) element.setAttribute(name, snapshot.value);
  else element.removeAttribute(name);
}

export function normalizeEmbeddedDocumentTitle(host, documentTitle) {
  if (!host?.querySelectorAll) return false;
  const ownerDocument = host.ownerDocument || globalThis.document;
  if (!ownerDocument?.createElement) return false;
  const title = String(documentTitle || "").trim();
  if (!title) return false;
  let normalized = false;
  for (const breadcrumbs of host.querySelectorAll(".navbar-breadcrumbs")) {
    const item = ownerDocument.createElement("li");
    item.className = "disabled";
    const label = ownerDocument.createElement("span");
    label.className = "title-text-form";
    label.dataset.splitDocumentTitle = "";
    label.setAttribute("aria-current", "page");
    label.textContent = title;
    item.append(label);
    breadcrumbs.replaceChildren(item);
    normalized = true;
  }
  return normalized;
}

export class SplitFormAdapter {
  constructor({ doctype, host, listView, onSelection }) {
    this.doctype = doctype;
    this.host = host;
    this.listView = listView;
    this.onSelection = onSelection;
    this.generation = 0;
    this.openEpoch = 0;
    this.selectedName = null;
    this.pageVisible = true;
    this.detailOpen = false;
    // Serialize the stock Form lifecycle. Frappe Form.refresh() is not promise-based and
    // overlapping refresh/onload hooks can corrupt its singleton document state.
    this.openQueue = Promise.resolve();
    this.bindNavigationBoundary();
  }

  isSupported() {
    const reason = splitViewEligibilityReason(frappe, this.doctype);
    const messages = {
      "missing-meta": __("DocType metadata is unavailable."),
      table: __("Table DocTypes are not supported."),
      single: __("Single DocTypes are not supported."),
      "custom-layout": __("Custom DocType layouts are not supported."),
      special: __("Special Form controllers are not supported."),
      "unavailable-api": __("The stock Frappe Form APIs are unavailable."),
    };
    if (reason) return { supported: false, reason: messages[reason] };
    return { supported: true, reason: null };
  }

  isActiveOwner() {
    const route = frappe.get_route?.();
    return Boolean(
      this.pageVisible &&
      this.listView?.page?.wrapper?.is?.(":visible") &&
      route?.[1] === this.doctype &&
      ((route[0] === "List" && String(route[2]).toLowerCase() === "split") ||
        isSplitDocumentRoute(route, window.location.search)),
    );
  }

  isDirty() {
    return Boolean(this.frm?.is_dirty?.());
  }

  guardDirty() {
    if (!this.isDirty()) return true;
    showBlockedMessage();
    return false;
  }

  onRoute(path) {
    if (!this.guardDirty()) return false;
    if (!path || typeof window.location?.assign !== "function") {
      showUnsafeRouteMessage();
      return false;
    }
    // Invalidate any in-flight render before starting the hard page boundary.
    this.cancelPendingOpen();
    window.location.assign(path);
    return true;
  }

  onUnsafeRoute() {
    showUnsafeRouteMessage();
  }

  open(name) {
    const epoch = this.openEpoch;
    const operation = this.openQueue.then(() =>
      epoch === this.openEpoch ? this.openSerial(name) : false,
    );
    this.openQueue = operation.catch(() => false);
    return operation;
  }

  async openSerial(name) {
    if (this.selectedName === name && this.detailOpen) return true;
    if (!this.guardDirty()) return false;
    if (this.formUnusable) {
      this.renderFallback(
        name,
        __("Reload the page to open another document safely."),
      );
      return false;
    }

    const support = this.isSupported();
    if (!support.supported) {
      this.renderFallback(name, support.reason);
      return false;
    }

    const globalOwner = window[OWNER_KEY];
    if (globalOwner && globalOwner.adapter !== this) {
      this.renderFallback(
        name,
        globalOwner.doctype === this.doctype
          ? __(
              "A stock embedded Form already belongs to another cached Split page.",
            )
          : __("This alpha supports one DocType per JavaScript session."),
      );
      return false;
    }

    const generation = ++this.generation;
    let previousRoute;
    this.host.classList.add("split-view-detail-loading");
    try {
      previousRoute = this.listView.documentRoute.begin(name);
      this.pendingRoute = previousRoute;
      const routeBeforeLoad = frappe.get_route_str();
      await frappe.model.with_doc(this.doctype, name);
      if (generation !== this.generation) return false;
      if (frappe.get_route_str() !== routeBeforeLoad) {
        throw new Error(
          "A client hook changed route while loading the embedded Form",
        );
      }
      if (!frappe.get_doc?.(this.doctype, name))
        throw new Error("Document was not loaded");
      // The old Form remains interactive during with_doc's asynchronous fetch.
      if (!this.guardDirty()) {
        this.listView.documentRoute.rollback(previousRoute);
        return false;
      }
      this.ensureForm();
      await this.refreshAndWait(name, generation);
      if (generation !== this.generation) return false;
      this.selectedName = name;
      this.detailOpen = true;
      this.host.dataset.splitFormHost = "true";
      this.host.dataset.formInstanceId = this.debugId;
      this.onSelection?.(name);
      if (this.pageVisible) window.cur_frm = this.frm;
      this.listView.documentRoute.commit(previousRoute);
      return true;
    } catch (error) {
      console.error("Split View could not load the stock Form", error);
      if (generation === this.generation) {
        this.listView.documentRoute.rollback(previousRoute);
        if (error.unsafeFormState) {
          // An unfinished client hook could still mutate the Form. Never start
          // a competing refresh on that same singleton after a timeout.
          this.renderFallback(
            name,
            __("The stock Form could not be loaded safely."),
          );
        } else if (this.selectedName) {
          // A fetch failure leaves the previous Form intact. A failed refresh
          // may already have switched frm.doc: restore it before claiming that
          // the old route/selection is still usable.
          try {
            if (this.frm?.docname !== this.selectedName)
              await this.refreshAndWait(this.selectedName, generation);
            if (generation === this.generation)
              frappe.msgprint(
                __(
                  "The document could not be opened. The previous selection was kept.",
                ),
              );
          } catch (_) {
            if (generation === this.generation)
              this.renderFallback(
                name,
                __("The stock Form could not be loaded safely."),
              );
          }
        } else {
          this.renderFallback(
            name,
            __("The stock Form could not be loaded safely."),
          );
        }
      }
      return false;
    } finally {
      if (this.pendingRoute === previousRoute) this.pendingRoute = null;
      if (generation === this.generation)
        this.host.classList.remove("split-view-detail-loading");
    }
  }

  refreshAndWait(name, generation) {
    return new Promise((resolve, reject) => {
      let settled = false;
      // On the first refresh Form.setup() has not assigned frm.wrapper yet. The parent
      // host is the eventual wrapper and is where Form emits render_complete.
      const wrapper = $(this.host);
      const nativeRenderTail = this.frm.configure_breadcrumb_width;
      let renderTail;
      const cleanup = () => {
        clearTimeout(timeout);
        wrapper.off("render_complete.frappe-split-view-open", onRender);
        if (renderTail && this.frm.configure_breadcrumb_width === renderTail)
          this.frm.configure_breadcrumb_width = nativeRenderTail;
      };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onRender = () => {
        if (settled) return;
        wrapper.off("render_complete.frappe-split-view-open", onRender);
        Promise.resolve(frappe.after_ajax())
          .then(() => {
            if (settled) return;
            if (generation !== this.generation)
              throw new Error("Stale Form render generation");
            this.normalizeDocumentTitle();
            settled = true;
            cleanup();
            resolve();
          })
          .catch(fail);
      };
      const timeout = setTimeout(() => {
        const error = new Error("Timed out waiting for stock Form render");
        error.unsafeFormState = true;
        fail(error);
      }, RENDER_TIMEOUT_MS);
      if (typeof nativeRenderTail === "function") {
        // v16 emits render_complete BEFORE its asynchronous refresh hook queue
        // finishes. This instance-only hook observes the actual last queue step.
        renderTail = function (...args) {
          try {
            const result = nativeRenderTail.apply(this, args);
            onRender();
            return result;
          } catch (error) {
            fail(error);
          }
        };
        this.frm.configure_breadcrumb_width = renderTail;
      } else {
        wrapper.one("render_complete.frappe-split-view-open", onRender);
      }
      try {
        this.restoreGlobalPageState(() => this.frm.refresh(name));
      } catch (error) {
        fail(error);
      }
    });
  }

  ensureForm() {
    if (this.frm) return;
    const currentOwner = window[OWNER_KEY];
    if (currentOwner)
      throw new Error("Refusing to construct a second embedded Form");
    this.debugId = `split-form-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.restoreGlobalPageState(() => {
      this.frm = new frappe.ui.form.Form(
        this.doctype,
        this.host,
        true,
        undefined,
      );
    });
    $(this.host).on("render_complete.frappe-split-view-title", () =>
      this.normalizeDocumentTitle(),
    );
    window[OWNER_KEY] = {
      adapter: this,
      doctype: this.doctype,
      frm: this.frm,
      id: this.debugId,
    };
  }

  normalizeDocumentTitle() {
    const doc = this.frm?.doc;
    let title = doc && frappe.model?.get_doc_title?.(doc);
    if (!title) title = this.frm?.docname;
    if (
      title &&
      frappe.utils?.is_html?.(title) &&
      typeof globalThis.strip_html === "function"
    ) {
      title = globalThis.strip_html(title);
    }
    if (this.isActiveOwner() && title) frappe.utils.set_title(title);
    return normalizeEmbeddedDocumentTitle(this.host, title);
  }

  restoreGlobalPageState(action) {
    const routeKey = frappe.get_route_str();
    const pages = frappe.ui.pages;
    const hadPage = Object.prototype.hasOwnProperty.call(pages, routeKey);
    const pageValue = pages[routeKey];
    const containerPage = frappe.container?.page;
    const sidebar = snapshotAttribute(document.body, "data-sidebar");
    try {
      return action();
    } finally {
      if (
        isSplitDocumentRoute(frappe.get_route(), window.location.search) &&
        this.frm?.page
      )
        pages[routeKey] = this.frm.page;
      else if (hadPage) pages[routeKey] = pageValue;
      else delete pages[routeKey];
      restoreAttribute(document.body, "data-sidebar", sidebar);
      if (frappe.container && frappe.container.page !== containerPage) {
        throw new Error("Embedded Form changed the active Desk page");
      }
    }
  }

  async save() {
    if (!this.frm || typeof this.frm.save !== "function") return false;
    const wasDirty = this.isDirty();
    if (!wasDirty) return true;
    try {
      await this.frm.save();
    } catch (error) {
      console.error("Split View Form save failed", error);
      return false;
    }
    if (this.isDirty()) return false;
    this.normalizeDocumentTitle();
    await this.listView.refresh?.();
    return true;
  }

  cancelPendingOpen() {
    this.openEpoch += 1;
    this.listView.documentRoute.rollback(this.pendingRoute);
    this.pendingRoute = null;
    this.generation += 1;
    this.host.classList.remove("split-view-detail-loading");
  }

  close() {
    if (!this.guardDirty()) return false;
    this.cancelPendingOpen();
    this.detailOpen = false;
    if (this.frm) $(this.host).trigger("hide");
    if (window.cur_frm === this.frm) window.cur_frm = null;
    this.onSelection?.(null);
    return true;
  }

  hide() {
    this.pageVisible = false;
    if (this.frm && this.detailOpen) $(this.host).trigger("hide");
    if (window.cur_frm === this.frm) window.cur_frm = null;
  }

  show() {
    this.pageVisible = true;
    if (this.frm && this.selectedName && this.detailOpen) {
      window.cur_frm = this.frm;
      $(this.host).trigger("show");
    }
  }

  hardNavigateToForm(name) {
    if (!name || !this.guardDirty()) return false;
    this.cancelPendingOpen();
    return hardNavigateToForm(frappe, this.doctype, name);
  }

  openFullPage(name = this.selectedName) {
    return this.hardNavigateToForm(name);
  }

  renderFallback(name, reason) {
    // A Form whose host was replaced cannot safely be refreshed again.
    this.formUnusable = Boolean(this.frm);
    if (window.cur_frm === this.frm) window.cur_frm = null;
    this.selectedName = null;
    this.detailOpen = true;
    this.host.replaceChildren();
    const fallback = document.createElement("div");
    fallback.className = "split-view-fallback";
    const message = document.createElement("p");
    message.textContent = reason;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary btn-sm";
    button.textContent = __("Open full page");
    button.addEventListener("click", () => this.hardNavigateToForm(name));
    fallback.append(message, button);
    this.host.append(fallback);
    this.onSelection?.(name);
  }

  bindNavigationBoundary() {
    this.host.addEventListener(
      "click",
      (event) => {
        const anchor = event.target.closest?.("a[href]");
        if (!anchor || !shouldCaptureFormLink(event, anchor)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!this.guardDirty()) return;
        // A hard boundary prevents FormFactory constructing a second live Form.
        this.cancelPendingOpen();
        window.location.assign(anchor.href);
      },
      true,
    );
  }
}

export function getEmbeddedFormOwner() {
  return window[OWNER_KEY] || null;
}

export function getActiveEmbeddedFormOwner() {
  const owner = getEmbeddedFormOwner();
  const pending = window.cur_list?.splitFormAdapter;
  // Navigation during the first fetch also needs a hard boundary, before the
  // singleton Form owner exists. Otherwise its response can reclaim a new page.
  const adapter = pending?.pendingRoute ? pending : owner?.adapter;
  if (!adapter?.isActiveOwner?.()) return null;
  return {
    onRoute: (path) => adapter.onRoute(path),
    onUnsafeRoute: () => adapter.onUnsafeRoute(),
  };
}
