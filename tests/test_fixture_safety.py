# SPDX-License-Identifier: MIT
"""Exercise fixture entry guards with stubs, never a database or an installed Bench."""

import importlib.util
import sys
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import Mock, patch

HELPERS = Path(__file__).resolve().parents[1] / "frappe_split_view/tests/ui_test_helpers.py"


def load_helpers(allow_tests):
    frappe = ModuleType("frappe")
    frappe.conf = SimpleNamespace(allow_tests=allow_tests)
    frappe.throw = Mock(side_effect=PermissionError("Test fixtures are disabled"))
    frappe.db = Mock()
    frappe.get_doc = Mock()
    frappe.get_installed_apps = Mock(return_value=["frappe", "erpnext"])
    nestedset = ModuleType("frappe.utils.nestedset")
    nestedset.get_root_of = Mock()
    modules = {
        "frappe": frappe,
        "frappe.utils": ModuleType("frappe.utils"),
        "frappe.utils.nestedset": nestedset,
    }
    spec = importlib.util.spec_from_file_location("fixture_guard_test_helpers", HELPERS)
    helpers = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(helpers)
    return helpers, frappe


class TestFixtureSafety(unittest.TestCase):
    def test_both_fixtures_refuse_before_accessing_any_site_data(self):
        for enabled in (False, None, 0):
            for name in ("setup_child_grid_poc", "setup_erpnext_project_poc"):
                with self.subTest(allow_tests=enabled, helper=name):
                    helpers, frappe = load_helpers(enabled)
                    with self.assertRaises(PermissionError):
                        getattr(helpers, name)()
                    frappe.throw.assert_called_once()
                    self.assertEqual(frappe.db.mock_calls, [])
                    frappe.get_doc.assert_not_called()
                    frappe.get_installed_apps.assert_not_called()

    def test_enabled_test_site_can_reach_fixture_setup(self):
        for name in ("setup_child_grid_poc", "setup_erpnext_project_poc"):
            with self.subTest(helper=name):
                helpers, frappe = load_helpers(True)
                # Stop at the first database read: no fixture is ever created by this test.
                frappe.db.exists.side_effect = RuntimeError("database boundary")
                with self.assertRaisesRegex(RuntimeError, "database boundary"):
                    getattr(helpers, name)()
                frappe.throw.assert_not_called()
                frappe.get_doc.assert_not_called()
                frappe.db.commit.assert_not_called()
