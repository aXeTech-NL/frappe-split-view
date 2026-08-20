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

    def test_uninstall_cleanup_removes_split_default_view(self):
        from frappe_split_view.uninstall import reset_split_default_views

        existing_split_defaults = frappe.get_all(
            "DocType",
            filters={"default_view": "Split"},
            pluck="name",
        )
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
        try:
            frappe.clear_cache(doctype="ToDo")
            self.assertEqual(frappe.get_meta("ToDo").default_view, "Split")
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
            for doctype in existing_split_defaults:
                frappe.db.set_value(
                    "DocType",
                    doctype,
                    "default_view",
                    "Split",
                    update_modified=False,
                )
                frappe.clear_cache(doctype=doctype)
            frappe.clear_cache(doctype="ToDo")
