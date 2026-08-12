# SPDX-License-Identifier: MIT
"""Release-PoC fixtures used only by the optional ERPNext browser CI job."""

import frappe


def setup_erpnext_project_poc() -> str:
    """Create the minimum Company fixture and mark installed-app setup state current."""
    if "erpnext" not in frappe.get_installed_apps():
        frappe.throw("ERPNext must be installed before creating the Project POC fixture")

    company_name = "Frappe Split View POC Company"
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

    # ERPNext is considered setup once a Company exists. Refresh the singleton that
    # drives frappe.is_setup_complete() so Desk does not reroute the browser POC.
    frappe.get_single("Installed Applications").update_versions()
    frappe.db.commit()
    return company_name
