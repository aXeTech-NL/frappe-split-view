# SPDX-License-Identifier: MIT

import subprocess
import sys
import tomllib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
with (ROOT / "pyproject.toml").open("rb") as project_file:
    PROJECT_VERSION = tomllib.load(project_file)["project"]["version"]


def different_version(version: str) -> str:
    core = version.split("-", maxsplit=1)[0].split("+", maxsplit=1)[0]
    major, minor, patch = (int(part) for part in core.split("."))
    return f"{major}.{minor}.{patch + 1}"


class TestVersionConsistency(unittest.TestCase):
    def test_package_and_project_versions_match(self):
        result = subprocess.run(
            [sys.executable, "scripts/check_version.py"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(f"version consistency check passed: {PROJECT_VERSION}", result.stdout)

    def run_check(self, *arguments):
        return subprocess.run(
            [sys.executable, "scripts/check_version.py", *arguments],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )

    def test_matching_release_tag_is_accepted(self):
        result = self.run_check("--tag", f"v{PROJECT_VERSION}")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_mismatched_release_tag_is_rejected(self):
        result = self.run_check("--tag", f"v{different_version(PROJECT_VERSION)}")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not match pyproject.toml", result.stderr)

    def test_non_semver_release_tag_is_rejected(self):
        result = self.run_check("--tag", "v0.1-final")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not strict SemVer", result.stderr)

    def test_non_ascii_digits_are_rejected(self):
        result = self.run_check("--tag", "v٠.1.0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not strict SemVer", result.stderr)
