# Frappe Split View

[![CI](https://github.com/aXeTech-NL/frappe-split-view/actions/workflows/ci.yml/badge.svg)](https://github.com/aXeTech-NL/frappe-split-view/actions/workflows/ci.yml)

Frappe Split View is an **experimental technical POC** for Frappe Desk. It adds Split to the
standard v16 view selector, keeps the stock ListView mounted on the left, and mounts one persistent
stock `frappe.ui.form.Form` for existing records of one DocType on the right.

> `0.1.0-alpha.1` is not production-ready or a generic compatibility claim. PR #6 passed the
> required pinned Frappe/ERPNext browser jobs, static checks, and CodeQL before release.

## What the POC proves

- `/desk/<doctype>/view/split` is a normal `ListFactory` view.
- List filters, sort controls, actions, paging, and scroll remain owned by the stock ListView.
- Primary record activation loads an existing record into a real stock Form without FormFactory or
  `frappe.container.change_to`.
- The same Form object switches records and explicit standard Save is available.
- Dirty record switching, close, and all `frappe.set_route`-driven navigation are blocked.
- Full-page, narrow-screen, Form-link, and active-owner `frappe.set_route` transitions use a hard
  browser navigation so a second Form is not created in the same JavaScript session.
- The divider width is the only persisted state and is bounded in `localStorage`.

Stable browser-test attributes are `data-frappe-split-view`, `data-split-view-list`,
`data-split-view-detail`, `data-split-view-divider`, `data-split-form-host`, and root
`data-doctype`/`data-selected-name`.

## Compatibility

| App version | Declared Frappe range | Inspected reference | Status |
| --- | --- | --- | --- |
| `0.1.0-alpha.1` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | POC / experimental |

Required CI pins ERPNext Project integration to ERPNext `v16.32.0`
(`81a6f97566b83609c3917404a560b673050e907d`). The app does not depend on ERPNext. See
[compatibility notes](docs/compatibility.md).

## Installation for evaluation

```bash
bench get-app https://github.com/aXeTech-NL/frappe-split-view
bench --site <site> install-app frappe_split_view
bench build --app frappe_split_view
bench restart
```

Use only a disposable Frappe v16 site. Select **Split View** from a normal DocType's view menu.

## Known limitations

Only existing ordinary, non-Single, non-tree, non-table DocTypes without a custom DocType Layout are
in scope. Unsupported metadata receives an explanatory fallback and a hard full-page action.

This alpha does **not** claim complete browser Back/Forward/refresh restoration, normal Form-route
semantics, multiple DocTypes per JavaScript session, teardown safety, realtime conflict parity,
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

[MIT](LICENSE) — Copyright (c) 2026 Frappe Split View contributors.
