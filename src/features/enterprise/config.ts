import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  ReceiptText,
  Users,
  CreditCard,
  Truck,
  BookOpen,
  Settings,
  Building,
  UserCheck,
} from "lucide-react";
import type { BusinessModuleConfig } from "../types";

/**
 * ============================================================================
 * ENTERPRISE MODULE CONFIGURATION
 * ============================================================================
 * Modifying anything in this section only affects Enterprise accounts and features.
 * Does NOT touch Retailer or Wholesaler features.
 * ============================================================================
 */
export const enterpriseConfig: BusinessModuleConfig = {
  category: "enterprise",
  name: "Pharma Enterprise & Multi-Branch Network",
  shortTitle: "Enterprise",
  subtitle: "High-scale pharmaceutical distribution, multi-location & chain operations",
  badgeLabel: "Enterprise Suite",
  badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  accentColor: "#7c3aed",
  icon: Building,
  description: "Built for multi-store pharmacy chains, large healthcare networks, and enterprise pharmaceutical distributors.",
  signupPitch: "Multi-store chains and enterprise distributor networks requiring maximum control and SLA.",
  highlights: [
    "Unlimited Everything: Master SKUs, High-throughput Transactions & Volume Invoicing",
    "Central Master Catalog & Multi-Location Stock Synchronization Ready",
    "Dedicated Account Manager & Priority 24/7 Technical Support (99.9% SLA)",
    "Comprehensive Multi-Role Delegations, Staff Permissions & Security Audits",
    "Enterprise Supply Chain, Purchase Requisitions & Direct Consolidated Billing",
    "Custom Integration Support & High-Speed API Access",
  ],
  navigation: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/inventory", label: "Inventory", icon: Package },
    { to: "/sell", label: "Sell", icon: ShoppingCart },
    { to: "/cart", label: "Cart", icon: ShoppingBag },
    { to: "/bills", label: "Bills", icon: ReceiptText },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/employees", label: "Employees", icon: UserCheck },
    { to: "/purchases", label: "Purchases", icon: Truck },
    { to: "/credit", label: "Credit", icon: CreditCard },
    { to: "/ledger", label: "Ledger", icon: BookOpen },
    { to: "/settings", label: "Settings", icon: Settings },
  ],
  capabilities: {
    fastPosBilling: true,
    patientCreditLedger: true,
    expiryAlerts: true,
    bulkBatchPricing: true,
    schemeFreeQty: true,
    drugLicenseEnforcement: true,
    gstinB2bInvoicing: true,
    multiBranch: true,
    apiAccess: true,
    dedicatedAccountManager: true,
    auditLogs: true,
    maxSkus: "Unlimited SKUs",
    userAccounts: "Unlimited Accounts",
  },
  featureList: [
    {
      id: "unlimited_scale",
      title: "Unlimited Capacity & SKUs",
      description: "No limits on products, batches, billing volume, or active staff accounts.",
      enabled: true,
      tag: "Scale",
    },
    {
      id: "dedicated_sla",
      title: "Dedicated Manager & 99.9% SLA",
      description: "Direct account manager line, emergency phone support, and prioritized bug fixes.",
      enabled: true,
      tag: "Priority SLA",
    },
    {
      id: "api_integrations",
      title: "API & Custom Integrations",
      description: "Seamless synchronization with ERPs, accounting software, and external supply chains.",
      enabled: true,
      tag: "Integrations",
    },
    {
      id: "multi_branch_ready",
      title: "Multi-Branch & Chain Governance",
      description: "Unified master stock, consolidated financial reports, and centralized customer records.",
      enabled: true,
      tag: "Governance",
    },
  ],
  allowCategoryChange: false,
};
