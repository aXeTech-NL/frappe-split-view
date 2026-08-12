Cypress.Commands.add(
  "login",
  (email = "Administrator", password = Cypress.env("adminPassword")) => {
    return cy.request({
      url: "/api/method/login",
      method: "POST",
      body: { usr: email, pwd: password },
    });
  },
);

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
