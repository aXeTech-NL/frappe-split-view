// SPDX-License-Identifier: MIT

import {
  SplitFormAdapter,
  getEmbeddedFormOwner,
} from "./split_form_adapter.js";
import { SplitListAdapter } from "./split_list_adapter.js";
import {
  SplitDocumentRoute,
  isSplitDocumentRoute,
  readListState,
} from "./split_document_route.js";
import {
  DEFAULT_LIST_WIDTH,
  MAX_LIST_WIDTH,
  MIN_LIST_WIDTH,
  NARROW_BREAKPOINT,
  clampListWidth,
  isNarrowViewport,
} from "./split_view_state.js";

let instanceCounter = 0;

export class SplitView extends frappe.views.ListView {
  get view_name() {
    return "Split";
  }

  show() {
    this.parent.disable_scroll_to_top = true;
    this.ready = frappe.views.BaseList.prototype.show.call(this).then(() => {
      const state = this.restoredListState;
      if (state) {
        this.splitRoot.querySelector("[data-split-view-list]").scrollTop =
          state.scrollTop;
        const result = this.$frappe_list.find(".result-container").get(0);
        if (result) result.scrollTop = state.resultScrollTop;
        this.restoredListState = null;
        this.documentRoute.persist();
      }
    });
    return this.ready;
  }

  static showDocumentRoute(route) {
    const [, doctype, name] = route;
    const key = ["List", doctype, "Split"].join("/");
    let list = frappe.views.list_view[key];
    if (!list) {
      list = new SplitView({
        doctype,
        parent: frappe.make_page(true, key, null),
      });
      frappe.views.list_view[key] = list;
    } else {
      frappe.container.change_to(list.parent);
    }
    window.cur_list = list;
    return list.ready.then(() => {
      if (frappe.get_route_str() !== route.join("/")) return false;
      return list.activateRecord(name);
    });
  }

  setup_defaults() {
    const setup = super.setup_defaults();
    this.instanceId = ++instanceCounter;
    // Keep a stable cache identity even when bootstrapping on a Form route.
    this.page_name = ["List", this.doctype, "Split"].join("/");
    this.restoredListState = readListState(frappe, this.doctype);
    return Promise.resolve(setup).then(() => {
      const state = this.restoredListState;
      if (!state) return;
      this.filters = state.filters;
      this.sort_by = state.sortBy;
      this.sort_order = state.sortOrder;
      this.page_length = state.pageLength;
      this.selected_page_count = state.pageCount;
    });
  }

  set_breadcrumbs() {
    // On refresh/deep-link entry, the shell is built before with_doc completes.
    // Native list breadcrumbs would treat the Form route as a loaded document
    // and dereference null. The Form owns breadcrumbs and registers them later.
    if (isSplitDocumentRoute(frappe.get_route(), window.location.search))
      return;
    return super.set_breadcrumbs();
  }

  before_refresh() {
    // A document's query parameters must never become list filters.
    if (isSplitDocumentRoute(frappe.get_route(), window.location.search))
      return Promise.resolve();
    return super.before_refresh();
  }

  update_url_with_filters() {
    if (!isSplitDocumentRoute(frappe.get_route(), window.location.search))
      super.update_url_with_filters();
    this.documentRoute?.persist();
  }

  setup_main_section() {
    return frappe.views.BaseList.prototype.setup_main_section
      .call(this)
      .then(() => this.setupSplitLayout());
  }

  setup_paging_area() {
    super.setup_paging_area();
    // page_length is the total loaded range; the button represents batch size.
    this.$paging_area
      .find(".btn-paging")
      .removeClass("btn-info")
      .prop("disabled", false);
    this.$paging_area
      .find(`.btn-paging[data-value="${this.selected_page_count}"]`)
      .addClass("btn-info")
      .prop("disabled", true);
  }

  process_document_refreshes() {
    if (
      isSplitDocumentRoute(frappe.get_route(), window.location.search) &&
      this.documentRoute?.isActive()
    ) {
      if (this.pending_document_refreshes.length) {
        this.pending_document_refreshes = [];
        this.refresh();
      }
      return;
    }
    return super.process_document_refreshes();
  }

  setup_list_click() {
    // Deliberately replace only stock record activation for SplitView. All checkbox,
    // like, filter, dropdown and modified/non-left-click behavior remains native.
    this.splitListAdapter = new SplitListAdapter(this);
    this.splitListAdapter.bind();
    super.setup_list_click();
  }

  setupSplitLayout() {
    const main = this.page.main.get(0);
    if (!main || this.splitRoot) return;
    this.splitRoot = document.createElement("section");
    this.splitRoot.className = "frappe-split-view";
    this.splitRoot.dataset.frappeSplitView = "true";
    this.splitRoot.dataset.doctype = this.doctype;
    this.splitRoot.dataset.selectedName = "";

    const listPane = document.createElement("div");
    listPane.className = "split-view-list";
    listPane.dataset.splitViewList = "";
    const divider = document.createElement("div");
    divider.className = "split-view-divider";
    divider.dataset.splitViewDivider = "";
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-orientation", "vertical");
    divider.setAttribute("aria-valuemin", String(MIN_LIST_WIDTH));
    divider.setAttribute("aria-valuemax", String(MAX_LIST_WIDTH));
    divider.setAttribute("tabindex", "0");
    divider.setAttribute("aria-label", __("Resize list pane"));
    const detail = document.createElement("aside");
    detail.className = "split-view-detail";
    detail.dataset.splitViewDetail = "";
    detail.setAttribute("aria-live", "polite");
    const header = document.createElement("header");
    header.className = "split-view-detail-actions";
    const fullButton = document.createElement("button");
    fullButton.type = "button";
    fullButton.className = "btn btn-default btn-xs";
    fullButton.dataset.splitOpenFull = "";
    fullButton.textContent = __("Open full page");
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "btn btn-default btn-xs";
    closeButton.dataset.splitClose = "";
    closeButton.setAttribute("aria-label", __("Close detail"));
    closeButton.textContent = __("Close");
    const formHost = document.createElement("div");
    formHost.className = "split-view-form-host content page-container";
    formHost.dataset.splitFormHost = "";
    header.append(fullButton, closeButton);
    detail.append(header, formHost);
    this.splitRoot.append(listPane, divider, detail);
    main.append(this.splitRoot);
    // Keep the stock list toolbar and filters in their full-width positions
    // above the split. Only results/paging belong to the left pane.
    listPane.append(this.$frappe_list.get(0));
    this.detailPane = detail;
    this.formHost = formHost;
    this.splitFormAdapter = new SplitFormAdapter({
      doctype: this.doctype,
      host: this.formHost,
      listView: this,
      onSelection: (name) => this.setSelection(name),
    });
    this.documentRoute = new SplitDocumentRoute(this);
    let scrollTimer;
    const rememberScroll = () => {
      if (scrollTimer) return;
      scrollTimer = setTimeout(() => {
        scrollTimer = null;
        this.documentRoute.persist();
      }, 500);
    };
    listPane.addEventListener("scroll", rememberScroll, { passive: true });
    this.$frappe_list
      .find(".result-container")
      .on("scroll.frappe-split-view", rememberScroll);
    this.applyStoredWidth();
    this.bindSplitEvents();
    this.page.wrapper.on(
      `hide.frappe-split-view-${this.instanceId}`,
      (event) => {
        if (event.target === this.page.wrapper.get(0))
          this.splitFormAdapter.hide();
      },
    );
    this.page.wrapper.on(
      `show.frappe-split-view-${this.instanceId}`,
      (event) => {
        if (event.target === this.page.wrapper.get(0))
          this.splitFormAdapter.show();
      },
    );
  }

  bindSplitEvents() {
    this.splitRoot
      .querySelector("[data-split-close]")
      .addEventListener("click", () => this.closeDetail());
    this.splitRoot
      .querySelector("[data-split-open-full]")
      .addEventListener("click", () => this.splitFormAdapter.openFullPage());
    const divider = this.splitRoot.querySelector("[data-split-view-divider]");
    divider.addEventListener("pointerdown", (event) => this.startResize(event));
    divider.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const current = parseInt(
        this.splitRoot.style.getPropertyValue("--split-list-width"),
        10,
      );
      this.setListWidth(
        (current || DEFAULT_LIST_WIDTH) +
          (event.key === "ArrowLeft" ? -20 : 20),
      );
    });
  }

  async activateRecord(name, anchor = null) {
    if (isNarrowViewport(window.innerWidth)) {
      this.splitFormAdapter.openFullPage(name);
      return false;
    }
    if (anchor) this.selectedRowLink = anchor;
    this.detailPane.hidden = false;
    this.splitRoot.classList.add("has-selection");
    const opened = await this.splitFormAdapter.open(name);
    if (opened) this.splitFormAdapter.show();
    if (!opened && this.splitFormAdapter.isDirty())
      this.setSelection(this.splitFormAdapter.selectedName);
    return opened;
  }

  setSelection(name) {
    this.splitRoot.dataset.selectedName = name || "";
    if (!name) this.splitRoot.classList.remove("has-selection");
  }

  closeDetail() {
    if (!this.splitFormAdapter.close()) return false;
    this.documentRoute.close();
    this.set_breadcrumbs();
    this.detailPane.hidden = true;
    this.splitRoot.classList.remove("has-selection");
    if (this.selectedRowLink?.isConnected) this.selectedRowLink.focus();
    return true;
  }

  startResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const listPane = this.splitRoot.querySelector("[data-split-view-list]");
    const startWidth = listPane.getBoundingClientRect().width;
    const move = (moveEvent) =>
      this.setListWidth(startWidth + moveEvent.clientX - startX, false);
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      this.persistWidth();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  widthKey() {
    return `frappe-split-view:list-width:${this.doctype}`;
  }

  applyStoredWidth() {
    let width = DEFAULT_LIST_WIDTH;
    try {
      width = clampListWidth(window.localStorage.getItem(this.widthKey()));
    } catch (_) {
      // Storage can be disabled without disabling Split View.
    }
    this.setListWidth(width, false);
  }

  setListWidth(width, persist = true) {
    const boundedWidth = clampListWidth(width);
    this.splitRoot.style.setProperty("--split-list-width", `${boundedWidth}px`);
    this.splitRoot
      .querySelector("[data-split-view-divider]")
      ?.setAttribute("aria-valuenow", String(boundedWidth));
    if (persist) this.persistWidth();
  }

  persistWidth() {
    try {
      window.localStorage.setItem(
        this.widthKey(),
        parseInt(
          this.splitRoot.style.getPropertyValue("--split-list-width"),
          10,
        ),
      );
    } catch (_) {
      // Width persistence is optional.
    }
  }
}

export function exposeDebugApi() {
  window.frappe_split_view = window.frappe_split_view || {};
  window.frappe_split_view.debug = {
    get owner() {
      return getEmbeddedFormOwner();
    },
    get activeList() {
      return window.cur_list || null;
    },
    NARROW_BREAKPOINT,
  };
}
