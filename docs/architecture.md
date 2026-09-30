# Architecture

## Experimental boundary

This remains a technical POC, not a general embeddable Form API. Private integration is based on
Frappe `6a329d068416768ec47ccd3326b9cc95a8d7bf99` (v16.31.0). Frappe v16 offers no public
custom view-selector hook and Form has no symmetric teardown API.

## Modules

- `split_view_registry.js` registers the view and document-route renderer after feature detection.
- `compatibility.js` owns selector, Default View and active-owner `set_route` compatibility.
- `split_view.js` extends stock ListView. The same list, controls and DOM remain mounted across
  document switches. Its cache identity stays `List/<doctype>/Split`, including on a deep link.
- `split_list_adapter.js` intercepts only primary activation of canonical record anchors. Modified
  clicks, custom form links, checkboxes, likes, filters and other list interactions remain native.
- `split_form_adapter.js` owns one persistent stock Form for one DocType per JavaScript session.
- `split_document_route.js` owns document route transactions, tab-local list snapshots and history
  boundaries. It intercepts only marked Form routes before the native FormFactory renderer.
- `split_view_router.js` contains canonical hard-navigation and link helpers.
- `split_view_state.js` contains eligibility, activation, viewport and divider decisions.

## Document-led routing

The entry route remains `/desk/<doctype>/view/split`. Selecting an existing record changes the URL
to `/desk/<doctype>/<name>?split_view=1` and Frappe's route to `Form/<doctype>/<name>` **before**
Form loading and client hooks. The Form Page owns `frappe.ui.pages[current_route]`, `cur_frm` points
to that Form, and the browser title and body route identify the document. The existing Split page
remains the physical Desk container; no second Form or List is constructed. The stock list toolbar
and filters keep their native full-width positions above both panes. Only the list results/paging
move into the left pane; document-specific controls remain inside the right pane.

Opening is serialized. A tentative history replacement is committed as a new entry only after a
successful render. Failure restores the previous route and, where safe, the previous Form. Close
rolls back pending activation, cancels queued activations and returns to the filtered Split list.

On reload or a direct marked Form link, a scoped router renderer reconstructs the Split list and
opens the URL's document without calling FormFactory. Without tab-local state it uses native
saved/default list settings. Unmarked Form URLs remain native. Unsupported metadata and narrow
viewports remove the layout marker and use the native full-page Form.

## Form lifecycle and ownership

`window.__frappe_split_view_form_owner` records the singleton owner (also exposed by the debug API).
Generation tokens prevent stale fetches committing after Close or navigation. In pinned v16,
`render_complete` precedes the asynchronous render queue. An instance-scoped wrapper around its last
step, `configure_breadcrumb_width`, waits for that queue and `after_ajax` before committing; it is
restored on completion. A timed-out Form cannot be safely reused and requires a reload.

Form Page registration is preserved on document routes so asynchronous hooks see Form context.
Construction/refresh still preserve the outer container and body sidebar attribute. Show/hide events
manage `cur_frm`; Close hides the persistent Form rather than destroying its global listeners.
Arbitrary client hooks that outlive Frappe's own lifecycle are not supported.

## List state

Snapshots contain complete filter tuples (including child-table filters), sort field/direction,
loaded row capacity, paging batch size, and both list-pane and result-container scroll offsets.
Snapshots are stored in browser history plus user/DocType-scoped `sessionStorage`. No document field
values are stored. Divider width alone remains in `localStorage`. Disabled session storage falls
back to history state; a copied link intentionally does not carry private filters or row data.

Restore applies list settings before the first fetch and scroll after rendering. Changing documents
does not refresh or reconstruct the list. Filter changes never replace a document URL with list
filter query parameters. The visible embedded list handles realtime refresh notifications under the
Form route instead of letting native ListView unsubscribe because it is no longer on a List route.
Refresh fetches current server data, so changed/deleted records can affect results.

## Navigation and dirty state

Dirty record switches, Close and active-owner navigation are blocked. Edits made while the next
record is fetching are checked again before refreshing the Form. Full-page open, active-owner
`set_route` and primary Desk links in the Form use a hard browser boundary to avoid a second live
Form. Modified/download/named-target links remain native.

Back/Forward is intercepted before Desk's router. Clean traversal reloads the destination; dirty
traversal returns to the current entry using chain-scoped history indices, with a safe fallback for
unindexed entries. `beforeunload` uses the browser's standard unsaved-changes confirmation for
refresh/leave. This does not persist or recover unsaved field values.

## Eligibility and remaining limits

Single, table, missing-meta, custom-layout and unavailable-API cases fail closed. Tree-backed
DocTypes use their ordinary ListView; native Tree routes remain separate. File/special controllers
are not advertised. New/copy/rename/amend/print, workflow, custom route actions, multiple embedded
Forms/DocTypes in one session, generic client-script support, native lifecycle/history parity,
realtime conflict parity and safe teardown remain outside this POC.
