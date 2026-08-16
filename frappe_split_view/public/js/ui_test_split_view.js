context("Split View ToDo POC", () => {
  const marker = `split-view-${Date.now()}`;
  let first;
  let second;
  let savedPriority;

  before(() => {
    cy.login();
    cy.visit("/desk");
    cy.insert_doc("ToDo", {
      description: `${marker}-one`,
      status: "Open",
      priority: "Medium",
    })
      .then((doc) => {
        first = doc.name;
        return cy.insert_doc("ToDo", {
          description: `${marker}-two`,
          status: "Open",
          priority: "Low",
        });
      })
      .then((doc) => {
        second = doc.name;
      });
  });

  it("registers Split and reuses one real stock Form", () => {
    cy.visit("/desk/todo/view/list");
    cy.get(".custom-btn-group [data-toggle='dropdown']").first().click();
    cy.get("[data-view='Split']").should("be.visible").click();
    cy.location("pathname").should("eq", "/desk/todo/view/split");
    cy.get("[data-frappe-split-view]")
      .should("have.attr", "data-doctype", "ToDo")
      .within(() => {
        cy.get("[data-split-view-list]").should("be.visible");
        cy.get("[data-split-view-detail]").should("exist");
        cy.get("[data-split-view-divider]").should("exist");
      });

    cy.window().then((win) =>
      win.cur_list.filter_area.add([
        ["ToDo", "description", "like", `%${marker}%`],
      ]),
    );
    cy.get(`[data-split-view-list] a[data-name="${first}"]`).first().click();
    cy.get("[data-split-form-host='true']").should("be.visible");
    cy.get("[data-split-form-host] [data-split-document-title]")
      .should("have.length", 1)
      .and("have.text", `${marker}-one`);
    cy.get("[data-split-form-host] .navbar-breadcrumbs > li").should(
      "have.length",
      1,
    );
    cy.get("[data-split-form-host] .navbar-breadcrumbs a").should("not.exist");
    cy.window().then((win) => {
      const root = win.document.querySelector("[data-frappe-split-view]");
      const owner = win.frappe_split_view.debug.owner;
      expect(owner.frm).to.be.instanceOf(win.frappe.ui.form.Form);
      expect(owner.frm.docname).to.eq(first);
      expect(win.frappe.container.page).to.eq(win.cur_list.parent);
      expect(win.frappe.ui.pages[win.frappe.get_route_str()]).to.eq(
        win.cur_list.page,
      );
      expect(root.dataset.selectedName).to.eq(first);
      win.__splitFormIdentity = owner.frm;
    });

    cy.window().then((win) => win.cur_list.activateRecord(second));
    cy.get("[data-split-form-host] [data-split-document-title]")
      .should("have.length", 1)
      .and("have.text", `${marker}-two`);
    cy.window().then((win) => {
      expect(win.frappe_split_view.debug.owner.frm).to.eq(
        win.__splitFormIdentity,
      );
      expect(win.__splitFormIdentity.docname).to.eq(second);
    });

    cy.intercept("POST", "/api/method/frappe.desk.form.save.savedocs").as(
      "saveTodo",
    );
    cy.window().then((win) => {
      savedPriority =
        win.__splitFormIdentity.doc.priority === "High" ? "Low" : "High";
      return win.__splitFormIdentity.set_value("priority", savedPriority);
    });
    cy.get("[data-split-form-host] .primary-action[data-label='Save']")
      .should("be.visible")
      .click();
    cy.wait("@saveTodo");
    cy.window().should((win) =>
      expect(win.__splitFormIdentity.is_dirty()).to.eq(false),
    );
    cy.request("GET", `/api/resource/ToDo/${encodeURIComponent(second)}`).then(
      ({ body }) => {
        expect(body.data.priority).to.eq(savedPriority);
      },
    );

    cy.window().then(async (win) => {
      await win.__splitFormIdentity.set_value(
        "priority",
        savedPriority === "High" ? "Low" : "High",
      );
    });
    cy.window().then((win) => win.cur_list.activateRecord(first));
    cy.window().then((win) => {
      expect(win.__splitFormIdentity.docname).to.eq(second);
      expect(win.__splitFormIdentity.is_dirty()).to.eq(true);
    });
    cy.window().then((win) => expect(win.cur_list.closeDetail()).to.eq(false));
    cy.window().then((win) =>
      expect(win.cur_frm).to.eq(win.__splitFormIdentity),
    );

    cy.window().then(async (win) => {
      await win.__splitFormIdentity.set_value("priority", savedPriority);
      expect(await win.cur_list.splitFormAdapter.save()).to.eq(true);
      expect(win.cur_list.closeDetail()).to.eq(true);
      win.cur_list.page.wrapper.trigger("hide");
      expect(win.cur_frm).to.eq(null);
      win.cur_list.page.wrapper.trigger("show");
      expect(win.cur_frm).to.eq(null);
      expect(win.cur_list.splitFormAdapter.detailOpen).to.eq(false);
    });
  });

  it("guards dirty set_route calls, then hard-navigates the clean boundary", () => {
    cy.visit("/desk/todo/view/split");
    cy.get("[data-frappe-split-view][data-doctype='ToDo']").should(
      "be.visible",
    );
    cy.window().its("cur_list").should("not.be.null");
    cy.window().then((win) => win.cur_list.activateRecord(first));
    cy.get("[data-split-form-host='true']").should("exist");
    cy.window().then(async (win) => {
      await win.frappe_split_view.debug.owner.frm.set_value(
        "description",
        `${marker}-dirty-route`,
      );
      expect(await win.frappe.set_route("Form", "ToDo", second)).to.eq(false);
      expect(win.location.pathname).to.eq("/desk/todo/view/split");
      expect(win.frappe_split_view.debug.owner.frm.docname).to.eq(first);
      expect(await win.cur_list.splitFormAdapter.save()).to.eq(true);
      return win.frappe.set_route("Form", "ToDo", second);
    });
    cy.location("pathname").should("include", second);
    cy.window().should((win) => {
      expect(win.frappe.get_route()?.[0]).to.eq("Form");
      expect(
        win.document.querySelectorAll("[data-frappe-split-view]"),
      ).to.have.length(0);
    });
  });

  it("preserves modified and custom list links", () => {
    let activations = 0;
    cy.visit("/desk/todo/view/split");
    cy.get("[data-frappe-split-view][data-doctype='ToDo']").should(
      "be.visible",
    );
    cy.window().its("cur_list").should("not.be.null");
    cy.window().then((win) => {
      win.cur_list.activateRecord = () => {
        activations += 1;
      };
      const currentTarget = win.document.createElement("div");
      const custom = win.document.createElement("a");
      custom.dataset.name = first;
      custom.href = `/desk/custom-route/${encodeURIComponent(first)}`;
      currentTarget.append(custom);
      let prevented = false;
      win.cur_list.splitListAdapter.handleActivation({
        button: 0,
        target: custom,
        currentTarget,
        preventDefault: () => {
          prevented = true;
        },
        stopImmediatePropagation: () => {},
      });
      expect(prevented).to.eq(false);
      expect(activations).to.eq(0);
      const canonical = win.document.createElement("a");
      canonical.dataset.name = first;
      canonical.href = win.frappe.utils.get_form_link("ToDo", first);
      currentTarget.replaceChildren(canonical);
      win.cur_list.splitListAdapter.handleActivation({
        button: 0,
        ctrlKey: true,
        target: canonical,
        currentTarget,
        preventDefault: () => {
          prevented = true;
        },
        stopImmediatePropagation: () => {},
      });
      expect(prevented).to.eq(false);
      expect(activations).to.eq(0);
    });
    cy.get("[data-split-view-list] a[data-name]")
      .first()
      .then(($anchor) => {
        const win = $anchor[0].ownerDocument.defaultView;
        const event = new win.MouseEvent("click", {
          bubbles: true,
          button: 0,
          cancelable: true,
          ctrlKey: true,
        });
        expect($anchor[0].dispatchEvent(event)).to.eq(true);
        expect(event.defaultPrevented).to.eq(false);
        expect(activations).to.eq(0);
      });
  });

  it("offers Split as a DocType default view", () => {
    cy.visit("/desk/customize-form");
    cy.window().should((win) => {
      expect(win.cur_frm?.doctype).to.eq("Customize Form");
    });
    cy.fill_field("doc_type", "ToDo", "Link");
    cy.get("[data-fieldname='default_view'] select")
      .should("be.visible")
      .find("option[value='Split']")
      .should("have.length", 1);
  });

  it("uses a hard navigation boundary for full-page open", () => {
    cy.visit("/desk/todo/view/split");
    cy.get("[data-frappe-split-view][data-doctype='ToDo']").should(
      "be.visible",
    );
    cy.window().its("cur_list").should("not.be.null");
    cy.window().then((win) => {
      win.__splitDocumentSentinel = "must-disappear";
      return win.cur_list.activateRecord(first);
    });
    cy.get("[data-split-form-host='true']").should("exist");
    cy.get("[data-split-open-full]")
      .should("have.attr", "type", "button")
      .click();
    cy.location("pathname").should("include", first);
    cy.window().should((win) => {
      expect(win.__splitDocumentSentinel).to.eq(undefined);
      expect(win.frappe.get_route()?.[0]).to.eq("Form");
      expect(
        win.document.querySelectorAll("[data-frappe-split-view]"),
      ).to.have.length(0);
    });
  });
});
