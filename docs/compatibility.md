# Compatibility

| App version | Frappe version | Declaration | Tested status |
| --- | --- | --- | --- |
| 0.1.x | 16.x | `>=16.0.0,<17.0.0` | Unverified / experimental |

The dependency range is consumed by Bench/Frappe Cloud and limits installation intent. It is not a
claim that this app has passed runtime testing. This bootstrap was created without a local Bench,
Frappe site, browser test environment, or current v16 source checkout.

## Promotion criteria

Before describing a release as tested with Frappe v16, record the exact Frappe version/commit and pass:

- clean Bench app retrieval and site installation;
- `bench build` and `bench --site <site> run-tests --app frappe_split_view`;
- migration, update, and uninstall checks;
- the embedded Form/list POC and its lifecycle tests;
- representative normal and special DocType fallback tests.

Project, Task, Customer, and Sales Order are prospective integration cases; ERPNext-specific cases
must remain optional because ERPNext is not a base dependency.

Do not broaden the range for v17 until a v17 CI environment and routing/Form-lifecycle validation pass.
Internal v16 compatibility code, if the POC requires any, must be isolated and commit-pinned.
