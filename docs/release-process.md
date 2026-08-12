# Release process

Frappe Split View uses Semantic Versioning and immutable annotated `vX.Y.Z` tags. Prerelease forms
such as `v0.1.0-alpha.1`, `v0.1.0-beta.1`, and `v1.0.0-rc.1` are permitted. Do not use floating tags.
The bootstrap version `0.1.0` is metadata only: do not tag or release it until a meaningful POC exists.

## Checklist

1. Ensure `main` and the reusable full CI workflow are green.
2. Update `CHANGELOG.md` and confirm the compatibility declaration/evidence.
3. Update `pyproject.toml` and `frappe_split_view/__init__.py` together.
4. Run `python scripts/check_version.py` and all static/unit tests.
5. Run clean Frappe v16 installation, `bench build`, and app tests.
6. Run the documented manual/runtime regression suite.
7. Test upgrade from the previous release and clean uninstall.
8. Commit release changes using Conventional Commits.
9. Create an annotated tag: `git tag -a vX.Y.Z -m "Frappe Split View vX.Y.Z"`.
10. Push the tag; GitHub Actions reuses the full CI suite, validates strict SemVer and version equality,
    then creates or updates the GitHub Release.
11. Verify release headings and compatibility wording, prerelease status, and installation from the tag.
12. Mark latest only when appropriate.

Every release note must include:

```markdown
## Highlights
## Added
## Changed
## Fixed
## Compatibility
## Upgrade notes
```

Do not claim “Tested with Frappe v16” unless recorded real Bench and runtime checks passed. The release
workflow does not publish to PyPI; Frappe apps are installed from repositories through Bench.
