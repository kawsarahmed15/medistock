import type { LucideIcon } from "lucide-react";

export type BusinessCategory = "retailer" | "wholesaler" | "enterprise";

export interface NavItemConfig {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  description?: string;
}

export interface FeatureCapability {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  tag?: string;
}

export interface BusinessModuleConfig {
  category: BusinessCategory;
  name: string;
  shortTitle: string;
  subtitle: string;
  badgeLabel: string;
  badgeClass: string;
  accentColor: string;
  icon: LucideIcon;
  description: string;
  signupPitch: string;
  highlights: string[];
  navigation: NavItemConfig[];
  capabilities: {
    fastPosBilling: boolean;
    patientCreditLedger: boolean;
    expiryAlerts: boolean;
    bulkBatchPricing: boolean;
    schemeFreeQty: boolean;
    drugLicenseEnforcement: boolean;
    gstinB2bInvoicing: boolean;
    multiBranch: boolean;
    apiAccess: boolean;
    dedicatedAccountManager: boolean;
    auditLogs: boolean;
    maxSkus: string;
    userAccounts: string;
  };
  featureList: FeatureCapability[];
  allowCategoryChange: false;
}
