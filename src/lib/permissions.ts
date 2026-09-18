/**
 * Centralized RBAC & Permission Registry for Medistock Frontend
 */

import type { BusinessType, UserRole } from "./auth-context";

export type Permission =
  // INVENTORY
  | "inventory.view"
  | "inventory.create"
  | "inventory.edit"
  | "inventory.delete"
  | "inventory.adjust"
  | "inventory.export"

  // PRODUCTS
  | "products.view"
  | "products.create"
  | "products.edit"
  | "products.delete"

  // BATCH
  | "batch.view"
  | "batch.create"
  | "batch.edit"
  | "batch.delete"

  // PURCHASE
  | "purchase.view"
  | "purchase.create"
  | "purchase.edit"
  | "purchase.delete"
  | "purchase.return"

  // SALES
  | "sale.view"
  | "sale.create"
  | "sale.edit"
  | "sale.delete"
  | "sale.return"
  | "sale.approve"
  | "sale.reject"
  | "sale.retail"
  | "sale.wholesale"

  // CUSTOMERS
  | "customer.view"
  | "customer.create"
  | "customer.edit"
  | "customer.delete"
  | "customer.credit"
  | "customer.ledger"

  // SUPPLIERS
  | "supplier.view"
  | "supplier.create"
  | "supplier.edit"
  | "supplier.delete"

  // EMPLOYEES
  | "employees.view"
  | "employees.create"
  | "employees.edit"
  | "employees.delete"

  // REPORTS
  | "reports.view"
  | "reports.export"

  // SETTINGS
  | "settings.view"
  | "settings.manage"

  // WAREHOUSE
  | "warehouse.view"
  | "warehouse.manage"

  // BRANCH
  | "branch.view"
  | "branch.manage"

  // AUDIT
  | "audit.view";

export const ALL_PERMISSIONS: Permission[] = [
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
];

export const BUSINESS_CAPABILITIES: Record<string, Set<Permission>> = {
  retailer: new Set<Permission>([
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

  wholesaler: new Set<Permission>([
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

  enterprise: new Set<Permission>(ALL_PERMISSIONS),
};

export const ROLE_PERMISSIONS: Record<string, Set<Permission>> = {
  owner: new Set<Permission>(ALL_PERMISSIONS),

  admin: new Set<Permission>([
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

  manager: new Set<Permission>([
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

  staff: new Set<Permission>([
    "products.view",
    "inventory.view",
    "batch.view",
    "sale.view",
    "sale.create",
    "sale.retail",
    "customer.view",
    "customer.create",
  ]),

  cashier: new Set<Permission>([
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

  accountant: new Set<Permission>([
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

  warehouse_manager: new Set<Permission>([
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

  sales_manager: new Set<Permission>([
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

  purchase_manager: new Set<Permission>([
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
 * Calculates effective permissions: Role Permissions ∩ Business Capabilities
 */
export function getEffectivePermissions(
  businessType: BusinessType = "retailer",
  userRole: UserRole = "owner"
): Set<Permission> {
  const normType = String(businessType || "retailer").toLowerCase().trim();
  const normRole = String(userRole || "owner").toLowerCase().trim();

  const capabilities = BUSINESS_CAPABILITIES[normType] || BUSINESS_CAPABILITIES.retailer;
  const rolePerms = ROLE_PERMISSIONS[normRole] || ROLE_PERMISSIONS.staff;

  const effective = new Set<Permission>();
  for (const perm of rolePerms) {
    if (capabilities.has(perm)) {
      effective.add(perm);
    }
  }
  return effective;
}

export interface ActorContext {
  businessType?: BusinessType;
  userRole?: UserRole;
  isEmployee?: boolean;
  role?: string;
}

/**
 * Centralized Permission Evaluator
 */
export function hasPermission(
  actor: ActorContext | null | undefined,
  requiredPermission: Permission | Permission[]
): boolean {
  if (!actor) return false;

  const isEmployee = Boolean(actor.isEmployee);
  const rawRole = String(actor.role || "").toLowerCase().trim();

  if (rawRole === "superadmin") {
    return true;
  }

  const businessType = (actor.businessType ||
    (["wholesaler", "enterprise", "retailer"].includes(rawRole) ? rawRole : "retailer")) as BusinessType;

  let userRole = actor.userRole as UserRole;
  if (!userRole) {
    userRole = isEmployee ? "staff" : "owner";
  }

  if (!isEmployee && (!userRole || userRole === "retailer" || userRole === "wholesaler" || userRole === "enterprise")) {
    userRole = "owner";
  }

  const effective = getEffectivePermissions(businessType, userRole);

  if (Array.isArray(requiredPermission)) {
    return requiredPermission.some((p) => effective.has(p));
  }

  return effective.has(requiredPermission);
}
