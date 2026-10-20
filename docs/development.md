# Development

## Prerequisites

CI pins Frappe `v16.31.0` and `v16.52.0` with Python 3.14, Node 24, MariaDB 11.8, Redis,
Chrome/Chromium and Bench. Use a disposable site: the POC intentionally exercises private Desk APIs.

## Bench setup

```bash
bench init --frappe-branch v16.31.0 frappe-bench
cd frappe-bench
bench new-site split-view.test --admin-password admin
bench get-app /path/to/frappe-split-view
bench --site split-view.test install-app frappe_split_view
bench build --app frappe_split_view
bench --site split-view.test run-tests --app frappe_split_view
```

Frappe discovers `public/**/*.bundle.js` and `public/**/*.bundle.scss`; this app has no npm dependency
or package.json. Hooks use logical `frappe_split_view.bundle.js` and `.css` names.

## Repository checks

```bash
python scripts/check_version.py
python -m unittest discover -s tests -v
node --test tests/js/*.test.mjs
python -m compileall -q frappe_split_view scripts tests
git diff --check
pre-commit run --all-files
python -m build --sdist
```

## Targeted browser tests

Complete the site wizard and run Bench/Cypress with the site available:

```bash
bench --site split-view.test set-config allow_tests true
bench --site split-view.test execute frappe.utils.install.complete_setup_wizard
bench --site split-view.test execute frappe_split_view.tests.ui_test_helpers.setup_child_grid_poc
bench serve --port 8000
bench --site split-view.test run-ui-tests frappe_split_view \
  --headless --browser "$(command -v google-chrome || command -v chromium)" \
  --spec 'frappe_split_view/public/js/ui_test_split_view{,_grid}.js'
```

Repeat with `--frappe-branch v16.52.0` to cover the new nested view selector. The custom parent/row
fixtures belong only on disposable test sites; no stock DocType is altered.

For the required ERPNext CI environment install `v16.32.0`, ensure setup creates a Company, and run
`ui_test_split_view_project.js`. ERPNext remains an integration dependency only.

## Browser assertions

The ToDo smoke asserts selector registration, stable pane attributes, a real
`frappe.ui.form.Form`, same object identity across records, retained list container and Form-owned
route/page context, current-document-only title, Default View availability, save persistence through
REST, dirty switch/close blocking, page hide/show `cur_frm`, and hard full-page boundary. It also
covers reload restoration of document/filters/order, marked deep links without tab state,
Back/Forward reload boundaries and Close/reopen. Both ToDo and Project assert full-width list
header/filter geometry above the panes, with document controls still on the right, and the active
"Split View" selector caption. ToDo also checks Split/List round trips, a custom header action,
divider resizing, Close, reload and deep-link entry. Selector helpers use the actual legacy dropdown
or nested-menu UI, including List's Default Layout submenu. The child-grid spec supplies a test
`__form_grid_templates` entry and client script through the metadata load response before constructing
a real Form, checks its escaped cards and refresh hook, saves a scripted action, and switches records
without replacing the Form. Route checks allow the native sidebar-shell prefix; paging checks cover
legacy buttons and v16.52 radio pills. It does not mock
Form or Grid as runtime proof.

Dependency-free route/adapter tests cover compound filters, paging/scroll snapshots, disabled
storage, dirty history/unload guards, route rollback, serialized activation and pending/queued
Close cancellation. These do not replace the pinned browser CI.

## Manual work still required

PR #6 passed the required pinned GitHub CI jobs. Beyond the automated alpha gate, inspect
repeated-switch memory/listeners and test links, toolbar actions, custom scripts, permissions/errors,
grids, dialogs, keyboard/focus, RTL, narrow view, cache-busted build, migrate/upgrade/uninstall, and
ERPNext Project at the recorded refs.
Marked document refresh/deep-link restoration and clean history traversal are regression gates.
Complete native routing/lifecycle parity remains outside the POC.
