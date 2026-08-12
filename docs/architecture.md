# Architecture

## Current boundary

This repository currently contains only the Frappe v16 app skeleton and governance/automation. It
does not register a view or ship Desk assets. The architecture below is a hypothesis to validate in
Milestone 1, not an implemented or supported API.

## Intended shape

Split View should orchestrate existing Frappe components rather than fork Frappe or create a second
form renderer. If the POC is successful, responsibilities should remain separated:

- **registration adapter:** exposes an entry point using a verified v16 extension mechanism;
- **SplitView lifecycle:** creates, activates, suspends, and destroys the composed page;
- **list adapter:** preserves filters, sorting, selection, refresh, and scroll state;
- **form adapter:** mounts the standard Form only if lifecycle safety is demonstrated;
- **router:** converts selection and view state through Frappe routing without breaking deep links or
  browser Back/Forward;
- **state:** stores transient selection in route/browser state and only justified preferences in
  Frappe user settings;
- **compatibility layer:** contains all documented v16-internal dependencies, feature detection,
  rationale, and regression coverage.

No server-side records should store transient selections. The base app should depend only on Frappe,
not ERPNext.

## Milestone 1: required investigation

Against a pinned Frappe v16 checkout, inspect the view selector/factory, `ListView`, `FormView`,
`frappe.ui.form.Form`, page ownership, and router before choosing an extension point. Prove that a
Project list can remain mounted while one standard Form is used in a second container. Verify scripts,
editing, save, repeated record switches, teardown, listeners, and memory behavior.

The key risk is global Form and Desk state: `cur_frm`, route handlers, cached pages, toolbar actions,
breadcrumbs, keyboard shortcuts, model events, dialogs, child tables, dirty-state prompts, workflows,
custom buttons, links, refresh, submit/cancel, and navigation may assume exclusive page ownership.
Simply injecting form HTML is not sufficient. Current research also suggests that native third-party
view registration and caller-owned Form mounting may lack public v16 contracts; this must be confirmed
in the runtime.

If safe standard Form embedding cannot be proven, stop and document the blocker rather than silently
shipping a custom renderer or deep monkey patch. Any unavoidable internal adaptation must be minimal,
version-pinned, isolated, explained, tested, and fail safely to normal full-page List/Form routes.

## Routing and responsive behavior

Route syntax is intentionally undecided until v16 router behavior is inspected. The design must use
Frappe routing helpers, preserve refresh and browser history, and never break ordinary document deep
links. On narrow screens, the planned behavior is normal full-page Form navigation, subject to tests
for focus, unsaved changes, and Back behavior.

## Compatibility claims

`pyproject.toml` declares `>=16.0.0,<17.0.0`; declaration is not validation. Runtime support can be
claimed only after clean Bench install, build, tests, and the browser POC pass. See
[compatibility.md](compatibility.md).
