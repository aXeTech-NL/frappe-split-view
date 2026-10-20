Cypress.Commands.add("login", (email = "Administrator", password) => {
  password =
    password ||
    Cypress.env("adminPassword") ||
    Cypress.config("adminPassword") ||
    "admin";
  return cy.request({
    url: "/api/method/login",
    method: "POST",
    body: { usr: email, pwd: password },
  });
});

Cypress.Commands.add("insert_doc", (doctype, args) => {
  return cy
    .window()
    .its("frappe.csrf_token")
    .then((csrfToken) =>
      cy.request({
        method: "POST",
        url: `/api/resource/${doctype}`,
        body: { doctype, ...args },
        headers: { "X-Frappe-CSRF-Token": csrfToken },
      }),
    )
    .then((response) => {
      expect(response.status).to.eq(200);
      return response.body.data;
    });
});

Cypress.Commands.add("assert_split_view_selector", (view = "Split") => {
  cy.window().should((win) => {
    const list = win.cur_list;
    expect(list?.views_list, "initialized view selector").to.exist;
    expect(list.view_name).to.eq(view);
    expect(list.views_list.current_view).to.eq(view);
    const selector = list.views_list;
    if (selector.$trigger) {
      expect(selector.$trigger.find(".custom-btn-group-label").text()).to.eq(
        win.__(`${view} View`),
      );
      const options = selector.get_view_options();
      const active = options.filter((item) => item.selected);
      expect(active, "one active view in the nested menu").to.have.length(1);
      expect(active[0].label).to.eq(win.__(`${view} View`));
      expect(options.filter((item) => item.label === win.__("Split View"))).to.have.length(1);
      return;
    }
    const menu = list.views_menu;
    const caption = menu
      .closest(".custom-btn-group")
      .find(".custom-btn-group-label");
    expect(caption.text()).to.eq(win.__(`${view} View`));
    expect(
      menu.find(`[data-view='${view}']`),
      "active view is not duplicated",
    ).to.have.length(0);
    const alternative = view === "Split" ? "List" : "Split";
    const entry = menu.find(`[data-view='${alternative}']`);
    expect(entry, "alternative view appears once").to.have.length(1);
    expect(entry.text().trim()).to.eq(win.__(`${alternative} View`));
  });
});

Cypress.Commands.add("assert_split_path", (path) => {
  cy.window().should((win) => {
    const router = win.frappe.router;
    const shell = router.current_shell;
    const scoped = shell && router.shell_slug
      ? path.replace("/desk/", `/desk/${router.shell_slug(shell)}/`)
      : path;
    expect(win.location.pathname).to.be.oneOf([path, scoped]);
  });
});

Cypress.Commands.add("select_split_view", (view) => {
  cy.window().should((win) => {
    expect(win.cur_list?.views_list, "view selector is ready").to.exist;
  }).then((win) => {
    const selector = win.cur_list.views_list;
    if (selector.$trigger) {
      cy.wrap(selector.$trigger).click();
      cy.contains(".es-menu__label:visible", win.__(`${view} View`)).click();
      // The new List row opens a submenu instead of navigating immediately.
      if (view === "List") {
        cy.contains(".es-menu__label:visible", win.__("Default Layout")).click();
      }
    } else {
      const menu = win.cur_list.views_menu;
      cy.wrap(menu.closest(".custom-btn-group"))
        .find("[data-toggle='dropdown']").click();
      cy.wrap(menu).find(`[data-view='${view}']`).should("be.visible").click();
    }
  });
});

Cypress.Commands.add("assert_split_header_layout", () => {
  // Close restores row focus, which can scroll Desk beneath its fixed header.
  // Measure the unscrolled layout without changing either list scroll offset.
  cy.window().then((win) => {
    for (
      let parent = win.cur_list.splitRoot.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      parent.scrollTop = 0;
    }
  });
  cy.window().should((win) => {
    const list = win.cur_list;
    const root = list.splitRoot;
    const bounds = root.getBoundingClientRect();
    for (const [label, node] of [
      ["list toolbar", list.page.page_head.get(0)],
      ["list filters", list.page.page_form.get(0)],
    ]) {
      expect(root.contains(node), `${label} outside the split grid`).to.eq(
        false,
      );
      expect(Cypress.$(node), label).to.be.visible;
      const rect = node.getBoundingClientRect();
      expect(rect.left, `${label} spans left pane`).to.be.at.most(
        bounds.left + 2,
      );
      expect(rect.right, `${label} spans right pane`).to.be.at.least(
        bounds.right - 2,
      );
      expect(rect.bottom, `${label} above both panes`).to.be.at.most(
        bounds.top + 2,
      );
    }
    const listPane = root.querySelector("[data-split-view-list]");
    expect(listPane.contains(list.$frappe_list.get(0))).to.eq(true);
    if (list.splitFormAdapter.detailOpen) {
      expect(
        list.detailPane.contains(win.cur_frm.page.page_head.get(0)),
        "document toolbar stays in the right pane",
      ).to.eq(true);
    }
  });
  cy.assert_split_view_selector();
});
