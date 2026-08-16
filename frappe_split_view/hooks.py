# SPDX-License-Identifier: MIT

app_name = "frappe_split_view"
app_title = "Split View"
app_publisher = "Split View contributors"
app_description = "A generic master-detail Split View for Frappe Desk."
app_license = "MIT"

before_uninstall = "frappe_split_view.uninstall.before_uninstall"

# Logical bundle names are discovered and fingerprinted by Frappe's esbuild pipeline.
app_include_js = ["frappe_split_view.bundle.js"]
app_include_css = ["frappe_split_view.bundle.css"]
