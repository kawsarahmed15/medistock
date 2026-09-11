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
  UserCheck,
  Store,
} from "lucide-react";
import type { BusinessModuleConfig } from "../types";

/**
 * ============================================================================
 * RETAILER MODULE CONFIGURATION
 * ============================================================================
 * Modifying anything in this section only affects Retailer accounts and features.
 * Does NOT touch Wholesaler or Enterprise features.
 * ============================================================================
 */
export const retailerConfig: BusinessModuleConfig = {
  category: "retailer",
  name: "Retail Pharmacy & Medical Store",
  shortTitle: "Retailer",
  subtitle: "Single-store pharmacy management, POS sales & patient billing",
  badgeLabel: "Retail Store",
  badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  accentColor: "#059669",
  icon: Store,
  description: "Tailored for retail pharmacies, chemist shops, and medical counters serving patient walk-ins.",
  signupPitch: "Perfect for single pharmacies, chemist shops, and clinics getting started.",
  highlights: [
    "Fast POS Walk-in Billing with Barcode Scanner & Hotkeys",
    "Live Medicine Expiry & Low-Stock Alerts",
    "Patient Credit & Khata Book with Partial Payment Receipts",
    "Purchase Inward & Direct Batch Inventory Tracking",
    "Single-Pharmacy Staff / Cashier Mode with Bill Approvals",
    "Custom Invoices with Drug License & Digital Signature",
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
    bulkBatchPricing: false,
    schemeFreeQty: false,
    drugLicenseEnforcement: false,
    gstinB2bInvoicing: false,
    multiBranch: false,
    apiAccess: false,
    dedicatedAccountManager: false,
    auditLogs: false,
    maxSkus: "Up to 5,000 SKUs",
    userAccounts: "1 User + Staff Logins",
  },
  featureList: [
    {
      id: "pos_billing",
      title: "Fast Retail POS Billing",
      description: "Quick OTC & prescription billing with instant thermal / A4 prints and shortcut keys.",
      enabled: true,
      tag: "Core POS",
    },
    {
      id: "expiry_tracking",
      title: "Batch & Expiry Alerts",
      description: "Automated highlighting of near-expiry medicines (60-180 day alerts).",
      enabled: true,
      tag: "Inventory",
    },
    {
      id: "customer_khata",
      title: "Patient Credit & Khata Ledger",
      description: "Track customer balances, phone numbers, and record advance / partial payments.",
      enabled: true,
      tag: "Accounts",
    },
    {
      id: "staff_cashier",
      title: "Staff Cashier Mode",
      description: "Allow dispensary staff to draft bills that await admin verification.",
      enabled: true,
      tag: "Security",
    },
  ],
  allowCategoryChange: false,
};
