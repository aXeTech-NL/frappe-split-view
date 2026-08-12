context("Frappe Split View ERPNext Project POC", () => {
  const firstProjectName = "Frappe Split View POC Project One";
  const secondProjectName = "Frappe Split View POC Project Two";
  let first;
  let second;

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
    cy.window().then((win) => {
      const owner = win.frappe_split_view.debug.owner;
      expect(owner.frm).to.be.instanceOf(win.frappe.ui.form.Form);
      expect(owner.frm.docname).to.eq(first);
      win.__projectSplitForm = owner.frm;
    });
    cy.window().then((win) => win.cur_list.activateRecord(second));
    cy.window().then((win) => {
      expect(win.frappe_split_view.debug.owner.frm).to.eq(
        win.__projectSplitForm,
      );
      expect(win.__projectSplitForm.docname).to.eq(second);
      expect(win.frappe.container.page).to.eq(win.cur_list.parent);
    });
  });
});
