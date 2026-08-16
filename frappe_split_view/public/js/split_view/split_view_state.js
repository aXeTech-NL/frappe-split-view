// SPDX-License-Identifier: MIT

export const MIN_LIST_WIDTH = 280;
export const DEFAULT_LIST_WIDTH = 420;
export const MAX_LIST_WIDTH = 760;
export const NARROW_BREAKPOINT = 900;

export function clampListWidth(value) {
  const width = Number(value);
  if (!Number.isFinite(width)) return DEFAULT_LIST_WIDTH;
  return Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, Math.round(width)));
}

export function isPrimaryActivation(event) {
  return (
    event?.button === 0 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function isNarrowViewport(width) {
  return Number(width) < NARROW_BREAKPOINT;
}

export function unsupportedMetaReason(meta, options = {}) {
  if (!meta) return "missing-meta";
  if (meta.istable) return "table";
  if (meta.is_tree || options.hasTreeSettings) return "tree";
  if (meta.issingle || options.isSingle) return "single";
  if (options.hasCustomLayout) return "custom-layout";
  if (options.isSpecial) return "special";
  return null;
}

export function splitViewEligibilityReason(frappeObject, doctype) {
  let meta;
  try {
    meta = frappeObject?.get_meta?.(doctype);
  } catch (_) {
    return "missing-meta";
  }
  const metadataReason = unsupportedMetaReason(meta, {
    hasTreeSettings: Boolean(frappeObject?.treeview_settings?.[doctype]),
    isSingle: Boolean(frappeObject?.model?.is_single?.(doctype)),
    hasCustomLayout: Boolean(frappeObject?.router?.doctype_layout),
    isSpecial: doctype === "File",
  });
  if (metadataReason) return metadataReason;
  if (
    typeof frappeObject?.ui?.form?.Form !== "function" ||
    typeof frappeObject?.model?.with_doc !== "function" ||
    typeof frappeObject?.after_ajax !== "function"
  )
    return "unavailable-api";
  return null;
}
