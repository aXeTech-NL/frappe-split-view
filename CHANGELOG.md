# Changelog

All notable changes to this project will be documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

## [16.0.1] - 2026-08-19

### Highlights

- Linked-document filters now survive hard navigation from an embedded Split View form.

### Added

- Pure JavaScript coverage for scalar and structured route-option encoding.

### Changed

- Scalar route options are written to hard-navigation query strings as plain values, while arrays
  and objects retain their JSON representation.

### Fixed

- Prevented scalar link filters from gaining literal quotation marks, which caused intermittent
  filter mismatches depending on whether navigation started from Split View or a full-page form.

### Compatibility

- Keeps the same experimental Frappe `>=16.0.0,<17.0.0` compatibility range and exact inspected
  Frappe `v16.31.0` reference as `16.0.0`.

### Upgrade notes

- Run `bench update --apps frappe_split_view` or fetch the new immutable release, then execute
  `bench build --app frappe_split_view` and restart Desk processes.

## [16.0.0] - 2026-08-12

### Added

- Split is available in Frappe's per-DocType Default View options for supported DocTypes.
- Uninstall cleanup removes persisted Split defaults before the view implementation is removed.

### Changed

- The displayed app and module name is now **Split View**; the stable technical package identifier remains `frappe_split_view`.
- The embedded right-pane header shows only the current document title instead of the complete Desk breadcrumb.
- The Frappe v16-compatible development line lives on `version-16`.
- The app version follows the compatible Frappe major release line, starting at `16.0.0`.

### Fixed

## [0.1.0-alpha.1] - 2026-08-12

### Added

- Experimental Split entry in the pinned Frappe v16 view selector and `/view/split` route.
- Stock ListView/list controls in an app-owned two-pane layout with an accessible bounded divider.
- One persistent stock `frappe.ui.form.Form` for switching and explicitly saving existing records of
  one ordinary DocType per JavaScript session.
- Dirty-state guards, detail-open-aware cached-page `cur_frm` handling, page-cache/sidebar
  restoration, render-complete/after-ajax generation protection, unsupported metadata fallback, and
  a guarded hard-navigation boundary for active-owner `frappe.set_route` and Form links.
- Pure JavaScript state/router/compatibility tests and targeted ToDo and ERPNext Project Cypress POCs.
- Required CI environments pinned to Frappe `v16.31.0` and ERPNext `v16.32.0`.

### Changed

- Marked the package as `0.1.0-alpha.1` and documented the exact inspected Frappe/ERPNext commits and
  experimental lifecycle/routing limits.

### Fixed

- Preserved native new-tab routing semantics while the active embedded Form route boundary is installed.
