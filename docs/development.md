# Development

## Prerequisites

CI pins Frappe `v16.31.0` with Python 3.14, Node 24, MariaDB 11.8, Redis, Chrome/Chromium,
and Bench. Use a disposable site: the POC intentionally exercises private Desk APIs.

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
bench --site split-view.test execute frappe.utils.install.complete_setup_wizard
bench serve --port 8000
bench --site split-view.test run-ui-tests frappe_split_view \
  --headless --browser "$(command -v google-chrome || command -v chromium)" \
  --spec frappe_split_view/public/js/ui_test_split_view.js
```

For the required ERPNext CI environment install `v16.32.0`, ensure setup creates a Company, and run
`ui_test_split_view_project.js`. ERPNext remains an integration dependency only.

## Browser assertions

The ToDo smoke asserts selector registration, stable pane attributes, a real
`frappe.ui.form.Form`, same object identity across records, active List container/cache ownership,
explicit save persistence through REST, dirty switch/close blocking, page hide/show `cur_frm`, and
hard full-page boundary. It does not mock Form as runtime proof.

## Manual work still required

Real GitHub CI results are pending. Before tagging, inspect repeated-switch memory/listeners and test
links, toolbar actions, custom scripts, permissions/errors, grids, dialogs, keyboard/focus, RTL,
narrow view, cache-busted build, migrate/upgrade/uninstall, and ERPNext Project at the recorded refs.
Complete browser Back/Forward/refresh parity is explicitly not an alpha gate or claim.
