# SPDX-License-Identifier: MIT
"""Release-PoC fixtures used only by the optional ERPNext browser CI job."""

import frappe
from frappe.utils.nestedset import get_root_of


def setup_erpnext_project_poc() -> str:
    """Create the minimum Company fixture and mark installed-app setup state current."""
    if "erpnext" not in frappe.get_installed_apps():
        frappe.throw("ERPNext must be installed before creating the Project POC fixture")

    # Company creates a Goods In Transit warehouse and expects this ERPNext
    # setup-wizard fixture to exist.
    if not frappe.db.exists("Warehouse Type", "Transit"):
        frappe.get_doc({"doctype": "Warehouse Type", "name": "Transit"}).insert(ignore_permissions=True)

    company_name = "Split View POC Company"
    if not frappe.db.exists("Company", company_name):
        frappe.get_doc(
            {
                "doctype": "Company",
                "company_name": company_name,
                "abbr": "FSVPC",
                "default_currency": "USD",
                "country": "United States",
                "create_chart_of_accounts_based_on": "Standard Template",
                "chart_of_accounts": "Standard",
            }
        ).insert(ignore_permissions=True)

    department_name = "Split View POC Department"
    department_root = get_root_of("Department")
    if not department_root:
        department_root = frappe.get_doc(
            {
                "doctype": "Department",
                "department_name": "All Split View Departments",
                "company": company_name,
                "is_group": 1,
            }
        ).insert(ignore_permissions=True)
        department_root = department_root.name
    if not frappe.db.exists("Department", {"department_name": department_name}):
        frappe.get_doc(
            {
                "doctype": "Department",
                "department_name": department_name,
                "parent_department": department_root,
                "company": company_name,
            }
        ).insert(ignore_permissions=True)
    frappe.db.set_value(
        "DocType",
        "Department",
        "default_view",
        "Split",
        update_modified=False,
    )
    frappe.clear_cache(doctype="Department")

    for project_name in (
        "Split View POC Project One",
        "Split View POC Project Two",
    ):
        if not frappe.db.exists("Project", {"project_name": project_name}):
            frappe.get_doc(
                {
                    "doctype": "Project",
                    "project_name": project_name,
                    "company": company_name,
                    "status": "Open",
                }
            ).insert(ignore_permissions=True)

    # A Company marks ERPNext complete, while fresh Frappe normally also requires a
    # non-Administrator user. This fixture intentionally skips the interactive wizard,
    # so explicitly mark both setup-bearing apps complete before opening Desk.
    frappe.get_single("Installed Applications").update_versions()
    for app_name in ("frappe", "erpnext"):
        frappe.db.set_value(
            "Installed Application",
            {"app_name": app_name},
            "is_setup_complete",
            1,
        )
    frappe.db.set_single_value("System Settings", "setup_complete", 1)
    frappe.db.set_default("desktop:home_page", "workspace")
    frappe.clear_cache()
    if not frappe.is_setup_complete():
        frappe.throw("ERPNext Project POC setup state is incomplete")
    frappe.db.commit()
    return company_name
