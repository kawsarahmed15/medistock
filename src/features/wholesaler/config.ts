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
  Building2,
  UserCheck,
} from "lucide-react";
import type { BusinessModuleConfig } from "../types";

/**
 * ============================================================================
 * WHOLESALER MODULE CONFIGURATION
 * ============================================================================
 * Modifying anything in this section only affects Wholesaler accounts and features.
 * Does NOT touch Retailer or Enterprise features.
 * ============================================================================
 */
export const wholesalerConfig: BusinessModuleConfig = {
  category: "wholesaler",
  name: "Wholesale Pharma Distributor & Stockist",
  shortTitle: "Wholesaler",
  subtitle: "B2B distribution, bulk purchasing, batch tracking & multi-client ledger",
  badgeLabel: "Wholesale Distributor",
  badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  accentColor: "#2563eb",
  icon: Building2,
  description: "Designed for pharmaceutical distributors, wholesale stockists, and C&F agents handling bulk supply to pharmacies.",
  signupPitch: "For growing medical distributors, stockists, and agencies handling wholesale volumes.",
  highlights: [
    "B2B Wholesale Tax Invoicing with Drug License & GSTIN Auto-Capture",
    "Multi-Batch Inventory with Pack Size, Free Qty & Landed Purchase Rates",
    "Retailer & Pharmacy Customer Directory with Credit Limit Enforcement",
    "Distributor Purchase Orders (PO), GRN & Landed Cost Tracking",
    "Wholesale Credit Ledger & Batch-wise Outstanding Balances",
    "Staff Dispatch & Sales Executive Multi-Device Access",
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
    multiBranch: false,
    apiAccess: false,
    dedicatedAccountManager: false,
    auditLogs: false,
    maxSkus: "Unlimited SKUs",
    userAccounts: "Up to 5 User Accounts",
  },
  featureList: [
    {
      id: "b2b_invoicing",
      title: "B2B Tax Invoicing & Challans",
      description: "Generate compliant tax invoices capturing Customer Drug License No, GSTIN, and Doctor/Hospital headers.",
      enabled: true,
      tag: "B2B Billing",
    },
    {
      id: "batch_pack_management",
      title: "Full Batch & Pack Management",
      description: "Manage pack conversions (e.g. 10x10 strips, boxes), landed cost price, MRP, PTR, and Scheme/Free quantities.",
      enabled: true,
      tag: "Stock Master",
    },
    {
      id: "pharmacy_master",
      title: "Pharmacy & Hospital Client Master",
      description: "Maintain verified list of retail medical shops with DL validity, GSTIN, credit limits, and delivery addresses.",
      enabled: true,
      tag: "Clients",
    },
    {
      id: "b2b_credit_aging",
      title: "B2B Wholesale Credit & Aging",
      description: "Track outstanding balances per pharmacy customer with payment vouchers, cheque reconciliation, and partial settlements.",
      enabled: true,
      tag: "Finance",
    },
    {
      id: "purchase_landed_cost",
      title: "Distributor Purchase Orders (PO)",
      description: "Record consolidated manufacturer purchase bills with landed price calculations, supplier credits, and barcode SKUs.",
      enabled: true,
      tag: "Supply Chain",
    },
  ],
  allowCategoryChange: false,
};
