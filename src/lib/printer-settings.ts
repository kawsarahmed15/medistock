export type PaperPreset = "A4_PORTRAIT" | "HALF_A4_SINGLE" | "A4_DUAL_COPY" | "THERMAL_80MM";
export type WorkflowMode = "PREVIEW_MODAL" | "DIRECT_PRINT" | "DOWNLOAD_PDF";
export type TextDensity = "compact" | "regular" | "comfortable";

export type PrintColumnKey =
  | "srNo"
  | "productName"
  | "pack"
  | "batch"
  | "expiry"
  | "hsn"
  | "qty"
  | "freeQty"
  | "mrp"
  | "unitRate"
  | "discountPct"
  | "gstPct"
  | "netAmount";

export interface ColumnDefinition {
  key: PrintColumnKey;
  header: string;
  align: "left" | "center" | "right";
  weight: number;
  required?: boolean;
}

export const ALL_PRINT_COLUMNS: ColumnDefinition[] = [
  { key: "srNo", header: "SN.", align: "center", weight: 3.5, required: true },
  { key: "productName", header: "PRODUCT NAME", align: "left", weight: 26, required: true },
  { key: "pack", header: "PACK", align: "left", weight: 7 },
  { key: "batch", header: "BATCH", align: "left", weight: 9 },
  { key: "expiry", header: "EXP.", align: "center", weight: 6.5 },
  { key: "hsn", header: "HSN", align: "left", weight: 7 },
  { key: "qty", header: "QTY", align: "right", weight: 6.5, required: true },
  { key: "freeQty", header: "FREE", align: "right", weight: 5 },
  { key: "mrp", header: "MRP", align: "right", weight: 8.5 },
  { key: "unitRate", header: "RATE", align: "right", weight: 8.5, required: true },
  { key: "discountPct", header: "DIS%", align: "right", weight: 6 },
  { key: "gstPct", header: "GST%", align: "center", weight: 6 },
  { key: "netAmount", header: "AMOUNT", align: "right", weight: 11.5, required: true },
];

export interface PrintCustomization {
  templateId: string;
  paperPreset: PaperPreset;
  scaleMode?: "HALF_A4_SINGLE" | "A4_DUAL_COPY" | "EXACT_A5" | "A4_FULL";
  primaryColor: string;
  fontFamily: string;
  fontSize: TextDensity;
  showPharmacistSign: boolean;
  pharmacistTitle: string;
  showAuthorisedSign: boolean;
  authorisedTitle: string;
  showDoctorSign: boolean;
  doctorSignTitle: string;
  showDigitalSeal: boolean;
  columns: Record<PrintColumnKey, boolean>;
  headerStyle?: "standard" | "compact" | "banner" | "sidebar";
  showStoreDl: boolean;
  showStoreGstin: boolean;
  showStorePhone: boolean;
  showStoreEmail: boolean;
  showCustomerDetails: boolean;
  showDispatchPayment: boolean;
  transportText: string;
  showPatientDoctor?: boolean;
  showPaymentMode: boolean;
  showHsnSummary: boolean;
  showAmountInWords: boolean;
  showTerms: boolean;
  termsText: string;
  showFooterGreeting: boolean;
  footerGreeting: string;
  showQrCode: boolean;
}

export interface PrinterSettings {
  workflowMode: WorkflowMode;
  printerName: string;
  paperPreset: PaperPreset;
  marginsMm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  calibrationMm: {
    xOffset: number;
    yOffset: number;
  };
  autoCopies: number;
  defaultTemplates: {
    saleCash: string;
    saleCredit: string;
    saleReturn: string;
    purchaseChallan: string;
    purchaseBill: string;
  };
  qzTrayEnabled: boolean;
  qzTrayHost: string;
  qzTrayPort: number;
  customization: PrintCustomization;
}

export const DEFAULT_PRINT_COLUMNS: Record<PrintColumnKey, boolean> = {
  srNo: true,
  productName: true,
  pack: true,
  batch: true,
  expiry: true,
  hsn: true,
  qty: true,
  freeQty: false,
  mrp: true,
  unitRate: true,
  discountPct: true,
  gstPct: true,
  netAmount: true,
};

export const DEFAULT_CUSTOMIZATION: PrintCustomization = {
  templateId: "tmpl-ref-2-modern-ledger",
  paperPreset: "HALF_A4_SINGLE",
  scaleMode: "HALF_A4_SINGLE",
  primaryColor: "#0a5c55",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  fontSize: "regular",
  showPharmacistSign: true,
  pharmacistTitle: "Registered Pharmacist",
  showAuthorisedSign: true,
  authorisedTitle: "Authorized Signatory",
  showDoctorSign: false,
  doctorSignTitle: "Doctor / Prescriber",
  showDigitalSeal: false,
  columns: DEFAULT_PRINT_COLUMNS,
  headerStyle: "standard",
  showStoreDl: true,
  showStoreGstin: true,
  showStorePhone: true,
  showStoreEmail: true,
  showCustomerDetails: true,
  showDispatchPayment: true,
  transportText: "Direct / By Hand",
  showPatientDoctor: true,
  showPaymentMode: true,
  showHsnSummary: true,
  showAmountInWords: true,
  showTerms: true,
  termsText:
    "Goods once sold will not be taken back without valid bill. Cash not refundable. Check expiry date on blister strip.",
  showFooterGreeting: true,
  footerGreeting: "Thank you for your visit! Wishing you good health.",
  showQrCode: true,
};

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  workflowMode: "PREVIEW_MODAL",
  printerName: "Default System Printer",
  paperPreset: "HALF_A4_SINGLE",
  marginsMm: {
    top: 5,
    bottom: 5,
    left: 5,
    right: 5,
  },
  calibrationMm: {
    xOffset: 0,
    yOffset: 0,
  },
  autoCopies: 1,
  defaultTemplates: {
    saleCash: "tmpl-ref-2-modern-ledger",
    saleCredit: "tmpl-ref-2-modern-ledger",
    saleReturn: "tmpl-ref-2-modern-ledger",
    purchaseChallan: "tmpl-ref-1-classic-box",
    purchaseBill: "tmpl-ref-1-classic-box",
  },
  qzTrayEnabled: false,
  qzTrayHost: "localhost",
  qzTrayPort: 8182,
  customization: DEFAULT_CUSTOMIZATION,
};

export interface TemplateDefinition {
  id: string;
  number: string;
  name: string;
  category: string;
  description: string;
  tag: string;
  defaultColor: string;
  defaultFont: string;
  archetype:
    | "original-a4"
    | "modern-ledger"
    | "classic-box"
    | "sidebar-ledger"
    | "minimal-exec"
    | "dark-header"
    | "modern-grid"
    | "compact-pharma"
    | "horizontal-bands"
    | "modern-box"
    | "split-inv"
    | "thermal-80mm";
}

export const PRINT_TEMPLATES: TemplateDefinition[] = [
  {
    id: "tmpl-original-a4",
    number: "00",
    name: "Original Standard A4",
    category: "Classic Standard",
    description: "The built-in original full-page MediStock invoice layout with clinic pill branding and standard tax structure.",
    tag: "A4 Portrait (210×297mm)",
    defaultColor: "#1a9890",
    defaultFont: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    archetype: "original-a4",
  },
  {
    id: "tmpl-ref-2-modern-ledger",
    number: "02",
    name: "Modern Ledger",
    category: "Modern Accent",
    description: "Teal accent branding with wholesaler customer details (DL, GSTIN, Address), dispatch block, and prominent grand total.",
    tag: "A5 Landscape / Dual Half-A4",
    defaultColor: "#0a5c55",
    defaultFont: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    archetype: "modern-ledger",
  },
  {
    id: "tmpl-ref-1-classic-box",
    number: "01",
    name: "Classic Pharmacy Box",
    category: "Boxed Frame",
    description: "Outer solid border frame, classic blue table headers (#bcd0e3), and wholesaler buyer D.L. & GSTIN memo.",
    tag: "A5 Landscape (210×148mm)",
    defaultColor: "#2563eb",
    defaultFont: "Arial, Helvetica, sans-serif",
    archetype: "classic-box",
  },
  {
    id: "tmpl-ref-3-sidebar-ledger",
    number: "03",
    name: "Sidebar Ledger (B&W)",
    category: "Sidebar Layout",
    description: "Left store metadata & QR sidebar with clean dotted item rows and double-line grand total.",
    tag: "A5 Landscape (210×148mm)",
    defaultColor: "#0f172a",
    defaultFont: "Arial, Helvetica, sans-serif",
    archetype: "sidebar-ledger",
  },
  {
    id: "tmpl-ref-04-minimal-exec",
    number: "04",
    name: "Minimal Executive",
    category: "Executive",
    description: "Ultra-clean corporate typography with crisp dividers, 4-point metadata grid, and sharp totals.",
    tag: "A5 Landscape (210×148mm)",
    defaultColor: "#1e293b",
    defaultFont: "'Segoe UI', Arial, sans-serif",
    archetype: "minimal-exec",
  },
  {
    id: "tmpl-ref-05-dark-header",
    number: "05",
    name: "Dark Header",
    category: "High Contrast",
    description: "High-contrast dark top bar with bold white store branding and sleek light-grey line item grid.",
    tag: "A5 Landscape (210×148mm)",
    defaultColor: "#18232d",
    defaultFont: "'Segoe UI', Arial, sans-serif",
    archetype: "dark-header",
  },
  {
    id: "tmpl-ref-06-modern-grid",
    number: "06",
    name: "Modern Grid",
    category: "Modern Grid",
    description: "Balanced two-tone grid cards with highlighted patient and invoice blocks for retail clinics.",
    tag: "A5 Landscape (210×148mm)",
    defaultColor: "#0284c7",
    defaultFont: "'Inter', -apple-system, sans-serif",
    archetype: "modern-grid",
  },
  {
    id: "tmpl-ref-07-compact-pharma",
    number: "07",
    name: "Compact Pharmacy",
    category: "Pharmacy Focus",
    description: "Space-optimized layout designed specifically for busy medical shops with maximized row capacity.",
    tag: "A5 Landscape (210×148mm)",
    defaultColor: "#047857",
    defaultFont: "Arial, sans-serif",
    archetype: "compact-pharma",
  },
  {
    id: "tmpl-ref-12-horizontal-bands",
    number: "12",
    name: "Horizontal Bands",
    category: "Banded Stripe",
    description: "Rhythm-oriented horizontal stripe headers separating sections elegantly with bold borders.",
    tag: "A5 Landscape (210×148mm)",
    defaultColor: "#4f46e5",
    defaultFont: "'Segoe UI', Tahoma, sans-serif",
    archetype: "horizontal-bands",
  },
  {
    id: "tmpl-ref-11-modern-box",
    number: "11",
    name: "Modern Box",
    category: "Boxed Frame",
    description: "Clean bordered card structure with soft gray dividers and highlighted grand total tile.",
    tag: "A5 Landscape (210×148mm)",
    defaultColor: "#334155",
    defaultFont: "Arial, Helvetica, sans-serif",
    archetype: "modern-box",
  },
  {
    id: "tmpl-ref-08-split-inv",
    number: "08",
    name: "Split Invoice",
    category: "Split Layout",
    description: "Side-by-side header block for customer prescription and store dispatch with dual totals.",
    tag: "A5 Landscape (210×148mm)",
    defaultColor: "#0891b2",
    defaultFont: "'Inter', sans-serif",
    archetype: "split-inv",
  },
  {
    id: "tmpl-thermal-80mm",
    number: "13",
    name: "Thermal Receipt (80mm POS)",
    category: "Receipt Roll",
    description: "Continuous 3-inch (80mm) thermal roll slip format optimized for high-speed POS thermal receipt printers.",
    tag: "Thermal Roll (80mm)",
    defaultColor: "#000000",
    defaultFont: "'Courier New', Courier, monospace",
    archetype: "thermal-80mm",
  },
];

export function getTemplateById(id?: string): TemplateDefinition {
  const found = PRINT_TEMPLATES.find((t) => t.id === id);
  return found || PRINT_TEMPLATES[1]; // default to Modern Ledger
}

const STORAGE_KEY = "medistock_printer_settings_v1";

export class PrinterSettingsService {
  static getSettings(): PrinterSettings {
    if (typeof window === "undefined") {
      return DEFAULT_PRINTER_SETTINGS;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_PRINTER_SETTINGS,
          ...parsed,
          marginsMm: {
            ...DEFAULT_PRINTER_SETTINGS.marginsMm,
            ...(parsed.marginsMm || {}),
          },
          calibrationMm: {
            ...DEFAULT_PRINTER_SETTINGS.calibrationMm,
            ...(parsed.calibrationMm || {}),
          },
          defaultTemplates: {
            ...DEFAULT_PRINTER_SETTINGS.defaultTemplates,
            ...(parsed.defaultTemplates || {}),
          },
          customization: {
            ...DEFAULT_CUSTOMIZATION,
            ...(parsed.customization || {}),
            columns: {
              ...DEFAULT_PRINT_COLUMNS,
              ...(parsed.customization?.columns || {}),
            },
          },
        };
      }
    } catch (e) {
      console.warn("Failed to read printer settings from localStorage:", e);
    }
    return DEFAULT_PRINTER_SETTINGS;
  }

  static saveSettings(settings: Partial<PrinterSettings>): PrinterSettings {
    const current = this.getSettings();
    const updated: PrinterSettings = {
      ...current,
      ...settings,
      marginsMm: {
        ...current.marginsMm,
        ...(settings.marginsMm || {}),
      },
      calibrationMm: {
        ...current.calibrationMm,
        ...(settings.calibrationMm || {}),
      },
      defaultTemplates: {
        ...current.defaultTemplates,
        ...(settings.defaultTemplates || {}),
      },
      customization: {
        ...current.customization,
        ...(settings.customization || {}),
        columns: {
          ...current.customization.columns,
          ...(settings.customization?.columns || {}),
        },
      },
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(
          new CustomEvent("medistock-printer-settings-updated", { detail: updated }),
        );
      } catch (e) {
        console.error("Failed to write printer settings to localStorage:", e);
      }
    }

    return updated;
  }

  static resetToDefaults(): PrinterSettings {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(
          new CustomEvent("medistock-printer-settings-updated", {
            detail: DEFAULT_PRINTER_SETTINGS,
          }),
        );
      } catch (e) {
        console.error("Failed to reset printer settings:", e);
      }
    }
    return DEFAULT_PRINTER_SETTINGS;
  }
}

// Sample Bill Snapshot for live preview and calibration test print
export const SAMPLE_BILL_PREVIEW = {
  number: "INV-2026-00892",
  createdAt: "2026-11-16T10:30:00.000Z",
  pharmacyName: "MEDISTOCK PHARMACEUTICALS",
  pharmacyAddress: "Station Road, Wholesale Market, Karimganj, Assam - 788710",
  pharmacyPhone: "+91 98765 43210",
  pharmacyGstNumber: "18AABCM1234F1Z1",
  pharmacyDrugLicNo: "DL-20B-771122 / DL-21B-771123",
  customerName: "M/S MEDILAND",
  customerPhone: "+91 8135937247",
  customerDrugLicNo: "KMJ-83/84",
  customerGstin: "PAN-AEJPH7997C",
  customerAddress: "Bhanga Bazar,Karimganj,Assam",
  transport: "Direct / By Hand",
  paymentMethod: "credit" as const,
  customerNotes: "",
  status: "completed" as const,
  cashier: "Admin",
  subtotal: 12450.0,
  tax: 1494.0,
  discount: 250.0,
  total: 13694.0,
  advanceAmount: 0,
  items: [
    {
      productId: "p1",
      name: "AUGMENTIN 625 DUO TAB",
      pack: "10's",
      batch: "AG-2041",
      expiry: "2028-12-01",
      sku: "300490",
      mrp: 204.5,
      qty: 20,
      freeQty: 2,
      price: 180.0,
      taxPercent: 12,
    },
    {
      productId: "p2",
      name: "PAN-D CAPSULE (PANTO + DOM)",
      pack: "15's",
      batch: "PD-991",
      expiry: "2027-09-01",
      sku: "300490",
      mrp: 199.0,
      qty: 15,
      freeQty: 0,
      price: 165.0,
      taxPercent: 12,
    },
    {
      productId: "p3",
      name: "AZITHRAL 500 MG TAB",
      pack: "5's",
      batch: "AZ-512",
      expiry: "2028-06-01",
      sku: "300490",
      mrp: 132.0,
      qty: 30,
      freeQty: 3,
      price: 115.0,
      taxPercent: 12,
    },
    {
      productId: "p4",
      name: "TELMA-H 40/12.5 TAB",
      pack: "15's",
      batch: "TH-302",
      expiry: "2027-11-01",
      sku: "300490",
      mrp: 295.0,
      qty: 10,
      freeQty: 0,
      price: 245.0,
      taxPercent: 12,
    },
  ],
};
