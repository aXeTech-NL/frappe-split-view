context("Split View ERPNext Project POC", () => {
  const firstProjectName = "Split View POC Project One";
  const secondProjectName = "Split View POC Project Two";
  const departmentName = "Split View POC Department";
  let first;
  let second;
  let department;

  before(() => {
    cy.login();
    cy.request({
      method: "GET",
      url: "/api/resource/Project",
      qs: {
        fields: JSON.stringify(["name", "project_name"]),
        filters: JSON.stringify([
          [
            "Project",
            "project_name",
            "in",
            [firstProjectName, secondProjectName],
          ],
        ]),
        limit_page_length: 2,
      },
    }).then(({ body }) => {
      const byProjectName = Object.fromEntries(
        body.data.map((project) => [project.project_name, project.name]),
      );
      first = byProjectName[firstProjectName];
      second = byProjectName[secondProjectName];
      expect(first).to.be.a("string").and.not.be.empty;
      expect(second).to.be.a("string").and.not.be.empty;
    });
    cy.request({
      method: "GET",
      url: "/api/resource/Department",
      qs: {
        fields: JSON.stringify(["name", "department_name"]),
        filters: JSON.stringify([
          ["Department", "department_name", "=", departmentName],
        ]),
        limit_page_length: 1,
      },
    }).then(({ body }) => {
      department = body.data[0]?.name;
      expect(department).to.be.a("string").and.not.be.empty;
    });
  });

  it("keeps one stock Project Form while switching existing Projects", () => {
    cy.visit("/desk/project/view/split");
    cy.get("[data-frappe-split-view][data-doctype='Project']").should(
      "be.visible",
    );
    cy.window().its("cur_list").should("not.be.null");
    cy.window().then((win) =>
      win.cur_list.filter_area.add([
        [
          "Project",
          "project_name",
          "in",
          [firstProjectName, secondProjectName],
        ],
      ]),
    );
    cy.get(`[data-split-view-list] a[data-name="${first}"]`).first().click();
    cy.get("[data-split-form-host='true']").should("be.visible");
    cy.get("[data-split-form-host] [data-split-document-title]")
      .should("have.length", 1)
      .and("have.text", firstProjectName);
    cy.get("[data-split-form-host] .navbar-breadcrumbs > li").should(
      "have.length",
      1,
    );
    cy.window().then((win) => {
      const owner = win.frappe_split_view.debug.owner;
      expect(owner.frm).to.be.instanceOf(win.frappe.ui.form.Form);
      expect(owner.frm.docname).to.eq(first);
      win.__projectSplitForm = owner.frm;
    });
    cy.window().then((win) => win.cur_list.activateRecord(second));
    cy.get("[data-split-form-host] [data-split-document-title]")
      .should("have.length", 1)
      .and("have.text", secondProjectName);
    cy.window().then((win) => {
      expect(win.frappe_split_view.debug.owner.frm).to.eq(
        win.__projectSplitForm,
      );
      expect(win.__projectSplitForm.docname).to.eq(second);
      expect(win.frappe.container.page).to.eq(win.cur_list.parent);
    });
  });

  it("supports default Split for a tree-backed Department and preserves Tree", () => {
    cy.request("GET", "/api/resource/DocType/Department").then(({ body }) => {
      expect(body.data.is_tree).to.eq(1);
      expect(body.data.default_view).to.eq("Split");
    });
    cy.visit("/desk/department");
    cy.get("[data-frappe-split-view][data-doctype='Department']").should(
      "be.visible",
    );
    cy.window().should((win) => {
      expect(win.frappe.get_route()).to.deep.eq([
        "List",
        "Department",
        "Split",
      ]);
    });
    cy.window().then((win) =>
      win.cur_list.filter_area.add([
        ["Department", "department_name", "=", departmentName],
      ]),
    );
    cy.get(`[data-split-view-list] a[data-name="${department}"]`)
      .first()
      .click();
    cy.get("[data-split-form-host='true']").should("be.visible");
    cy.window().then((win) => {
      const owner = win.frappe_split_view.debug.owner;
      expect(owner.frm).to.be.instanceOf(win.frappe.ui.form.Form);
      expect(owner.frm.docname).to.eq(department);
    });

    cy.visit("/desk/department/view/tree");
    cy.window().should((win) => {
      expect(win.frappe.get_route()?.[0]).to.eq("Tree");
      expect(win.frappe.get_route()?.[1]).to.eq("Department");
    });
    cy.get("[data-frappe-split-view]").should("not.exist");
  });
});
