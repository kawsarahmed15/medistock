import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  BUSINESS_CAPABILITIES,
  ROLE_PERMISSIONS,
  getEffectivePermissions,
  hasPermission,
} from "../src/permissions.js";

test("Permission Registry sanity", () => {
  assert.ok(ALL_PERMISSIONS.length > 20, "Should have comprehensive permission list");
  assert.ok(ALL_PERMISSIONS.includes("inventory.view"));
  assert.ok(ALL_PERMISSIONS.includes("products.create"));
  assert.ok(ALL_PERMISSIONS.includes("sale.retail"));
  assert.ok(ALL_PERMISSIONS.includes("sale.wholesale"));
});

test("Business Capabilities: Retailer vs Wholesaler vs Enterprise", () => {
  // Retailer allows retail, forbids wholesale & branch
  assert.equal(BUSINESS_CAPABILITIES.retailer.has("sale.retail"), true);
  assert.equal(BUSINESS_CAPABILITIES.retailer.has("sale.wholesale"), false);
  assert.equal(BUSINESS_CAPABILITIES.retailer.has("branch.manage"), false);

  // Wholesaler allows wholesale & retail, forbids branch
  assert.equal(BUSINESS_CAPABILITIES.wholesaler.has("sale.wholesale"), true);
  assert.equal(BUSINESS_CAPABILITIES.wholesaler.has("sale.retail"), true);
  assert.equal(BUSINESS_CAPABILITIES.wholesaler.has("branch.manage"), false);

  // Enterprise allows all
  assert.equal(BUSINESS_CAPABILITIES.enterprise.has("branch.manage"), true);
  assert.equal(BUSINESS_CAPABILITIES.enterprise.has("warehouse.manage"), true);
  assert.equal(BUSINESS_CAPABILITIES.enterprise.has("sale.wholesale"), true);
});

test("Role Permissions: Owner retains all permissions", () => {
  assert.equal(ROLE_PERMISSIONS.owner.size, ALL_PERMISSIONS.length);
});

test("Role Permissions: Staff & Cashier vs Manager", () => {
  // Staff can create sale and view inventory, but cannot delete products or view revenue
  assert.equal(ROLE_PERMISSIONS.staff.has("sale.create"), true);
  assert.equal(ROLE_PERMISSIONS.staff.has("products.view"), true);
  assert.equal(ROLE_PERMISSIONS.staff.has("products.delete"), false);
  assert.equal(ROLE_PERMISSIONS.staff.has("reports.view"), false);

  // Cashier has credit capability
  assert.equal(ROLE_PERMISSIONS.cashier.has("customer.credit"), true);
  assert.equal(ROLE_PERMISSIONS.cashier.has("products.create"), false);

  // Manager has broad operations
  assert.equal(ROLE_PERMISSIONS.manager.has("products.create"), true);
  assert.equal(ROLE_PERMISSIONS.manager.has("reports.view"), true);
  assert.equal(ROLE_PERMISSIONS.manager.has("sale.approve"), true);
});

test("Effective Permissions: Retailer + Owner", () => {
  const effective = getEffectivePermissions("retailer", "owner");
  assert.equal(effective.has("sale.retail"), true);
  assert.equal(effective.has("products.create"), true);
  // Retailer capability does not have wholesale or branch, so effective does not include them even for owner
  assert.equal(effective.has("sale.wholesale"), false);
  assert.equal(effective.has("branch.manage"), false);
});

test("Effective Permissions: Wholesaler + Sales Manager", () => {
  const effective = getEffectivePermissions("wholesaler", "sales_manager");
  assert.equal(effective.has("sale.wholesale"), true);
  assert.equal(effective.has("sale.retail"), true);
  assert.equal(effective.has("customer.view"), true);
  assert.equal(effective.has("purchase.create"), false);
});

test("Effective Permissions: Enterprise + Warehouse Manager", () => {
  const effective = getEffectivePermissions("enterprise", "warehouse_manager");
  assert.equal(effective.has("inventory.adjust"), true);
  assert.equal(effective.has("batch.delete"), true);
  assert.equal(effective.has("warehouse.manage"), true);
  assert.equal(effective.has("customer.credit"), false);
});

test("hasPermission Evaluator: Legacy accounts and superadmin", () => {
  // Superadmin bypass
  assert.equal(hasPermission({ role: "superadmin" }, "branch.manage"), true);

  // Legacy retailer owner without decoupled userRole
  assert.equal(hasPermission({ role: "retailer", isEmployee: false }, "products.create"), true);
  assert.equal(hasPermission({ role: "retailer", isEmployee: false }, "sale.wholesale"), false);

  // Legacy employee without specified sub-role defaults to staff
  assert.equal(hasPermission({ role: "employee", isEmployee: true }, "sale.create"), true);
  assert.equal(hasPermission({ role: "employee", isEmployee: true }, "products.delete"), false);

  // Array of permissions (at least one match)
  assert.equal(
    hasPermission({ role: "retailer", userRole: "staff", isEmployee: true }, ["products.delete", "sale.create"]),
    true
  );
  assert.equal(
    hasPermission({ role: "retailer", userRole: "staff", isEmployee: true }, ["products.delete", "employees.delete"]),
    false
  );
});
