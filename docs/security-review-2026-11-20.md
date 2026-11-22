# Bounded security review — 2026-11-20

## Scope and conclusion

Reviewed Split View v16.2.2 (`b4b4ea646becfe4f13361227c56f6e78f0ab7e86`) and the
unreleased Form-context compatibility changes. An independent read-only reviewer examined both
baseline and final working-tree code. No confirmed exploitable vulnerability was found in this
scope. This is a source review with targeted local checks, not a penetration test, dependency audit,
complete permissions-matrix assessment or production-security guarantee.

The app still has no app-defined whitelisted endpoint or permission override. Loading and saving
use native Frappe APIs. Document titles and fallback messages use text nodes; intercepted navigation
is constrained to canonical same-origin Desk paths. The new `page.frm` binding does not create a
second Form, fetch data through a new path, grant permissions or automatically send data to a model.

## Applied hardening

1. **Test-site guard:** the privileged ERPNext setup fixture now checks `allow_tests` before even
   looking up installed apps or site data. It remains a non-whitelisted Bench helper. Both fixture
   guards have stub-based tests proving disabled sites reach no database operations. This prevents
   accidental use by an already privileged operator; it was not an unauthenticated API vulnerability.
2. **Release permissions:** validation and required CI inherit read-only repository access. Only
   the final release-publication job requests `contents: write`. Existing source-distribution build
   steps still share that job; isolating publishing further is an additional hardening option.
3. **Retention documentation:** list filters may contain sensitive values even though snapshots
   exclude fetched document bodies. Native-style route options can appear in URLs or origin-wide
   browser storage. User-scoped restoration is not encryption or isolation from same-origin scripts.

## Form-context security/lifecycle checks

- Publish only the visible, active, fully loaded Form with matching route, selected record and
  document identity. Each property read rechecks those conditions.
- Withdraw publication during fetch, Close, hide, navigation and unsafe fallback.
- Restore the prior authorized selection after safe fetch/render failure; reject stale responses.
- Preserve dirty guards and a different native owner's property/reassignment.
- Browser probes on Frappe v16.60.2 (`2df0425571ebbaed878eabc3edc5b7e7c3327ae0`) used
  existing engineer and reader accounts against four Workbench DocTypes. The actual unmodified
  Flow client reader returned form text and unsaved metadata; close/hide, reopen/show and record
  switching retained the expected ownership. Temporary client-only dirty flags were restored.
- No model calls, document/comment saves, saved preference changes or role grants were made by
  those browser probes. They tested the client reader, not a complete model/socket round trip.

Validation: 54 dependency-free JavaScript tests, 7 dependency-free Python tests, 2 local Bench
installation/uninstall-cleanup tests, local asset build, Ruff and repository pre-commit checks.
The updated clean ToDo/ERPNext Cypress suites have not been rerun in their pinned CI environments.

## GitHub posture checked read-only

At review time the GitHub APIs returned:

- No open CodeQL/code-scanning alerts.
- No open Dependabot alerts.
- Private vulnerability reporting enabled.
- **Secret scanning disabled** (the alerts API reported this explicitly).

An empty alert list is not proof that all dependencies or code have been scanned. No repository
security settings were changed. Enabling secret scanning/push protection requires a maintainer
follow-up where available.

## Remaining hardening

- Pin mutable Actions references and service images to reviewed immutable SHAs/digests.
- Verify fetched Frappe/ERPNext revisions before dependency installation executes their code;
  current post-fetch commit checks are consistency checks, not a full supply-chain boundary.
- Continue clean-version/browser CI, broader permission testing and upstream Frappe security updates.
- Full physical Form ownership of the Desk container and the accessible list drawer remain issue
  #15; this context compatibility fix does not claim to complete that architectural work.
