import type { BusinessCategory, BusinessModuleConfig } from "./types";
import { retailerConfig } from "./retailer/config";
import { wholesalerConfig } from "./wholesaler/config";
import { enterpriseConfig } from "./enterprise/config";

export * from "./types";
export { retailerConfig } from "./retailer/config";
export { RetailerDashboardBanner, RetailerFeaturesList } from "./retailer/components";
export { wholesalerConfig } from "./wholesaler/config";
export { WholesalerDashboardBanner, WholesalerFeaturesList } from "./wholesaler/components";
export { enterpriseConfig } from "./enterprise/config";
export { EnterpriseDashboardBanner, EnterpriseFeaturesList } from "./enterprise/components";

/**
 * Registry of all business category modules.
 */
const modulesMap: Record<BusinessCategory, BusinessModuleConfig> = {
  retailer: retailerConfig,
  wholesaler: wholesalerConfig,
  enterprise: enterpriseConfig,
};

/**
 * Resolves a businessType or role (or session-like object) to a valid BusinessCategory.
 * Defaults to "retailer" for standard users or staff.
 */
export function resolveBusinessCategory(
  target?: { businessType?: string; role?: string } | string | null
): BusinessCategory {
  let value = "";
  if (typeof target === "string") {
    value = target;
  } else if (target && typeof target === "object") {
    value = target.businessType || target.role || "";
  }
  const normalized = String(value || "").toLowerCase().trim();
  if (normalized === "enterprise") return "enterprise";
  if (normalized === "wholesaler") return "wholesaler";
  return "retailer";
}

/**
 * Returns the module configuration for a given businessType / role / category.
 */
export function getBusinessModule(
  target?: { businessType?: string; role?: string } | string | null
): BusinessModuleConfig {
  const cat = resolveBusinessCategory(target);
  return modulesMap[cat] || retailerConfig;
}

/**
 * Returns all available business categories (e.g. for signup selection).
 */
export function getAllBusinessModules(): BusinessModuleConfig[] {
  return [retailerConfig, wholesalerConfig, enterpriseConfig];
}

/**
 * Checks if a specific capability is enabled for the given businessType/role/category.
 */
export function isCapabilityEnabled(
  target: { businessType?: string; role?: string } | string | null | undefined,
  capability: keyof BusinessModuleConfig["capabilities"]
): boolean {
  const moduleConfig = getBusinessModule(target);
  return Boolean(moduleConfig.capabilities[capability]);
}
