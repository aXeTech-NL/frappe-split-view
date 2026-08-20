# Release process

Split View uses strict Semantic Versioning and immutable annotated `vX.Y.Z` tags. Prerelease
forms such as `v0.1.0-alpha.1` are allowed. Do not use floating tags.

## Release checklist

1. Confirm package and app versions match and update the dated changelog section.
2. Record the exact required-CI Frappe and ERPNext tags/commits and keep compatibility wording experimental.
3. Run Python/version tests, pure JS tests, compilation, `git diff --check`, pre-commit, actionlint,
   and source-distribution build.
4. Run clean Frappe v16 install/build/migrate/server tests.
5. Run targeted ToDo Cypress and inspect uploaded logs/screenshots/videos on failure.
6. Run the separate ERPNext v16 Project integration smoke.
7. Manually inspect repeated switching/memory, errors, navigation escapes, permissions, Form scripts,
   keyboard/accessibility, mobile fallback, and install/upgrade/uninstall.
8. Confirm `SECURITY.md` exists and GitHub private vulnerability reporting (or another documented
   private maintainer channel) is configured.
9. Require review and green GitHub checks. CI results must not be described as passed before GitHub
   actually runs them.
10. Only then commit release changes and create an annotated tag, for example:
   `git tag -a v16.0.0 -m "Split View v16.0.0"`.
11. Push the tag and verify release notes and installation from the immutable tag.

The implementation task must not create, push, or publish the tag. Normal full-page escape testing
must verify that a hard reload occurs before FormFactory can create another Form.

Every release note includes:

```markdown
## Highlights
## Added
## Changed
## Fixed
## Compatibility
## Upgrade notes
```

The `16.x` line remains a technical POC. Do not claim production readiness, complete routing/history,
generic DocType or ERPNext support, safe teardown, or lifecycle parity.
