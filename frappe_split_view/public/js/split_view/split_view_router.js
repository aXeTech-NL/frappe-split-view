// SPDX-License-Identifier: MIT

export function canonicalFormPath(frappeObject, doctype, name) {
  if (!frappeObject?.utils?.get_form_link) return null;
  return frappeObject.utils.get_form_link(doctype, name);
}

export function hardNavigateToForm(
  frappeObject,
  doctype,
  name,
  locationObject = window.location,
) {
  const path = canonicalFormPath(frappeObject, doctype, name);
  if (!path || typeof locationObject?.assign !== "function") return false;
  locationObject.assign(path);
  return true;
}

export function isDeskNavigation(anchor, locationObject = window.location) {
  if (!anchor?.href) return false;
  const rawHref = anchor.getAttribute?.("href") || "";
  if (!rawHref || rawHref === "#" || rawHref.startsWith("javascript:")) return false;
  const target = new URL(anchor.href, locationObject.href);
  const current = new URL(locationObject.href);
  return (
    target.origin === locationObject.origin &&
    target.pathname.startsWith("/desk/") &&
    (target.pathname !== current.pathname || target.search !== current.search)
  );
}

export function shouldCaptureFormLink(
  event,
  anchor,
  locationObject = window.location,
) {
  if (
    event?.defaultPrevented ||
    event?.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey ||
    anchor?.hasAttribute?.("download")
  ) {
    return false;
  }
  const target = (anchor?.getAttribute?.("target") || "").toLowerCase();
  if (target && target !== "_self") return false;
  return isDeskNavigation(anchor, locationObject);
}

export function isCanonicalRecordAnchor(
  anchor,
  canonicalPath,
  locationObject = window.location,
) {
  if (!anchor?.href || !canonicalPath) return false;
  try {
    const actual = new URL(anchor.href, locationObject.href);
    const canonical = new URL(canonicalPath, locationObject.href);
    return actual.pathname === canonical.pathname;
  } catch (_) {
    return false;
  }
}
