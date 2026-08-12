# Development

## Prerequisites

The current Frappe v16 line uses Python 3.14, Node 24, and MariaDB 11.8 in CI. Install those versions,
Redis, Bench, and other platform prerequisites described by Frappe. Use a disposable development site;
this project is experimental.

## Bench setup

```bash
bench init --frappe-branch version-16 frappe-bench
cd frappe-bench
bench new-site split-view.test
bench get-app /path/to/frappe-split-view
bench --site split-view.test install-app frappe_split_view
bench build --app frappe_split_view
bench --site split-view.test run-tests --app frappe_split_view
```

For repository CI parity, begin from a clean environment. The bootstrap contains no feature assets,
so `bench build` validates app/build integration rather than Split View behavior.

## Dependency-free checks

Outside Bench, Python 3.11+ can parse/run these repository checks even though package installation
requires Python 3.14:

```bash
python scripts/check_version.py
python scripts/check_version.py --tag v0.1.0
python -m unittest discover -s tests -v
python -m compileall -q frappe_split_view scripts tests
git diff --check
```

Install pre-commit and run:

```bash
pre-commit run --all-files
```

## Runtime validation still required

A local environment without Frappe cannot validate app discovery, site installation, hooks, asset
builds, permissions, migrations, tests, upgrades, or uninstall. It also cannot establish that Form
embedding works. Before a compatibility or release claim, run clean Bench CI and perform the
Milestone-1 browser POC described in [architecture.md](architecture.md).

When uninstall testing becomes applicable, verify standard business documents are untouched:

```bash
bench --site split-view.test uninstall-app frappe_split_view
```

## Style and commits

Python uses Ruff with a 110-character line length. YAML/TOML and whitespace checks run through
pre-commit. No JavaScript toolchain is configured until concrete feature code exists. Use Conventional
Commits, keep changes focused, and update `CHANGELOG.md` for user-visible behavior.
