#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Check the canonical project version against Frappe metadata and an optional tag."""

from __future__ import annotations

import argparse
import ast
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEMVER_TAG = re.compile(
    r"^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)"
    r"(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)"
    r"(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)


def project_version() -> str:
    with (ROOT / "pyproject.toml").open("rb") as project_file:
        return tomllib.load(project_file)["project"]["version"]


def package_version() -> str:
    tree = ast.parse((ROOT / "frappe_split_view" / "__init__.py").read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "__version__":
                    value = ast.literal_eval(node.value)
                    if isinstance(value, str):
                        return value
    raise ValueError("frappe_split_view.__version__ is missing or is not a string literal")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag", help="release tag to verify (strict SemVer with leading v)")
    args = parser.parse_args()

    canonical = project_version()
    compatibility = package_version()
    errors: list[str] = []
    if compatibility != canonical:
        errors.append(
            f"frappe_split_view.__version__ ({compatibility}) does not match pyproject.toml ({canonical})"
        )

    if args.tag:
        match = SEMVER_TAG.fullmatch(args.tag)
        if not match:
            errors.append(f"tag is not strict SemVer with a leading v: {args.tag}")
        elif args.tag[1:] != canonical:
            errors.append(f"tag version ({args.tag[1:]}) does not match pyproject.toml ({canonical})")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    print(f"version consistency check passed: {canonical}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
