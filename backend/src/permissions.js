/**
 * Centralized RBAC & Permission Registry for Medistock Pharmacy ERP
 */

export const ALL_PERMISSIONS = [
  // INVENTORY
  "inventory.view",
  "inventory.create",
  "inventory.edit",
  "inventory.delete",
  "inventory.adjust",
  "inventory.export",

  // PRODUCTS
  "products.view",
  "products.create",
  "products.edit",
  "products.delete",

  // BATCH
  "batch.view",
  "batch.create",
  "batch.edit",
  "batch.delete",

  // PURCHASE
  "purchase.view",
  "purchase.create",
  "purchase.edit",
  "purchase.delete",
  "purchase.return",

  // SALES
  "sale.view",
  "sale.create",
  "sale.edit",
  "sale.delete",
  "sale.return",
  "sale.approve",
  "sale.reject",
  "sale.retail",
  "sale.wholesale",

  // CUSTOMERS
  "customer.view",
  "customer.create",
  "customer.edit",
  "customer.delete",
  "customer.credit",
  "customer.ledger",

  // SUPPLIERS
  "supplier.view",
  "supplier.create",
  "supplier.edit",
  "supplier.delete",

  // EMPLOYEES
  "employees.view",
  "employees.create",
  "employees.edit",
  "employees.delete",

  // REPORTS
  "reports.view",
  "reports.export",

  // SETTINGS
  "settings.view",
  "settings.manage",

  // WAREHOUSE
  "warehouse.view",
  "warehouse.manage",

  // BRANCH
  "branch.view",
  "branch.manage",

  // AUDIT
  "audit.view",
];

/**
 * Business Type Capability Sets
 * Defines which permissions are available within each business model.
 */
export const BUSINESS_CAPABILITIES = {
  retailer: new Set([
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.delete",
    "inventory.adjust",
    "inventory.export",
    "products.view",
    "products.create",
    "products.edit",
    "products.delete",
    "batch.view",
    "batch.create",
    "batch.edit",
    "batch.delete",
    "purchase.view",
    "purchase.create",
    "purchase.edit",
    "purchase.delete",
    "purchase.return",
    "sale.view",
    "sale.create",
    "sale.edit",
    "sale.delete",
    "sale.return",
    "sale.approve",
    "sale.reject",
    "sale.retail",
    "customer.view",
    "customer.create",
    "customer.edit",
    "customer.delete",
    "customer.credit",
    "customer.ledger",
    "supplier.view",
    "supplier.create",
    "supplier.edit",
    "supplier.delete",
    "employees.view",
    "employees.create",
    "employees.edit",
    "employees.delete",
    "reports.view",
    "reports.export",
    "settings.view",
    "settings.manage",
    "audit.view",
  ]),

  wholesaler: new Set([
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.delete",
    "inventory.adjust",
    "inventory.export",
    "products.view",
    "products.create",
    "products.edit",
    "products.delete",
    "batch.view",
    "batch.create",
    "batch.edit",
    "batch.delete",
    "purchase.view",
    "purchase.create",
    "purchase.edit",
    "purchase.delete",
    "purchase.return",
    "sale.view",
    "sale.create",
    "sale.edit",
    "sale.delete",
    "sale.return",
    "sale.approve",
    "sale.reject",
    "sale.retail",
    "sale.wholesale",
    "customer.view",
    "customer.create",
    "customer.edit",
    "customer.delete",
    "customer.credit",
    "customer.ledger",
    "supplier.view",
    "supplier.create",
    "supplier.edit",
    "supplier.delete",
    "employees.view",
    "employees.create",
    "employees.edit",
    "employees.delete",
    "reports.view",
    "reports.export",
    "settings.view",
    "settings.manage",
    "warehouse.view",
    "warehouse.manage",
    "audit.view",
  ]),

  enterprise: new Set(ALL_PERMISSIONS),
};

/**
 * Role Permission Matrices
 * Defines base permissions assigned to each user role.
 */
export const ROLE_PERMISSIONS = {
  owner: new Set(ALL_PERMISSIONS),

  admin: new Set([
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.delete",
    "inventory.adjust",
    "inventory.export",
    "products.view",
    "products.create",
    "products.edit",
    "products.delete",
    "batch.view",
    "batch.create",
    "batch.edit",
    "batch.delete",
    "purchase.view",
    "purchase.create",
    "purchase.edit",
    "purchase.delete",
    "purchase.return",
    "sale.view",
    "sale.create",
    "sale.edit",
    "sale.delete",
    "sale.return",
    "sale.approve",
    "sale.reject",
    "sale.retail",
    "sale.wholesale",
    "customer.view",
    "customer.create",
    "customer.edit",
    "customer.delete",
    "customer.credit",
    "customer.ledger",
    "supplier.view",
    "supplier.create",
    "supplier.edit",
    "supplier.delete",
    "employees.view",
    "employees.create",
    "employees.edit",
    "employees.delete",
    "reports.view",
    "reports.export",
    "settings.view",
    "settings.manage",
    "warehouse.view",
    "warehouse.manage",
    "branch.view",
    "branch.manage",
    "audit.view",
  ]),

  manager: new Set([
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.adjust",
    "inventory.export",
    "products.view",
    "products.create",
    "products.edit",
    "batch.view",
    "batch.create",
    "batch.edit",
    "purchase.view",
    "purchase.create",
    "purchase.edit",
    "purchase.return",
    "sale.view",
    "sale.create",
    "sale.edit",
    "sale.return",
    "sale.approve",
    "sale.reject",
    "sale.retail",
    "sale.wholesale",
    "customer.view",
    "customer.create",
    "customer.edit",
    "customer.credit",
    "customer.ledger",
    "supplier.view",
    "supplier.create",
    "supplier.edit",
    "employees.view",
    "reports.view",
    "reports.export",
    "settings.view",
    "warehouse.view",
    "warehouse.manage",
    "audit.view",
  ]),

  staff: new Set([
    "products.view",
    "inventory.view",
    "batch.view",
    "sale.view",
    "sale.create",
    "sale.retail",
    "customer.view",
    "customer.create",
  ]),

  cashier: new Set([
    "products.view",
    "inventory.view",
    "batch.view",
    "sale.view",
    "sale.create",
    "sale.retail",
    "customer.view",
    "customer.create",
    "customer.credit",
  ]),

  accountant: new Set([
    "inventory.view",
    "purchase.view",
    "sale.view",
    "customer.view",
    "customer.credit",
    "customer.ledger",
    "supplier.view",
    "reports.view",
    "reports.export",
    "audit.view",
  ]),

  warehouse_manager: new Set([
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.adjust",
    "inventory.export",
    "products.view",
    "products.create",
    "products.edit",
    "batch.view",
    "batch.create",
    "batch.edit",
    "batch.delete",
    "purchase.view",
    "purchase.create",
    "supplier.view",
    "warehouse.view",
    "warehouse.manage",
  ]),

  sales_manager: new Set([
    "products.view",
    "inventory.view",
    "batch.view",
    "sale.view",
    "sale.create",
    "sale.edit",
    "sale.return",
    "sale.approve",
    "sale.reject",
    "sale.retail",
    "sale.wholesale",
    "customer.view",
    "customer.create",
    "customer.edit",
    "customer.credit",
    "customer.ledger",
    "reports.view",
    "reports.export",
  ]),

  purchase_manager: new Set([
    "products.view",
    "products.create",
    "products.edit",
    "inventory.view",
    "inventory.create",
    "inventory.edit",
    "inventory.adjust",
    "batch.view",
    "batch.create",
    "batch.edit",
    "purchase.view",
    "purchase.create",
    "purchase.edit",
    "purchase.return",
    "supplier.view",
    "supplier.create",
    "supplier.edit",
    "supplier.delete",
  ]),
};

/**
 * Resolves Effective Permissions
 * Effective = Role Permissions ∩ Business Capabilities
 */
export function getEffectivePermissions(businessType = "retailer", userRole = "owner") {
  const normType = String(businessType || "retailer").toLowerCase().trim();
  const normRole = String(userRole || "owner").toLowerCase().trim();

  const capabilities = BUSINESS_CAPABILITIES[normType] || BUSINESS_CAPABILITIES.retailer;
  const rolePerms = ROLE_PERMISSIONS[normRole] || ROLE_PERMISSIONS.staff;

  const effective = new Set();
  for (const perm of rolePerms) {
    if (capabilities.has(perm)) {
      effective.add(perm);
    }
  }
  return effective;
}

/**
 * Centralized Permission Evaluator
 * Evaluates whether an actor with context { businessType, userRole, isEmployee, role }
 * has the required permission(s).
 */
export function hasPermission(actorContext, requiredPermission) {
  if (!actorContext) return false;

  const isEmployee = Boolean(actorContext.isEmployee);
  const rawRole = String(actorContext.role || "").toLowerCase().trim();

  // Superadmin bypass
  if (rawRole === "superadmin") {
    return true;
  }

  // Resolve business type & user role
  const businessType = String(
    actorContext.businessType || (["wholesaler", "enterprise", "retailer"].includes(rawRole) ? rawRole : "retailer")
  ).toLowerCase().trim();

  let userRole = String(actorContext.userRole || "").toLowerCase().trim();
  if (!userRole) {
    userRole = isEmployee ? "staff" : "owner";
  }

  // Legacy fallback: non-employee accounts without role are owners
  if (!isEmployee && (!userRole || userRole === "retailer" || userRole === "wholesaler" || userRole === "enterprise")) {
    userRole = "owner";
  }

  const effective = getEffectivePermissions(businessType, userRole);

  if (Array.isArray(requiredPermission)) {
    // If array passed, actor must have at least one (OR logic for alternatives)
    return requiredPermission.some((p) => effective.has(p));
  }

  return effective.has(requiredPermission);
}
