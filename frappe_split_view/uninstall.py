# SPDX-License-Identifier: MIT

import frappe


def reset_split_default_views():
    """Remove persisted Split defaults before the view implementation disappears."""
    doctypes = set(frappe.get_all("DocType", filters={"default_view": "Split"}, pluck="name"))
    property_setters = frappe.get_all(
        "Property Setter",
        filters={"property": "default_view", "value": "Split"},
        fields=["name", "doc_type"],
    )
    for setter in property_setters:
        if setter.doc_type:
            doctypes.add(setter.doc_type)
        frappe.delete_doc(
            "Property Setter",
            setter.name,
            ignore_permissions=True,
            force=True,
        )
    for doctype in doctypes:
        if frappe.db.exists("DocType", doctype):
            frappe.db.set_value(
                "DocType",
                doctype,
                "default_view",
                "List",
                update_modified=False,
            )
        frappe.clear_cache(doctype=doctype)


def before_uninstall():
    reset_split_default_views()
