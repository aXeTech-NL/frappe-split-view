# Architecture

## `16.0.0` boundary

This is a sharply bounded technical POC, not an embeddable Form API or production support claim. The
implementation was designed from source inspection of Frappe
`6a329d068416768ec47ccd3326b9cc95a8d7bf99`. Frappe v16 offers no public custom view-selector hook and
`Form` has no symmetric teardown API, so all private coupling is isolated in app modules.

## Modules

- `split_view_registry.js` registers `frappe.views.SplitView` after feature detection.
- `compatibility.js` owns the pinned v16 selector/router/default-view mutations. It adds Split to view
  modes and router maps, decorates Frappe's Default View option setup for supported DocTypes, and
  temporarily removes Split while native `ListViewSelect.setup_views()` evaluates its closed local
  mode map. A failed probe leaves native List/Form behavior unchanged.
- `split_view.js` extends stock `frappe.views.ListView`, so `ListFactory`, `BaseList`, list controls,
  filters, and refresh remain standard. It moves the existing `.frappe-list` node into an app-owned
  grid and adds the detail host; it does not construct a second list.
- `split_list_adapter.js` precedes the native delegated click handler and intercepts only ordinary
  primary record activation when the authoritative anchor pathname matches the canonical stock Form
  pathname. Names come from `a[data-name]`; custom `settings.get_form_link` paths, modified/non-left
  clicks, checkbox, like, filter, dropdown, action, and other native interactions remain native.
- `split_form_adapter.js` owns one stock `frappe.ui.form.Form` for one DocType per JavaScript session.
  It mirrors FormFactory's `with_doc` fetch but never calls FormFactory, `frappe.set_route`, or
  `frappe.container.change_to` for embedded detail.
- `split_view_router.js` contains canonical hard-navigation helpers.
- `split_view_state.js` contains pure activation, viewport, and bounded divider decisions.

## Form ownership and global state

The explicit global debug/ownership record is `window.__frappe_split_view_form_owner` and is also
visible through `window.frappe_split_view.debug.owner`. Construction is refused if an owner already
exists. One Form object switches existing records; generation tokens prevent stale `with_doc`
responses replacing a newer selection. The adapter binds `render_complete` before `Form.refresh()`,
waits for `frappe.after_ajax`, reduces the embedded Form breadcrumb to its stock current-document
label, and commits selection only within a bounded current generation.

`Form.refresh()` lazily creates a `frappe.ui.Page`, which overwrites the current
`frappe.ui.pages[frappe.get_route_str()]` entry and can change body `data-sidebar`. The adapter
snapshots the exact presence/value of both and restores them synchronously around refresh. The Desk
container remains the List page.

The outer cached Split page explicitly triggers nested form-host `hide`; page visibility and detail-open
state are separate. It clears `cur_frm` only when it owns that global and restores it on page show only
when detail remains open. Closing hides rather than destroys the Form because Frappe Form
model/document/realtime listeners are not safely disposable.

## Dirty and navigation boundary

Switching records, closing detail, and all active-owner navigation are refused while `frm.is_dirty()`.
Save calls `frm.save()` and refreshes the list only after observing a clean Form.

A feature-detected wrapper at `frappe.router.set_route` delegates to the embedded owner only while its
Split page is active, converts arguments with the stock router helpers, and hard-navigates. Full-page
open, narrow-screen activation, and ordinary primary in-Desk links inside the detail host use the same
hard browser boundary. Modified/non-left/download/named-target links remain native. The reload resets
the JavaScript session before normal FormFactory can create a full Form.

## Layout and state

The existing List page receives an app-owned root with list, divider, and detail panes. Width dragging
and keyboard arrows are supported; only bounded per-DocType divider width is stored in
`localStorage`. No selected document or route/history restoration state is persisted.

## Fail-safe eligibility

Single, table, missing-meta, custom-layout, and unavailable-API cases render an explanatory fallback
with hard full-page navigation. Tree-backed DocTypes are eligible because Split mounts their stock
ListView; their native Tree route and custom Tree controller remain separate and unchanged.
File/special/custom controllers and arbitrary client scripts are not asserted compatible. File is not
advertised in the selector and its stock ListFactory special-view fallback remains native.
If selector/router feature detection fails, registration stops without changing native modes or routing.

## Explicitly unsupported

New/copy/rename/amend/print, workflow, custom Route actions, multiple DocTypes in one session,
multiple embedded forms, complete Back/Forward/refresh/deep-link parity, canonical Form route while
split remains visible, general realtime conflict behavior, safe teardown, and generic custom-script
compatibility are outside this alpha. Anonymous Frappe listeners remain a long-session risk.
