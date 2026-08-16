# Contributing

Split View is experimental. The current repository contains a technical POC;
the embedded Form feasibility POC is the next milestone.

## Development setup

Use Python 3.14, Node 24, MariaDB 11.8, and the current Frappe `version-16` line. Follow the
[development guide](docs/development.md) to create a Bench and install the app. Local environments
without Bench can run only dependency-free checks.

## Checks

```bash
python scripts/check_version.py
python -m unittest discover -s tests -v
python -m compileall -q frappe_split_view scripts tests
pre-commit run --all-files
```

Inside a configured Bench, also run the app test, asset build, and installation checks documented in
`docs/development.md`. Do not interpret static checks as proof of Frappe compatibility.

## Changes and pull requests

- Open an issue for significant behavior or architecture changes.
- Keep changes focused and add tests for behavior.
- Update `CHANGELOG.md` under `Unreleased` for user-visible changes.
- Use short-lived `feature/`, `fix/`, `docs/`, `refactor/`, or `chore/` branches.
- Prefer pull requests and squash merging. PR titles should use Conventional Commits.
- Resolve review comments and ensure CI passes before merge.

Use Conventional Commit types such as `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`,
`ci`, `chore`, and `revert`. For example: `ci: add frappe v16 bench test`.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). No contributor
license agreement is required.
