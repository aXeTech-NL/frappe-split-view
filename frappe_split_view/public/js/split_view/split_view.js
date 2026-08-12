// SPDX-License-Identifier: MIT

import {
  SplitFormAdapter,
  getEmbeddedFormOwner,
} from "./split_form_adapter.js";
import { SplitListAdapter } from "./split_list_adapter.js";
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

  setup_defaults() {
    const setup = super.setup_defaults();
    this.instanceId = ++instanceCounter;
    return setup;
  }

  setup_main_section() {
    return frappe.views.BaseList.prototype.setup_main_section
      .call(this)
      .then(() => this.setupSplitLayout());
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
    listPane.append(this.$frappe_list.get(0));
    this.detailPane = detail;
    this.formHost = formHost;
    this.splitFormAdapter = new SplitFormAdapter({
      doctype: this.doctype,
      host: this.formHost,
      listView: this,
      onSelection: (name) => this.setSelection(name),
    });
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
