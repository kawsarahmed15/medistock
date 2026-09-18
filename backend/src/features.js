/**
 * Centralized Feature Flags & Business Capabilities Engine for Medistock Backend
 */

import { buildApiError } from "./utils.js";
import { hasPermission } from "./permissions.js";

/**
 * Feature Definition Registry
 */
export const FEATURE_REGISTRY = {
  // INVENTORY
  "inventory.batch": {
    key: "inventory.batch",
    name: "Batch Tracking",
    description: "Batch-level inventory tracking and batch selection during sales",
    category: "inventory",
  },
  "inventory.expiry": {
    key: "inventory.expiry",
    name: "Expiry Alerts",
    description: "Near-expiry alerts, warnings, and filtering across medicine batches",
    category: "inventory",
  },
  "inventory.unit_conversion": {
    key: "inventory.unit_conversion",
    name: "Unit Conversion",
    description: "Multi-tier packaging conversions (Box, Strip, Tablet)",
    category: "inventory",
  },
  "inventory.adjustments": {
    key: "inventory.adjustments",
    name: "Stock Adjustments",
    description: "Manual stock inward/outward adjustments and correction audits",
    category: "inventory",
  },

  // SALES & BILLING
  "sales.retail": {
    key: "sales.retail",
    name: "Retail POS Billing",
    description: "Fast counter sales, barcode scanning, walk-in patient invoicing",
    category: "sales",
  },
  "sales.wholesale": {
    key: "sales.wholesale",
    name: "Wholesale & B2B Billing",
    description: "Bulk distribution invoicing with GSTIN, Drug License & HSN summaries",
    category: "sales",
  },
  "sales.credit": {
    key: "sales.credit",
    name: "Customer Credit & Udhar",
    description: "Credit sale generation, advance deposits, and partial payments",
    category: "sales",
  },
  "sales.customer_pricing": {
    key: "sales.customer_pricing",
    name: "Customer-Specific Pricing",
    description: "Special discounted rates and pricing tiers per buyer/distributor",
    category: "sales",
  },
  "sales.drafts": {
    key: "sales.drafts",
    name: "Draft Bills",
    description: "Auto-save uncompleted bills as drafts to prevent data loss on refresh/logout",
    category: "sales",
  },

  // PURCHASES
  "purchase.basic": {
    key: "purchase.basic",
    name: "Basic Purchase Inward",
    description: "Record supplier invoices and stock inward entries",
    category: "purchase",
  },
  "purchase.purchase_order": {
    key: "purchase.purchase_order",
    name: "Purchase Order Management",
    description: "Structured purchase orders, invoice references, and purchase returns",
    category: "purchase",
  },

  // CUSTOMERS & SUPPLIERS
  "customer.ledger": {
    key: "customer.ledger",
    name: "Customer Ledger / Khata",
    description: "Detailed customer transaction history, statements, and balance calculations",
    category: "customer",
  },
  "customer.credit_limit": {
    key: "customer.credit_limit",
    name: "Credit Limit Enforcement",
    description: "Set maximum credit caps and restrict credit billing when exceeded",
    category: "customer",
  },
  "supplier.ledger": {
    key: "supplier.ledger",
    name: "Supplier History & Ledger",
    description: "Track supplier purchases, invoices, and payment histories",
    category: "supplier",
  },

  // WAREHOUSE
  "warehouse.management": {
    key: "warehouse.management",
    name: "Warehouse Storage Management",
    description: "Racks, bins, and designated storage location management",
    category: "warehouse",
  },
  "warehouse.multiple": {
    key: "warehouse.multiple",
    name: "Multi-Warehouse Support",
    description: "Manage multiple godowns/warehouses and inter-warehouse stock transfers",
    category: "warehouse",
  },

  // BRANCH
  "branch.management": {
    key: "branch.management",
    name: "Branch Configuration",
    description: "Store outlet profile, operating hours, and localized identifiers",
    category: "branch",
  },
  "branch.multiple": {
    key: "branch.multiple",
    name: "Multi-Branch Network",
    description: "Multi-store chain operations, inter-branch transfers, and central view",
    category: "branch",
  },

  // REPORTS & ANALYTICS
  "reports.basic": {
    key: "reports.basic",
    name: "Basic Sales Reports",
    description: "Daily revenue, sales summaries, and draft/pending bill metrics",
    category: "reports",
  },
  "reports.advanced": {
    key: "reports.advanced",
    name: "Advanced Financial Analytics",
    description: "Profit margins, tax breakdown, product velocity, and revenue forecasting",
    category: "reports",
  },

  // ENTERPRISE
  "enterprise.api_access": {
    key: "enterprise.api_access",
    name: "External API Integrations",
    description: "REST API keys and external ERP/accounting data synchronization",
    category: "enterprise",
  },
  "enterprise.audit_logs": {
    key: "enterprise.audit_logs",
    name: "Full Audit Logs",
    description: "Detailed immutable log of all inventory, billing, and system operations",
    category: "enterprise",
  },
  "enterprise.custom_roles": {
    key: "enterprise.custom_roles",
    name: "Custom Role Definitions",
    description: "Create and assign custom fine-grained permission templates",
    category: "enterprise",
  },
};

export const ALL_FEATURE_KEYS = Object.keys(FEATURE_REGISTRY);

/**
 * Default Business Type Capabilities
 */
export const DEFAULT_BUSINESS_FEATURES = {
  retailer: {
    "inventory.batch": true,
    "inventory.expiry": true,
    "inventory.unit_conversion": true,
    "inventory.adjustments": true,
    "sales.retail": true,
    "sales.wholesale": false,
    "sales.credit": true,
    "sales.customer_pricing": false,
    "sales.drafts": true,
    "purchase.basic": true,
    "purchase.purchase_order": true,
    "customer.ledger": true,
    "customer.credit_limit": false,
    "supplier.ledger": true,
    "warehouse.management": false,
    "warehouse.multiple": false,
    "branch.management": false,
    "branch.multiple": false,
    "reports.basic": true,
    "reports.advanced": false,
    "enterprise.api_access": false,
    "enterprise.audit_logs": false,
    "enterprise.custom_roles": false,
  },

  wholesaler: {
    "inventory.batch": true,
    "inventory.expiry": true,
    "inventory.unit_conversion": true,
    "inventory.adjustments": true,
    "sales.retail": true,
    "sales.wholesale": true,
    "sales.credit": true,
    "sales.customer_pricing": true,
    "sales.drafts": true,
    "purchase.basic": true,
    "purchase.purchase_order": true,
    "customer.ledger": true,
    "customer.credit_limit": true,
    "supplier.ledger": true,
    "warehouse.management": true,
    "warehouse.multiple": false,
    "branch.management": false,
    "branch.multiple": false,
    "reports.basic": true,
    "reports.advanced": true,
    "enterprise.api_access": false,
    "enterprise.audit_logs": true,
    "enterprise.custom_roles": false,
  },

  enterprise: {
    "inventory.batch": true,
    "inventory.expiry": true,
    "inventory.unit_conversion": true,
    "inventory.adjustments": true,
    "sales.retail": true,
    "sales.wholesale": true,
    "sales.credit": true,
    "sales.customer_pricing": true,
    "sales.drafts": true,
    "purchase.basic": true,
    "purchase.purchase_order": true,
    "customer.ledger": true,
    "customer.credit_limit": true,
    "supplier.ledger": true,
    "warehouse.management": true,
    "warehouse.multiple": true,
    "branch.management": true,
    "branch.multiple": true,
    "reports.basic": true,
    "reports.advanced": true,
    "enterprise.api_access": true,
    "enterprise.audit_logs": true,
    "enterprise.custom_roles": true,
  },
};

/**
 * Calculates Effective Feature Set
 * Defaults for businessType merged with business_settings.features overrides
 */
export function getEffectiveFeatures(businessType = "retailer", businessSettings = null) {
  const normType = String(businessType || "retailer").toLowerCase().trim();
  const defaults = DEFAULT_BUSINESS_FEATURES[normType] || DEFAULT_BUSINESS_FEATURES.retailer;

  let overrides = {};
  if (businessSettings) {
    let parsed = businessSettings;
    if (typeof businessSettings === "string") {
      try {
        parsed = JSON.parse(businessSettings);
      } catch {
        parsed = {};
      }
    }
    if (parsed && typeof parsed === "object" && parsed.features && typeof parsed.features === "object") {
      overrides = parsed.features;
    }
  }

  const effective = { ...defaults };
  for (const [key, val] of Object.entries(overrides)) {
    if (typeof val === "boolean") {
      effective[key] = val;
    }
  }

  return effective;
}

/**
 * Evaluates whether a feature is enabled for a given actor/tenant context
 */
export function isFeatureEnabled(actorContext, featureKey) {
  if (!actorContext) return false;

  const rawRole = String(actorContext.role || "").toLowerCase().trim();
  if (rawRole === "superadmin") {
    return true;
  }

  const businessType = actorContext.businessType ||
    (["wholesaler", "enterprise", "retailer"].includes(rawRole) ? rawRole : "retailer");
  const businessSettings = actorContext.businessSettings || null;

  const effective = getEffectiveFeatures(businessType, businessSettings);

  if (Array.isArray(featureKey)) {
    return featureKey.some((k) => Boolean(effective[k]));
  }

  return Boolean(effective[featureKey]);
}

/**
 * Express Middleware: Requires specific feature flag(s) to be enabled
 */
export function requireFeature(featureKey) {
  return (req, res, next) => {
    if (!req.auth) {
      return next(buildApiError(401, "Unauthorized"));
    }

    const enabled = isFeatureEnabled(req.auth, featureKey);
    if (!enabled) {
      const featName = Array.isArray(featureKey) ? featureKey.join(" or ") : featureKey;
      return next(buildApiError(403, `Feature disabled for this business: ${featName}`));
    }
    next();
  };
}

/**
 * Combined Express Middleware: Requires Feature to be enabled AND User to have RBAC Permission
 */
export function requireFeatureAndPermission(featureKey, permissionKey) {
  return (req, res, next) => {
    if (!req.auth) {
      return next(buildApiError(401, "Unauthorized"));
    }

    const featEnabled = isFeatureEnabled(req.auth, featureKey);
    if (!featEnabled) {
      const featName = Array.isArray(featureKey) ? featureKey.join(" or ") : featureKey;
      return next(buildApiError(403, `Feature disabled for this business: ${featName}`));
    }

    const permGranted = hasPermission(req.auth, permissionKey);
    if (!permGranted) {
      const permName = Array.isArray(permissionKey) ? permissionKey.join(" or ") : permissionKey;
      return next(buildApiError(403, `Permission denied: ${permName} required`));
    }

    next();
  };
}
