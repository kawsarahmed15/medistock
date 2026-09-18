import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth, type BusinessType, type UserRole } from "./auth-context";
import { resolveBusinessCategory, getBusinessModule, type BusinessCategory, type BusinessModuleConfig } from "@/features";
import { hasPermission, getEffectivePermissions, type Permission } from "./permissions";
import {
  isFeatureEnabled,
  getEffectiveFeatures,
  type FeatureKey,
} from "./features";

export interface BusinessContextValue {
  businessId: string | null;
  businessType: BusinessType;
  businessCategory: BusinessCategory;
  businessName: string;
  businessSettings: Record<string, any> | null;
  userRole: UserRole;
  isOwner: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  moduleConfig: BusinessModuleConfig;
  permissions: Set<Permission>;
  effectiveFeatures: Record<FeatureKey, boolean>;
  can: (permission: Permission | Permission[]) => boolean;
  isFeatureEnabled: (feature: FeatureKey | FeatureKey[]) => boolean;
  hasCapability: (feature: FeatureKey | FeatureKey[]) => boolean;
  canAccess: (feature: FeatureKey | FeatureKey[], permission: Permission | Permission[]) => boolean;
  getBusinessType: () => BusinessType;
  getUserRole: () => UserRole;
}

const BusinessCtx = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();

  const value = useMemo<BusinessContextValue>(() => {
    const businessType = (session?.businessType || session?.role || "retailer") as BusinessType;
    const businessCategory = resolveBusinessCategory(businessType);
    const userRole = (session?.userRole || (session?.isEmployee ? "staff" : "owner")) as UserRole;
    const isEmployee = Boolean(session?.isEmployee);
    const isOwner = !isEmployee && userRole === "owner";
    const isAdmin = !isEmployee || userRole === "admin";
    const moduleConfig = getBusinessModule(businessType);
    const permissions = getEffectivePermissions(businessType, userRole);
    const effectiveFeatures = getEffectiveFeatures(businessType, session?.businessSettings);

    const can = (permission: Permission | Permission[]) => {
      return hasPermission(session, permission);
    };

    const checkFeature = (feature: FeatureKey | FeatureKey[]) => {
      return isFeatureEnabled(session, feature);
    };

    const canAccess = (feature: FeatureKey | FeatureKey[], permission: Permission | Permission[]) => {
      return checkFeature(feature) && can(permission);
    };

    return {
      businessId: session?.businessId || session?.userId || null,
      businessType,
      businessCategory,
      businessName: session?.businessName || session?.pharmacyName || session?.name || "My Pharmacy",
      businessSettings: session?.businessSettings || null,
      userRole,
      isOwner,
      isAdmin,
      isEmployee,
      moduleConfig,
      permissions,
      effectiveFeatures,
      can,
      isFeatureEnabled: checkFeature,
      hasCapability: checkFeature,
      canAccess,
      getBusinessType: () => businessType,
      getUserRole: () => userRole,
    };
  }, [session]);

  return <BusinessCtx.Provider value={value}>{children}</BusinessCtx.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessCtx);
  if (!ctx) {
    throw new Error("useBusiness must be used within a BusinessProvider");
  }
  return ctx;
}
