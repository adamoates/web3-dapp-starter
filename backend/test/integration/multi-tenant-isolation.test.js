const request = require("supertest");
const createApp = require("../../src/app");

describe("Multi-Tenant Data Isolation Integration Test", () => {
  let app;
  let tenantA, tenantB, userA, userB, tokenA, tokenB;

  beforeAll(async () => {
    app = createApp();
    // Create tenants
    const resTenantA = await request(app)
      .post("/api/tenants")
      .send({ name: "TenantA" });
    tenantA = resTenantA.body.tenant;
    const resTenantB = await request(app)
      .post("/api/tenants")
      .send({ name: "TenantB" });
    tenantB = resTenantB.body.tenant;
    // Create users
    const resUserA = await request(app).post("/api/auth/register").send({
      email: "a@a.com",
      password: "passA",
      name: "UserA",
      tenantId: tenantA.id
    });
    userA = resUserA.body.user;
    const resUserB = await request(app).post("/api/auth/register").send({
      email: "b@b.com",
      password: "passB",
      name: "UserB",
      tenantId: tenantB.id
    });
    userB = resUserB.body.user;
    // Login
    const resLoginA = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@a.com", password: "passA" });
    tokenA = resLoginA.body.token;
    const resLoginB = await request(app)
      .post("/api/auth/login")
      .send({ email: "b@b.com", password: "passB" });
    tokenB = resLoginB.body.token;
  });

  it("should prevent Tenant A user from accessing Tenant B's data", async () => {
    const res = await request(app)
      .get(`/api/users/${userB.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .set("X-Tenant-ID", tenantA.id);
    expect([403, 404]).toContain(res.status);
  });

  it("should allow Tenant B user to access their own data", async () => {
    const res = await request(app)
      .get(`/api/users/${userB.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .set("X-Tenant-ID", tenantB.id);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(userB.id);
  });
});
