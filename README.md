# Split View

[![CI](https://github.com/aXeTech-NL/frappe-split-view/actions/workflows/ci.yml/badge.svg?branch=version-16)](https://github.com/aXeTech-NL/frappe-split-view/actions/workflows/ci.yml?query=branch%3Aversion-16)

Split View is an **experimental technical POC** for Frappe Desk. It adds Split to the
standard v16 view selector, keeps the stock ListView mounted on the left, and mounts one persistent
stock `frappe.ui.form.Form` for existing records of one DocType on the right. Opening a record makes
its Form route and context authoritative; the list becomes the retained navigation pane.

> `16.2.1` remains an experimental technical POC, not a production-readiness or generic
> compatibility claim. The major version identifies the compatible Frappe release line.

## What the POC proves

- `/desk/<doctype>/view/split` is a normal `ListFactory` view.
- List filters, sort controls, actions, paging, and scroll remain owned by the stock ListView.
- The list toolbar and filters span the full content width above both panes; only results and
  the document are split side by side. Document actions stay in the right pane.
- Primary record activation loads an existing record into a real stock Form without FormFactory or
  `frappe.container.change_to`.
- The same Form object switches records, shows only the current document title, and keeps standard Save available.
- **Split** can be selected as the Default View for each supported DocType through standard Frappe configuration, including tree-backed DocTypes that also expose a stock ListView.
- Dirty record switching, close, and all `frappe.set_route`-driven navigation are blocked.
- Full-page, narrow-screen, Form-link, and active-owner `frappe.set_route` transitions use a hard
  browser navigation so a second Form is not created in the same JavaScript session.
- Selecting a record uses `/desk/<doctype>/<name>?split_view=1`, including Frappe's `Form` context.
- Refresh restores that document and the list's filters, ordering, loaded range and scroll positions.
  List state is tab-scoped (`sessionStorage` and browser history), not stored in the document URL.
- Close returns to the filtered Split list. Plain document URLs and **Open full page** remain native.
- Back/Forward uses a reload boundary; unsaved changes block in-page history navigation and trigger
  the browser's confirmation on refresh/leave. Unsaved field values are not persisted.
- Divider width is bounded and stored per DocType in `localStorage`.

Stable browser-test attributes are `data-frappe-split-view`, `data-split-view-list`,
`data-split-view-detail`, `data-split-view-divider`, `data-split-form-host`,
`data-split-document-title`, and root
`data-doctype`/`data-selected-name`.

## Compatibility

| App version | Declared Frappe range | Inspected reference | Status |
| --- | --- | --- | --- |
| `16.2.1` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | POC / experimental |
| `16.2.0` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | POC / experimental |
| `16.1.0` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | POC / experimental |
| `16.0.1` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | POC / experimental |
| `16.0.0` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | POC / experimental |

Required CI pins ERPNext Project integration to ERPNext `v16.32.0`
(`81a6f97566b83609c3917404a560b673050e907d`). The app does not depend on ERPNext. See
[compatibility notes](docs/compatibility.md).

## Installation for evaluation

```bash
bench get-app --branch version-16 https://github.com/aXeTech-NL/frappe-split-view
bench --site <site> install-app frappe_split_view
bench build --app frappe_split_view
bench restart
```

Use only a disposable Frappe v16 site. Select **Split** from a normal DocType's view menu.
Administrators can also select **Split** in that DocType's **Default View** setting. The installed
technical package identifier remains `frappe_split_view` for upgrade compatibility; its displayed
app and module name is **Split View**.

## Known limitations

Only existing ordinary, non-Single, non-table DocTypes without a custom DocType Layout are in scope.
Tree-backed DocTypes use their stock ListView inside Split; their separate native Tree view remains unchanged.
Unsupported metadata receives an explanatory fallback and a hard full-page action.

A copied split document link opens the document even without tab-local list state; in that case the
list uses Frappe's saved/default settings. Refresh fetches current server data, not a frozen result set.

This alpha does **not** claim complete native Form-route parity, multiple DocTypes per JavaScript
session, teardown safety, realtime conflict parity,
new/copy/rename/amend/print, workflow, arbitrary client scripts, custom route actions, child-table
coverage, or mobile embedded forms. Form internals retain anonymous global listeners for the Desk
session. `cur_frm` points at the embedded form only while the cached Split page is active.

## Development

See [development](docs/development.md), [architecture](docs/architecture.md), and
[contributing](CONTRIBUTING.md). Dependency-free checks include:

```bash
python scripts/check_version.py
python -m unittest discover -s tests -v
node --test tests/js/*.test.mjs
python -m compileall -q frappe_split_view scripts tests
```

## License

[MIT](LICENSE) — Copyright (c) 2026 Split View contributors.
