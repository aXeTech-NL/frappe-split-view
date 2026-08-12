# SPDX-License-Identifier: MIT

import unittest

try:
    import frappe
except ImportError:  # Allows dependency-free local discovery outside a Bench.
    frappe = None


@unittest.skipIf(frappe is None, "requires an installed Frappe Bench site")
class TestAppInstallation(unittest.TestCase):
    def test_app_is_installed_on_site(self):
        self.assertIn("frappe_split_view", frappe.get_installed_apps())
