# SPDX-License-Identifier: MIT

import unittest
from unittest.mock import patch

try:
    import frappe
except ImportError:  # Allows dependency-free local discovery outside a Bench.
    frappe = None


@unittest.skipIf(frappe is None, "requires an installed Frappe Bench site")
class TestAppInstallation(unittest.TestCase):
    def test_app_is_installed_on_site(self):
        self.assertIn("frappe_split_view", frappe.get_installed_apps())

    def test_uninstall_cleanup_removes_split_default_view(self):
        from frappe_split_view.uninstall import reset_split_default_views

        setter = frappe.get_doc(
            {
                "doctype": "Property Setter",
                "doc_type": "ToDo",
                "doctype_or_field": "DocType",
                "property": "default_view",
                "property_type": "Select",
                "value": "Split",
            }
        ).insert(ignore_permissions=True)
        native_get_all = frappe.get_all

        def cleanup_scope(doctype, *args, **kwargs):
            if doctype == "DocType" and kwargs.get("filters") == {"default_view": "Split"}:
                return ["ToDo"]
            if doctype == "Property Setter" and kwargs.get("filters") == {
                "property": "default_view",
                "value": "Split",
            }:
                return [frappe._dict(name=setter.name, doc_type="ToDo")]
            return native_get_all(doctype, *args, **kwargs)

        try:
            frappe.clear_cache(doctype="ToDo")
            self.assertEqual(frappe.get_meta("ToDo").default_view, "Split")
            with patch("frappe_split_view.uninstall.frappe.get_all", side_effect=cleanup_scope):
                reset_split_default_views()
            self.assertFalse(frappe.db.exists("Property Setter", setter.name))
            frappe.clear_cache(doctype="ToDo")
            self.assertNotEqual(frappe.get_meta("ToDo").default_view, "Split")
        finally:
            if frappe.db.exists("Property Setter", setter.name):
                frappe.delete_doc(
                    "Property Setter",
                    setter.name,
                    ignore_permissions=True,
                    force=True,
                )
            frappe.clear_cache(doctype="ToDo")
