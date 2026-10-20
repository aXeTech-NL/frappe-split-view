# Compatibility

| App version | Declared Frappe version | Exact inspected reference | Status |
| --- | --- | --- | --- |
| Unreleased | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` and `v16.52.0` (`4515014c87ece6cb20ee91d2cfb121c5cbd1ff4a`) | Experimental; see CI results for this ref |
| `16.2.1` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | Technical POC / experimental |
| `16.2.0` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | Technical POC / experimental |
| `16.1.0` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | Technical POC / experimental |
| `16.0.1` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | Technical POC / experimental |
| `16.0.0` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | Technical POC / experimental |

The metadata range controls Bench installation intent; it is not a generic v16 runtime claim. The
selector, router maps, per-DocType Default View option helper, ListView activation seam, Form constructor, page cache, and global lifecycle
were inspected at the exact Frappe commit above. PR #6 passed the required pinned browser jobs before
release; this evidence remains limited to the recorded references and POC scenarios.

## Automated environments

The required workflows are:

- clean Frappe-only `v16.31.0` and `v16.52.0` Bench install/build/server tests, targeted ToDo
  Cypress smoke and a custom parent/child-grid template/action/Save regression on both refs;
- distinct ERPNext `v16.32.0` installation on Frappe `v16.31.0` and targeted Project Cypress smoke.

Frappe v16.52.0 replaces `ListViewSelect.setup_views()` with a nested switcher. The unreleased
adapter extends its `get_views()` definitions and resolves Split's label before trigger construction;
legacy Frappe retains its separate adapter. Saved layouts, reports and boards remain native.
Incomplete APIs still fail closed. Versions through 16.2.1 disable Split on the inspected v16.52.0 ref.

Local Workbench verification on v16.52.0 covers its real Requirement Analysis child-grid cards,
custom actions being present, document reload and Close; it does not exercise proposal publication.
The generic CI fixture additionally exercises a refresh-hook action, Save and Form reuse. The native
report side panel remains separate: it is read-only and does not run the normal Form/grid scripts.

The ERPNext reference inspected for the alpha is `v16.32.0`
(`81a6f97566b83609c3917404a560b673050e907d`). ERPNext is not a Python/package dependency. A passing
Project spec is evidence for that environment only, not general ERPNext compatibility.

## Supported POC envelope

- existing ordinary non-Single, non-table DocTypes, including tree-backed DocTypes through their stock ListView;
- one embedded Form owner and one DocType in each JavaScript session;
- stock ListView stays mounted while the selected document owns the URL and Form context;
- marked document reload/deep links with tab-local filter, sort, paging and scroll restoration;
- explicit standard Form save and repeated existing-record switching;
- hard full-page boundary on app-controlled escape paths;
- Split selectable as the standard Default View for each supported DocType.

## Not supported or asserted

- new/copy/rename/amend/print/workflow and custom route actions;
- multiple DocTypes or embedded Forms per session;
- custom DocType Layout, Tree, Single, table and special controllers;
- complete native routing/history parity (Back/Forward uses a reload boundary);
- safe Form teardown, long-session listener stability, canonical realtime conflict parity;
- custom Tree-view controller behavior inside Split, arbitrary client scripts or child tables beyond
  the targeted fixture above, permissions matrices, mobile embedded layout, or general ERPNext behavior.

Failures in compatibility probes must leave native List/Form routing intact. Unsupported metadata
receives a full-page fallback rather than an attempted embedded Form.

## Promotion gates

Do not broaden claims until clean CI passes, browser identity/save/dirty/lifecycle assertions pass,
and exploratory tests cover links, scripts, permissions, toolbar, grids, dialogs, accessibility,
memory growth, error paths, install/upgrade/uninstall, and current release commits.
