context("Frappe Split View ERPNext Project POC", () => {
  const marker = `Split Project ${Date.now()}`;
  let company;
  let first;
  let second;

  before(() => {
    cy.login();
    cy.visit("/desk");
    cy.request(
      "GET",
      "/api/resource/Company?fields=[%22name%22]&limit_page_length=1",
    )
      .then(({ body }) => {
        if (body.data[0]?.name) return body.data[0];
        return cy.insert_doc("Company", {
          company_name: `${marker} Company`,
          abbr: `SV${String(Date.now()).slice(-3)}`,
          default_currency: "USD",
          country: "United States",
        });
      })
      .then((companyDoc) => {
        company = companyDoc.name;
        return cy.insert_doc("Project", {
          project_name: `${marker} One`,
          company,
          status: "Open",
        });
      })
      .then((doc) => {
        first = doc.name;
        return cy.insert_doc("Project", {
          project_name: `${marker} Two`,
          company,
          status: "Open",
        });
      })
      .then((doc) => {
        second = doc.name;
      });
  });

  it("keeps one stock Project Form while switching existing Projects", () => {
    cy.visit("/desk/project/view/split");
    cy.window().then((win) =>
      win.cur_list.filter_area.add([
        ["Project", "project_name", "like", `%${marker}%`],
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
    cy.get(`[data-split-view-list] a[data-name="${second}"]`).first().click();
    cy.window().then((win) => {
      expect(win.frappe_split_view.debug.owner.frm).to.eq(
        win.__projectSplitForm,
      );
      expect(win.__projectSplitForm.docname).to.eq(second);
      expect(win.frappe.container.page).to.eq(win.cur_list.parent);
    });
  });
});
