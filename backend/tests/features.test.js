import test from "node:test";
import assert from "node:assert/strict";
import {
  FEATURE_REGISTRY,
  DEFAULT_BUSINESS_FEATURES,
  getEffectiveFeatures,
  isFeatureEnabled,
} from "../src/features.js";
import { hasPermission } from "../src/permissions.js";

test("Feature Registry completeness", () => {
  assert.ok(Object.keys(FEATURE_REGISTRY).length >= 15, "Registry should contain all core feature definitions");
  assert.ok(FEATURE_REGISTRY["sales.retail"]);
  assert.ok(FEATURE_REGISTRY["sales.wholesale"]);
  assert.ok(FEATURE_REGISTRY["warehouse.management"]);
  assert.ok(FEATURE_REGISTRY["branch.multiple"]);
  assert.ok(FEATURE_REGISTRY["customer.credit_limit"]);
});

test("1. Retailer default capabilities", () => {
  const retailerFeatures = getEffectiveFeatures("retailer");
  assert.equal(retailerFeatures["sales.retail"], true);
  assert.equal(retailerFeatures["inventory.batch"], true);
  assert.equal(retailerFeatures["inventory.expiry"], true);
  assert.equal(retailerFeatures["customer.ledger"], true);

  // Excluded from standard retailer defaults
  assert.equal(retailerFeatures["sales.wholesale"], false);
  assert.equal(retailerFeatures["warehouse.management"], false);
  assert.equal(retailerFeatures["branch.multiple"], false);
  assert.equal(retailerFeatures["reports.advanced"], false);
});

test("2. Wholesaler default capabilities", () => {
  const wholesalerFeatures = getEffectiveFeatures("wholesaler");
  assert.equal(wholesalerFeatures["sales.wholesale"], true);
  assert.equal(wholesalerFeatures["sales.retail"], true);
  assert.equal(wholesalerFeatures["sales.customer_pricing"], true);
  assert.equal(wholesalerFeatures["customer.credit_limit"], true);
  assert.equal(wholesalerFeatures["warehouse.management"], true);
  assert.equal(wholesalerFeatures["reports.advanced"], true);

  // Excluded from standard wholesaler defaults
  assert.equal(wholesalerFeatures["branch.multiple"], false);
  assert.equal(wholesalerFeatures["enterprise.api_access"], false);
});

test("3. Enterprise default capabilities", () => {
  const enterpriseFeatures = getEffectiveFeatures("enterprise");
  assert.equal(enterpriseFeatures["sales.wholesale"], true);
  assert.equal(enterpriseFeatures["sales.retail"], true);
  assert.equal(enterpriseFeatures["warehouse.multiple"], true);
  assert.equal(enterpriseFeatures["branch.multiple"], true);
  assert.equal(enterpriseFeatures["enterprise.api_access"], true);
  assert.equal(enterpriseFeatures["enterprise.audit_logs"], true);
});

test("4. Feature override behavior via businessSettings", () => {
  // A retailer with an explicit feature override enabling wholesale and credit limit
  const settingsWithOverrides = {
    features: {
      "sales.wholesale": true,
      "customer.credit_limit": true,
      "inventory.expiry": false, // disabled explicitly
    },
  };

  const effective = getEffectiveFeatures("retailer", settingsWithOverrides);
  assert.equal(effective["sales.wholesale"], true, "Should enable overridden feature");
  assert.equal(effective["customer.credit_limit"], true, "Should enable overridden feature");
  assert.equal(effective["inventory.expiry"], false, "Should respect explicit false override");
  assert.equal(effective["sales.retail"], true, "Should retain unchanged default features");
});

test("5. Missing configuration fallback", () => {
  // Null, empty, or corrupted business settings must fall back cleanly without throws
  const effectiveNull = getEffectiveFeatures("retailer", null);
  const effectiveEmpty = getEffectiveFeatures("wholesaler", {});
  const effectiveInvalidJson = getEffectiveFeatures("enterprise", "invalid-json-string");

  assert.equal(effectiveNull["sales.retail"], true);
  assert.equal(effectiveEmpty["sales.wholesale"], true);
  assert.equal(effectiveInvalidJson["branch.multiple"], true);
});

test("6. Feature enabled + permission granted", () => {
  // Wholesaler Owner attempting wholesale sale
  const actor = {
    businessType: "wholesaler",
    userRole: "owner",
    isEmployee: false,
    role: "wholesaler",
  };

  const featureEnabled = isFeatureEnabled(actor, "sales.wholesale");
  const permissionGranted = hasPermission(actor, "sale.wholesale");

  assert.equal(featureEnabled, true);
  assert.equal(permissionGranted, true);
  assert.equal(featureEnabled && permissionGranted, true, "Access should be granted");
});

test("7. Feature enabled + permission denied", () => {
  // Wholesaler Staff (POS staff without sale.wholesale permission)
  const actor = {
    businessType: "wholesaler",
    userRole: "staff",
    isEmployee: true,
    role: "employee",
  };

  const featureEnabled = isFeatureEnabled(actor, "sales.wholesale");
  const permissionGranted = hasPermission(actor, "sale.wholesale");

  assert.equal(featureEnabled, true, "Business has wholesale feature enabled");
  assert.equal(permissionGranted, false, "Staff user does not have sale.wholesale permission");
  assert.equal(featureEnabled && permissionGranted, false, "Effective access should be blocked");
});

test("8. Feature disabled + permission granted", () => {
  // Retailer Owner (has all owner permissions, but retailer business type does not have wholesale feature)
  const actor = {
    businessType: "retailer",
    userRole: "owner",
    isEmployee: false,
    role: "retailer",
  };

  const featureEnabled = isFeatureEnabled(actor, "sales.wholesale");
  assert.equal(featureEnabled, false, "Retailer business has wholesale disabled by default");
  assert.equal(featureEnabled && hasPermission(actor, "sale.wholesale"), false, "Effective access should be blocked");
});

test("9. Legacy account behavior", () => {
  // Legacy account with only role: 'wholesaler' and no businessSettings
  const legacyWholesaler = { role: "wholesaler" };
  assert.equal(isFeatureEnabled(legacyWholesaler, "sales.wholesale"), true);
  assert.equal(isFeatureEnabled(legacyWholesaler, "branch.multiple"), false);

  // Legacy account with role: 'retailer'
  const legacyRetailer = { role: "retailer" };
  assert.equal(isFeatureEnabled(legacyRetailer, "sales.retail"), true);
  assert.equal(isFeatureEnabled(legacyRetailer, "sales.wholesale"), false);
});

test("10. Combinations matrix verification", () => {
  // Retailer + Owner
  assert.equal(isFeatureEnabled({ businessType: "retailer", userRole: "owner" }, "sales.retail"), true);
  assert.equal(isFeatureEnabled({ businessType: "retailer", userRole: "owner" }, "warehouse.multiple"), false);

  // Retailer + Staff
  assert.equal(isFeatureEnabled({ businessType: "retailer", userRole: "staff", isEmployee: true }, "sales.retail"), true);
  assert.equal(isFeatureEnabled({ businessType: "retailer", userRole: "staff", isEmployee: true }, "sales.wholesale"), false);

  // Wholesaler + Sales Manager
  assert.equal(isFeatureEnabled({ businessType: "wholesaler", userRole: "sales_manager", isEmployee: true }, "sales.customer_pricing"), true);

  // Wholesaler + Warehouse Manager
  assert.equal(isFeatureEnabled({ businessType: "wholesaler", userRole: "warehouse_manager", isEmployee: true }, "warehouse.management"), true);

  // Enterprise + Owner
  assert.equal(isFeatureEnabled({ businessType: "enterprise", userRole: "owner" }, "enterprise.api_access"), true);

  // Enterprise + Warehouse Manager
  assert.equal(isFeatureEnabled({ businessType: "enterprise", userRole: "warehouse_manager", isEmployee: true }, "warehouse.multiple"), true);
});
