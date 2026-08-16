// SPDX-License-Identifier: MIT

import {
  compatibilityStatus,
  installRouteCompatibility,
  installSelectorCompatibility,
} from "./compatibility.js";
import { SplitView, exposeDebugApi } from "./split_view.js";
import { getActiveEmbeddedFormOwner } from "./split_form_adapter.js";

const REGISTERED = Symbol.for("frappe_split_view.registered");

export function registerSplitView() {
  if (!window.frappe || frappe[REGISTERED]) return false;
  const status = compatibilityStatus(frappe);
  if (!status.valid) {
    console.warn("Split View disabled:", status.reason);
    return false;
  }
  const installed = installSelectorCompatibility(frappe);
  if (!installed.valid) return false;
  const routeBoundary = installRouteCompatibility(
    frappe,
    getActiveEmbeddedFormOwner,
  );
  if (!routeBoundary.valid) return false;
  frappe.views.SplitView = SplitView;
  Object.defineProperty(frappe, REGISTERED, { value: true });
  exposeDebugApi();
  return true;
}
