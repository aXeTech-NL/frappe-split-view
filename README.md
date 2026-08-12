# Frappe Split View

[![CI](https://github.com/aXeTech-NL/frappe-split-view/actions/workflows/ci.yml/badge.svg)](https://github.com/aXeTech-NL/frappe-split-view/actions/workflows/ci.yml)

Frappe Split View is an experimental app intended to add a generic master-detail view to Frappe
Desk: a record list on the left and the selected document on the right.

> **Bootstrap status:** this repository does not yet implement Split View. It is not production-ready.
> Embedding Frappe's standard Form while a List View remains active is an unproven technical POC and
> the next milestone.

## Compatibility

| App version | Declared Frappe range | Tested status |
| --- | --- | --- |
| 0.1.x | `>=16.0.0,<17.0.0` | Unverified / experimental |

The package metadata declares Frappe v16 compatibility, but no Bench or Frappe runtime was available
for this bootstrap. Static tests do not establish runtime compatibility. See
[compatibility notes](docs/compatibility.md).

## Planned capabilities

Subject to the POC, the project intends to provide a generic list/detail layout, reuse the standard
Form where safely possible, preserve routing and history, support a resizable divider, and fall back
to full-page Form View on narrow screens. None of these features is implemented yet.

## Installation (for development validation)

There is no functional release tag yet. In a Frappe v16 Bench, a development checkout can eventually
be evaluated with:

```bash
bench get-app https://github.com/aXeTech-NL/frappe-split-view
bench --site <site> install-app frappe_split_view
bench build
bench restart
```

Replace `<site>` with the target site. Production installations should eventually pin a release tag
with `bench get-app --branch vX.Y.Z ...`; do not deploy the current bootstrap in production.

## Updating and configuration

No runtime feature, configuration, or migration is present. Once releases exist, update by checking
out an explicit release tag, running `bench --site <site> migrate`, rebuilding assets, and restarting.

## Known limitations

- Split View, the view-selector entry, list selection, routing, resizing, and responsive behavior are
  not implemented.
- Standard Form/FormView embedding, including `cur_frm`, dirty state, toolbar, scripts, child tables,
  workflow, navigation, and teardown, has not been proven.
- Exact Frappe v16 selector and lifecycle extension points must be inspected in a pinned runtime.
- Install, build, test, migrate, upgrade, and uninstall have not been run locally because this
  repository has no Bench/Frappe runtime.
- Ordinary and special DocType behavior has not been tested.

## Development

See [development setup](docs/development.md), [architecture](docs/architecture.md), and
[contributing guidelines](CONTRIBUTING.md). Dependency-free bootstrap checks are:

```bash
python scripts/check_version.py
python -m unittest discover -s tests -v
python -m compileall -q frappe_split_view scripts tests
```

## Security

Read [SECURITY.md](SECURITY.md). Do not disclose vulnerabilities in public issues.

## Contributing

Contributions are welcome under the [Code of Conduct](CODE_OF_CONDUCT.md). Use Conventional Commits
and follow the pull request process in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — Copyright (c) 2026 Frappe Split View contributors.
