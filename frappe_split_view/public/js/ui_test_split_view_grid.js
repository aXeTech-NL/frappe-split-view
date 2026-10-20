// This fixture is evaluated in Desk by the real ScriptManager, not in Cypress's
// runner window. No Form, Grid, save endpoint or document permissions are mocked.
function installGridFixtureScript() {
  const bound = new WeakSet();
  frappe.ui.form.on("Split View POC Parent", {
    refresh(frm) {
      const wrapper = frm.fields_dict.items.grid.wrapper[0];
      wrapper.dataset.splitGridHook = frm.doc.name;
      if (bound.has(wrapper)) return;
      bound.add(wrapper);
      wrapper.addEventListener("click", (event) => {
        if (!event.target.closest("[data-split-grid-action]")) return;
        event.preventDefault();
        event.stopPropagation();
        frm.set_value("action_count", (frm.doc.action_count || 0) + 1);
      }, true);
    },
  });
}

context("Split View child-grid rendering", () => {
  const doctype = "Split View POC Parent";
  const marker = `split-grid-${Date.now()}`;
  let first;
  let second;

  before(() => {
    cy.login();
    cy.visit("/desk");
    cy.insert_doc(doctype, {
      title: `${marker}-one`,
      action_count: 0,
      items: [{ description: "First & second" }],
    }).then((doc) => { first = doc.name; });
    cy.insert_doc(doctype, {
      title: `${marker}-two`,
      action_count: 0,
      items: [{ description: "Second card" }],
    }).then((doc) => { second = doc.name; });
  });

  it("retains a native child-grid template, refresh hook and action across record switches", () => {
    // Supply template/script metadata through the real load response. This also
    // survives metadata refetches and puts the script in the application's realm.
    cy.intercept("GET", "**/api/method/frappe.desk.form.load.getdoctype*", (request) => {
      request.continue((response) => {
        const meta = response.body.docs?.find((doc) => doc.name === doctype);
        if (!meta) return;
        meta.__form_grid_templates = {
          items: `{% if (doc) { %}
            <article data-split-grid-card>
              <strong>{%= frappe.utils.escape_html(doc.description) %}</strong>
              <button type="button" data-split-grid-action>Mark reviewed</button>
            </article>
          {% } %}`,
        };
        meta.__custom_js = `${meta.__custom_js || ""}\n(${installGridFixtureScript.toString()})();`;
      });
    });
    cy.visit("/desk/split-view-poc-parent/view/split");
    cy.get("[data-frappe-split-view]").should("be.visible");
    cy.window().then(async (win) => {
      await win.cur_list.ready;
      await win.cur_list.filter_area.add([[doctype, "title", "like", `%${marker}%`]]);
    });
    cy.get(`[data-split-view-list] a[data-name="${first}"]`).first().click();
    cy.get("[data-split-form-host='true']").should("be.visible");
    cy.get(`[data-split-grid-hook="${first}"] [data-split-grid-card] strong`)
      .should("have.text", "First & second");
    cy.window().then((win) => {
      win.__gridForm = win.cur_frm;
      expect(win.cur_frm).to.be.instanceOf(win.frappe.ui.form.Form);
      expect(win.cur_frm.fields_dict.items.grid.frm).to.eq(win.cur_frm);
      expect(win.cur_frm.fields_dict.items.grid.template).to.be.a("string");
    });
    cy.get("[data-split-grid-action]").click();
    cy.window().should((win) => {
      expect(win.cur_frm.doc.action_count).to.eq(1);
      expect(win.cur_frm.is_dirty()).to.eq(true);
    });
    cy.intercept("POST", "/api/method/frappe.desk.form.save.savedocs").as("saveGridParent");
    cy.get("[data-split-form-host] .primary-action[data-label='Save']").click();
    cy.wait("@saveGridParent");
    cy.request("GET", `/api/resource/${doctype}/${first}`).then(({ body }) => {
      expect(body.data.action_count).to.eq(1);
      expect(body.data.items[0].description).to.eq("First & second");
    });
    cy.window().then((win) => win.cur_list.activateRecord(second));
    cy.get(`[data-split-grid-hook="${second}"] [data-split-grid-card] strong`)
      .should("have.text", "Second card");
    cy.window().then((win) => {
      expect(win.cur_frm).to.eq(win.__gridForm);
      expect(win.cur_frm.doc.action_count).to.eq(0);
      return win.cur_list.activateRecord(first);
    });
    cy.get(`[data-split-grid-hook="${first}"] [data-split-grid-card] strong`)
      .should("have.text", "First & second");
    cy.window().should((win) => {
      expect(win.cur_frm).to.eq(win.__gridForm);
      expect(win.cur_frm.doc.action_count).to.eq(1);
    });
  });
});
