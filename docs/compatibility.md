# Compatibility

| App version | Declared Frappe version | Exact inspected reference | Status |
| --- | --- | --- | --- |
| `16.1.0` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | Technical POC / experimental |
| `16.0.1` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | Technical POC / experimental |
| `16.0.0` | `>=16.0.0,<17.0.0` | Frappe `v16.31.0` (`6a329d068416768ec47ccd3326b9cc95a8d7bf99`) | Technical POC / experimental |

The metadata range controls Bench installation intent; it is not a generic v16 runtime claim. The
selector, router maps, per-DocType Default View option helper, ListView activation seam, Form constructor, page cache, and global lifecycle
were inspected at the exact Frappe commit above. PR #6 passed the required pinned browser jobs before
release; this evidence remains limited to the recorded references and POC scenarios.

## Automated environments

The required workflows are:

- clean Frappe-only `v16.31.0` Bench install/build/server tests and targeted ToDo Cypress smoke;
- distinct required ERPNext `v16.32.0` installation and targeted Project Cypress smoke.

The ERPNext reference inspected for the alpha is `v16.32.0`
(`81a6f97566b83609c3917404a560b673050e907d`). ERPNext is not a Python/package dependency. A passing
Project spec is evidence for that environment only, not general ERPNext compatibility.

## Supported POC envelope

- existing ordinary non-Single, non-table DocTypes, including tree-backed DocTypes through their stock ListView;
- one embedded Form owner and one DocType in each JavaScript session;
- stock ListView stays mounted;
- explicit standard Form save and repeated existing-record switching;
- hard full-page boundary on app-controlled escape paths;
- Split selectable as the standard Default View for each supported DocType.

## Not supported or asserted

- new/copy/rename/amend/print/workflow and custom route actions;
- multiple DocTypes or embedded Forms per session;
- custom DocType Layout, Tree, Single, table and special controllers;
- complete refresh/deep-link/Back/Forward restoration;
- safe Form teardown, long-session listener stability, canonical realtime conflict parity;
- custom Tree-view controller behavior inside Split, arbitrary client scripts, child tables,
  permissions matrices, mobile embedded layout, or general ERPNext behavior.

Failures in compatibility probes must leave native List/Form routing intact. Unsupported metadata
receives a full-page fallback rather than an attempted embedded Form.

## Promotion gates

Do not broaden claims until clean CI passes, browser identity/save/dirty/lifecycle assertions pass,
and exploratory tests cover links, scripts, permissions, toolbar, grids, dialogs, accessibility,
memory growth, error paths, install/upgrade/uninstall, and current release commits.
