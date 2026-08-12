// SPDX-License-Identifier: MIT

import {
  canonicalFormPath,
  isCanonicalRecordAnchor,
} from "./split_view_router.js";
import { isPrimaryActivation } from "./split_view_state.js";

const NATIVE_EXCLUSIONS = [
  "[data-toggle='dropdown']",
  ".filterable",
  ".select-like",
  ".file-select",
  ".list-row-like",
  "input[type='checkbox']",
  "button",
  ".dropdown-menu",
  ".list-row-checkbox",
].join(",");

export class SplitListAdapter {
  constructor(splitView) {
    this.splitView = splitView;
    this.listView = splitView;
    this.namespace = `.frappe-split-view-${splitView.instanceId}`;
  }

  bind() {
    const result = this.listView.$result;
    if (!result?.on) return false;
    result.off(this.namespace);
    result.on(
      `click${this.namespace}`,
      ".list-row, .image-view-header, .file-header",
      (event) => this.handleActivation(event),
    );
    return true;
  }

  handleActivation(event) {
    if (!isPrimaryActivation(event)) return;
    const target = event.target;
    if (target.closest?.(NATIVE_EXCLUSIONS)) return;

    const current = event.currentTarget;
    const directAnchor = target.closest?.("a[data-name]");
    const anchor =
      directAnchor || current.querySelector?.(".list-subject a[data-name]");
    if (!anchor?.dataset?.name) return;

    // Preserve explicit links and custom settings.get_form_link routes. Only the canonical
    // stock record pathname is authoritative for embedded activation.
    if (target.closest?.("a") && !directAnchor) return;
    const canonicalPath = canonicalFormPath(
      frappe,
      this.splitView.doctype,
      anchor.dataset.name,
    );
    if (!isCanonicalRecordAnchor(anchor, canonicalPath)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.splitView.activateRecord(anchor.dataset.name, anchor);
  }
}
