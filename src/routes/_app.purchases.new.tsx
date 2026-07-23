import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { Trash2, Plus, ArrowLeft, Search, Save, Printer, PlusCircle, CheckCircle, ScanLine, AlertTriangle } from "lucide-react";
import { purchasesStore, productsStore, type Product, type Purchase } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";


export const Route = createFileRoute("/_app/purchases/new")({
  component: AddPurchasePage,
});

type PurchaseLine = {
  productId?: string;
  name: string;
  qty: number;
  freeQty: number;
  costPrice: number;
  taxPercent: number;
  batch: string;
  expiry: string;
  mrp: number;
  pack?: string;
  genericName?: string;
  manufacturer?: string;
  barcode?: string;
  hsn?: string;
  saleRate?: number;
  ptr?: number;
  rack?: string;
  isDraftProduct?: boolean;
  draftProductDetails?: any;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

function getDisplayExpiry(expiryDateStr: string) {
  if (!expiryDateStr) return "";
  if (expiryDateStr.length < 10) {
    return expiryDateStr;
  }
  const parts = expiryDateStr.split("-");
  if (parts.length >= 2) {
    const year = parts[0].substring(2);
    const month = parts[1];
    return `${month}/${year}`;
  }
  return expiryDateStr;
}

type MedicineNameInputProps = {
  initialValue: string;
  onChange: (val: string) => void;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
};

function MedicineNameInput({
  initialValue,
  onChange,
  onFocus,
  onKeyDown,
  placeholder,
  inputRef,
}: MedicineNameInputProps) {
  const [localVal, setLocalVal] = useState(initialValue);

  useEffect(() => {
    setLocalVal(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    onChange(val);
  };

  return (
    <Input
      ref={inputRef}
      placeholder={placeholder}
      value={localVal || ""}
      onChange={handleChange}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className="h-9 text-sm px-3"
    />
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function RecentOptions({ id, options }: { id?: string; options: string[] }) {
  if (!options || options.length === 0 || !id) return null;
  return (
    <datalist id={id}>
      {options.map((opt) => (
        <option key={opt} value={opt} />
      ))}
    </datalist>
  );
}

function AddPurchasePage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/_app/purchases/new" }) as any;
  const duplicateFrom = searchParams.duplicateFrom;
  const editFrom = searchParams.editFrom;

  const [lines, setLines] = useState<PurchaseLine[]>([
    { productId: "", name: "", qty: 1, freeQty: 0, costPrice: 0, taxPercent: 0, batch: "", expiry: "", mrp: 0, pack: "", genericName: "", barcode: "", hsn: "", saleRate: 0, ptr: 0 }
  ]);

  // Supplier Details
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [supplierGst, setSupplierGst] = useState("");
  const [supplierDl, setSupplierDl] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");

  // Dates & Payment
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<"cash" | "online" | "credit" | "bank_transfer">("cash");
  const [creditDays, setCreditDays] = useState(0);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [transportName, setTransportName] = useState("");
  const [lrNumber, setLrNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [focusedProductIndex, setFocusedProductIndex] = useState<number>(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFocusedProductIndex(-1);
  }, [productSearch]);

  useEffect(() => {
    if (focusedProductIndex >= 0 && dropdownRef.current) {
      const activeEl = dropdownRef.current.children[focusedProductIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({
          block: "nearest",
        });
      }
    }
  }, [focusedProductIndex]);

  // Supplier add popup
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  // Medicine search modal
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [medicineSearchQuery, setMedicineSearchQuery] = useState("");

  // Quick Add Product state
  const [showQuickProductModal, setShowQuickProductModal] = useState(false);
  const [isDuplicateAlertOpen, setIsDuplicateAlertOpen] = useState(false);
  const [quickProductLineIdx, setQuickProductLineIdx] = useState<number | null>(null);
  const [quickProductForm, setQuickProductForm] = useState({
    name: "",
    category: "",
    manufacturer: "",
    stock: "0",
    costPrice: "",
    price: "",
    mrp: "",
    stockType: "other",
    stockPacks: "",
    stockUnits: "ML",
    expiry: "",
    taxPercent: "12",
    batch: "",
    sku: "",
    prescription: false,
  });

  const [recentCategories, setRecentCategories] = useState<string[]>([]);
  const [recentManufacturers, setRecentManufacturers] = useState<string[]>([]);
  const [recentHsns, setRecentHsns] = useState<string[]>([]);

  useEffect(() => {
    try {
      setRecentCategories(JSON.parse(localStorage.getItem("recentCategories") || "[]"));
      setRecentManufacturers(JSON.parse(localStorage.getItem("recentManufacturers") || "[]"));
      setRecentHsns(JSON.parse(localStorage.getItem("recentHsns") || "[]"));
    } catch {
      // ignore
    }
  }, []);

  const openAddProductModal = (typedName: string, lineIdx: number) => {
    setQuickProductLineIdx(lineIdx);
    setQuickProductForm({
      name: typedName.toUpperCase(),
      category: "",
      manufacturer: "",
      stock: "0",
      costPrice: "",
      price: "",
      mrp: "",
      stockType: "other",
      stockPacks: "",
      stockUnits: "ML",
      expiry: "",
      taxPercent: "12",
      batch: "",
      sku: "",
      prescription: false,
    });
    setShowQuickProductModal(true);
  };

  const handleQuickProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProductForm.name) {
      toast.error("Product name is required.");
      return;
    }

    const isDuplicate = products.some(
      (p) => p.name.trim().toLowerCase() === quickProductForm.name.trim().toLowerCase()
    );
    const isDuplicateInLines = lines.some(
      (l, idx) => idx !== quickProductLineIdx && l.name.trim().toLowerCase() === quickProductForm.name.trim().toLowerCase()
    );
    if (isDuplicate || isDuplicateInLines) {
      setIsDuplicateAlertOpen(true);
      return;
    }

    let packValue: string | undefined = undefined;
    if (quickProductForm.stockType === "tab" || quickProductForm.stockType === "cap" || quickProductForm.stockType === "other") {
      if (quickProductForm.stockPacks) {
        packValue = quickProductForm.stockPacks;
      }
    } else if (quickProductForm.stockType === "syp") {
      if (quickProductForm.stockPacks) {
        packValue = `${quickProductForm.stockPacks}ML`;
      }
    } else if (quickProductForm.stockType === "inj") {
      if (quickProductForm.stockPacks) {
        packValue = `${quickProductForm.stockPacks}${quickProductForm.stockUnits || "ML"}`;
      }
    } else if (quickProductForm.stockType === "cream") {
      if (quickProductForm.stockPacks) {
        packValue = `${quickProductForm.stockPacks} GM`;
      }
    } else if (quickProductForm.stockType === "drop") {
      if (quickProductForm.stockPacks) {
        packValue = `${quickProductForm.stockPacks} ML Drop`;
      }
    }

    const payload = {
      name: quickProductForm.name.trim().toUpperCase(),
      category: quickProductForm.category.trim().toUpperCase() || "GENERAL",
      costPrice: quickProductForm.costPrice === "" ? undefined : Number(quickProductForm.costPrice),
      price: Number(quickProductForm.price) || 0,
      mrp: quickProductForm.mrp === "" ? undefined : Number(quickProductForm.mrp),
      stock: 0, // CRITICAL: Database stock catalog starts at 0, stock is added by the purchase bill items
      pack: packValue,
      expiry: (() => {
        if (!quickProductForm.expiry) return "";
        const parts = quickProductForm.expiry.split("/");
        if (parts.length === 2) {
          const month = parseInt(parts[0], 10);
          const year = 2000 + parseInt(parts[1], 10);
          const lastDay = new Date(year, month, 0).getDate();
          return `${year}-${month.toString().padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
        }
        return quickProductForm.expiry;
      })(),
      batch: quickProductForm.batch.trim() || undefined,
      manufacturer: quickProductForm.manufacturer.trim() ? quickProductForm.manufacturer.trim().toUpperCase() : undefined,
      sku: quickProductForm.sku.trim() || undefined,
      taxPercent: Number(quickProductForm.taxPercent) || 0,
      prescription: quickProductForm.prescription,
      baseUnit: "Unit",
      packUnit: "Pack",
      conversionFactor: 1,
    };

    try {
      const tempProduct: Product & { isDraftProduct: boolean; draftProductDetails: any } = {
        id: "draft-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
        name: payload.name,
        category: payload.category,
        price: payload.price,
        costPrice: payload.costPrice,
        stock: Number(quickProductForm.stock) || 1, // Store the initial stock qty to populate the purchase line qty
        expiry: payload.expiry || "",
        batch: payload.batch || "",
        mrp: payload.mrp,
        pack: payload.pack,
        manufacturer: payload.manufacturer,
        sku: payload.sku,
        taxPercent: payload.taxPercent,
        prescription: payload.prescription,
        createdAt: new Date().toISOString(),
        isDraftProduct: true,
        draftProductDetails: payload,
      };

      const handleAddRecent = (
        key: string,
        val: string | undefined,
        current: string[],
        set: React.Dispatch<React.SetStateAction<string[]>>,
        max: number,
      ) => {
        if (!val) return;
        const cleaned = val.trim().toUpperCase();
        if (!cleaned) return;
        const next = [cleaned, ...current.filter((x) => x !== cleaned)].slice(0, max);
        set(next);
        localStorage.setItem(key, JSON.stringify(next));
      };

      handleAddRecent("recentCategories", payload.category, recentCategories, setRecentCategories, 4);
      if (payload.manufacturer) {
        handleAddRecent("recentManufacturers", payload.manufacturer, recentManufacturers, setRecentManufacturers, 8);
      }
      if (payload.sku) {
        handleAddRecent("recentHsns", payload.sku, recentHsns, setRecentHsns, 4);
      }

      // Autofill the current spreadsheet line with the draft product definition
      if (quickProductLineIdx !== null) {
        selectProduct(quickProductLineIdx, tempProduct);
      }

      toast.success("Product draft added to row. It will be saved to inventory when you save the bill.");
      setShowQuickProductModal(false);
    } catch (err) {
      toast.error((err as Error).message || "Failed to add draft product");
    }
  };

  // Refs for keyboard matrix navigation
  const gridRefs = useRef<Array<Array<HTMLInputElement | null>>>([[]]);

  const [pastPurchases, setPastPurchases] = useState<Purchase[]>([]);
  const [supplierSearchFocused, setSupplierSearchFocused] = useState(false);
  const [activeSupplierMatchIdx, setActiveSupplierMatchIdx] = useState(-1);

  const uniqueSuppliers = useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      gst: string;
      dl: string;
      address: string;
      email: string;
    }>();

    pastPurchases.forEach((p) => {
      const name = (p.supplierName || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      
      let gst = "";
      let dl = "";
      let address = "";
      let email = "";
      if (p.notes) {
        try {
          const meta = JSON.parse(p.notes);
          gst = meta.supplierGst || "";
          dl = meta.supplierDl || "";
          address = meta.supplierAddress || "";
          email = meta.supplierEmail || "";
        } catch {
          // ignore
        }
      }

      if (!map.has(key)) {
        map.set(key, {
          name,
          phone: p.supplierPhone || "",
          gst,
          dl,
          address,
          email,
        });
      } else {
        const existing = map.get(key)!;
        if (!existing.phone && p.supplierPhone) existing.phone = p.supplierPhone;
        if (!existing.gst && gst) existing.gst = gst;
        if (!existing.dl && dl) existing.dl = dl;
        if (!existing.address && address) existing.address = address;
        if (!existing.email && email) existing.email = email;
      }
    });

    return Array.from(map.values());
  }, [pastPurchases]);

  const matchedSuppliers = useMemo(() => {
    const query = supplierName.trim().toLowerCase();
    if (query.length < 1) return [];
    return uniqueSuppliers.filter((s) => s.name.toLowerCase().includes(query));
  }, [uniqueSuppliers, supplierName]);

  useEffect(() => {
    setActiveSupplierMatchIdx(-1);
  }, [matchedSuppliers]);

  const pickSupplier = (s: { name: string; phone: string; gst: string; dl: string; address: string; email: string }) => {
    setSupplierName(s.name);
    setSupplierPhone(s.phone);
    setSupplierGst(s.gst);
    setSupplierDl(s.dl);
    setSupplierAddress(s.address);
    setSupplierEmail(s.email);
  };

  const handleSupplierNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (matchedSuppliers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSupplierMatchIdx((prev) => (prev + 1) % matchedSuppliers.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSupplierMatchIdx((prev) => (prev - 1 + matchedSuppliers.length) % matchedSuppliers.length);
    } else if (e.key === "Enter" && activeSupplierMatchIdx >= 0) {
      e.preventDefault();
      pickSupplier(matchedSuppliers[activeSupplierMatchIdx]);
      setSupplierSearchFocused(false);
    } else if (e.key === "Escape") {
      setSupplierSearchFocused(false);
    }
  };

  // Load products list
  const loadProducts = () => {
    productsStore.list().then(setProducts).catch(console.error);
  };

  useEffect(() => {
    loadProducts();
    purchasesStore.list().then(setPastPurchases).catch(console.error);
  }, []);

  // Handle Edit/Duplicate loading
  useEffect(() => {
    const idToLoad = editFrom || duplicateFrom;
    if (idToLoad) {
      purchasesStore.get(idToLoad).then((p) => {
        setSupplierName(p.supplierName || "");
        setSupplierPhone(p.supplierPhone || "");
        setSupplierInvoice(p.supplierInvoice || "");
        setDiscount(p.discount || 0);
        setPaymentMode(p.paymentMethod === "online" ? "online" : p.paymentMethod === "credit" ? "credit" : p.paymentMethod === "bank_transfer" ? "bank_transfer" : "cash");
        if (p.notes) {
          try {
            const meta = JSON.parse(p.notes);
            if (meta.supplierGst) setSupplierGst(meta.supplierGst);
            if (meta.supplierDl) setSupplierDl(meta.supplierDl);
            if (meta.supplierAddress) setSupplierAddress(meta.supplierAddress);
            if (meta.supplierEmail) setSupplierEmail(meta.supplierEmail);
            if (meta.invoiceDate) setInvoiceDate(meta.invoiceDate);
            if (meta.purchaseDate) setPurchaseDate(meta.purchaseDate);
            if (meta.creditDays) setCreditDays(meta.creditDays);
            if (meta.dueDate) setDueDate(meta.dueDate);
            if (meta.transportName) setTransportName(meta.transportName);
            if (meta.lrNumber) setLrNumber(meta.lrNumber);
            if (meta.remarks) setRemarks(meta.remarks);
          } catch {
            setRemarks(p.notes);
          }
        }
        
        const mappedLines = p.items.map((it) => ({
          productId: it.productId,
          name: it.name,
          qty: it.qty,
          freeQty: it.freeQty,
          costPrice: it.costPrice,
          taxPercent: it.taxPercent,
          batch: it.batch || "",
          expiry: it.expiry || "",
          mrp: it.mrp || 0,
          pack: it.pack || "",
          ptr: it.costPrice,
          saleRate: it.saleRate || it.mrp || 0,
        }));
        setLines(mappedLines);
      }).catch(console.error);
    }
  }, [editFrom, duplicateFrom]);

  // Calculate Due Date based on Credit Days
  useEffect(() => {
    if (creditDays > 0) {
      const d = new Date(invoiceDate);
      d.setDate(d.getDate() + Number(creditDays));
      setDueDate(d.toISOString().slice(0, 10));
    }
  }, [creditDays, invoiceDate]);

  // Layout spreadsheet auto computations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;

    const mappedLines = lines.map((l) => {
      const lineTotal = l.qty * l.costPrice;
      const lineTax = (lineTotal * l.taxPercent) / 100;
      const landingCost = (lineTotal + lineTax) / (l.qty + (l.freeQty || 0)) || 0;
      const margin = l.mrp > 0 ? ((l.mrp - landingCost) / l.mrp) * 100 : 0;

      subtotal += lineTotal;
      totalTax += lineTax;

      return {
        ...l,
        lineTotal,
        landingCost,
        margin,
      };
    });

    const netAmount = subtotal + totalTax - discount;
    const grandTotal = Math.round(netAmount);
    const roundOff = grandTotal - netAmount;

    return {
      lines: mappedLines,
      subtotal,
      tax: totalTax,
      netAmount,
      grandTotal,
      roundOff,
    };
  }, [lines, discount]);

  // GST Summary split-ups
  const gstBreakdown = useMemo(() => {
    const summaryMap = new Map<number, { taxable: number; taxAmount: number }>();
    [0, 5, 12, 18, 28].forEach((r) => summaryMap.set(r, { taxable: 0, taxAmount: 0 }));

    lines.forEach((l) => {
      const rate = l.taxPercent || 0;
      const lineTotal = l.qty * l.costPrice;
      const lineTax = (lineTotal * rate) / 100;

      const matchedRate = [0, 5, 12, 18, 28].reduce((prev, curr) => 
        Math.abs(curr - rate) < Math.abs(prev - rate) ? curr : prev
      );

      const val = summaryMap.get(matchedRate) ?? { taxable: 0, taxAmount: 0 };
      val.taxable += lineTotal;
      val.taxAmount += lineTax;
      summaryMap.set(matchedRate, val);
    });

    return Array.from(summaryMap.entries()).map(([rate, vals]) => ({
      rate,
      taxable: vals.taxable,
      cgst: vals.taxAmount / 2,
      sgst: vals.taxAmount / 2,
      totalTax: vals.taxAmount,
    }));
  }, [lines]);

  const addLine = () => {
    setLines([...lines, { productId: "", name: "", qty: 1, freeQty: 0, costPrice: 0, taxPercent: 0, batch: "", expiry: "", mrp: 0, pack: "", genericName: "", barcode: "", hsn: "", saleRate: 0, ptr: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof PurchaseLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const selectProduct = (index: number, p: Product & { isDraftProduct?: boolean; draftProductDetails?: any }) => {
    const newLines = [...lines];
    newLines[index] = {
      ...newLines[index],
      productId: p.id,
      name: p.name,
      qty: p.isDraftProduct && p.stock && p.stock > 0 ? p.stock : newLines[index].qty || 1,
      batch: p.batch || newLines[index].batch || "",
      expiry: p.expiry || newLines[index].expiry || "",
      costPrice: p.costPrice || 0,
      taxPercent: p.taxPercent || 0,
      mrp: p.mrp || 0,
      pack: p.pack || "",
      genericName: p.category || "",
      hsn: p.sku || "",
      saleRate: p.price || p.mrp || 0,
      ptr: p.costPrice || 0,
      isDraftProduct: p.isDraftProduct,
      draftProductDetails: p.draftProductDetails,
    };
    setLines(newLines);
    setActiveLine(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName) {
      toast.error("Supplier Name is required.");
      return;
    }
    if (!supplierInvoice) {
      toast.error("Distributor Invoice No. is required.");
      return;
    }
    if (lines.some((l) => !l.productId && !l.name)) {
      toast.error("Please add product names for all entry rows.");
      return;
    }
    const unsavedLines = lines.filter((l) => l.name.trim() !== "" && !l.productId);
    if (unsavedLines.length > 0) {
      toast.error(`Please save new products ("${unsavedLines.map(l => l.name).join('", "')}") using the Quick Add (+) button first.`);
      return;
    }
    if (lines.some((l) => !l.batch)) {
      toast.error("Batch numbers are mandatory for all items.");
      return;
    }
    if (lines.some((l) => !l.expiry)) {
      toast.error("Expiry dates (YYYY-MM-DD) are mandatory.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. First save any draft products to inventory database
      const finalLines = [];
      for (const line of lines) {
        if (line.isDraftProduct && line.draftProductDetails) {
          // Add to inventory database
          const newProduct = await productsStore.add(line.draftProductDetails);
          finalLines.push({
            ...line,
            productId: newProduct.id,
            isDraftProduct: undefined,
            draftProductDetails: undefined,
          });
        } else {
          finalLines.push(line);
        }
      }

      // Re-load the product list so autocomplete and local memory remain correct
      await loadProducts();

      const metaNotes = JSON.stringify({
        supplierGst,
        supplierDl,
        supplierAddress,
        supplierEmail,
        invoiceDate,
        purchaseDate,
        creditDays,
        dueDate,
        transportName,
        lrNumber,
        remarks,
      });

      const bodyData = {
        supplierName,
        supplierPhone,
        supplierInvoice,
        notes: metaNotes,
        paymentStatus: paymentMode === "credit" ? "unpaid" : "paid",
        paymentMethod: paymentMode,
        amountPaid: paymentMode === "credit" ? 0 : calculations.grandTotal,
        subtotal: calculations.subtotal,
        tax: calculations.tax,
        discount,
        total: calculations.grandTotal,
        items: finalLines,
      };

      await purchasesStore.add(bodyData);
      toast.success("Purchase registered successfully and stock batch ledger updated.");
      navigate({ to: "/purchases" });
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation handler on table input matrix
  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    // Arrow keys, Enter, etc.
    const key = e.key;

    // Handle dropdown keyboard navigation when in Medicine Name column (colIdx = 0)
    const showAddOption = productSearch && !filteredProducts.some(p => p.name.toLowerCase() === productSearch.trim().toLowerCase());
    const totalDropdownItems = filteredProducts.length + (showAddOption ? 1 : 0);

    if (colIdx === 0 && activeLine === rowIdx && (filteredProducts.length > 0 || showAddOption)) {
      if (key === "ArrowDown") {
        e.preventDefault();
        setFocusedProductIndex((prev) => {
          const nextIdx = prev + 1;
          return nextIdx < totalDropdownItems ? nextIdx : prev;
        });
        return;
      }
      if (key === "ArrowUp") {
        e.preventDefault();
        setFocusedProductIndex((prev) => {
          const nextIdx = prev - 1;
          return nextIdx >= 0 ? nextIdx : -1;
        });
        return;
      }
      if (key === "Enter") {
        if (focusedProductIndex >= 0 && focusedProductIndex < totalDropdownItems) {
          e.preventDefault();
          if (focusedProductIndex < filteredProducts.length) {
            selectProduct(rowIdx, filteredProducts[focusedProductIndex]);
            setFocusedProductIndex(-1);
            // Move focus to next cell (Batch No., colIdx = 1)
            setTimeout(() => {
              gridRefs.current[rowIdx]?.[1]?.focus();
            }, 50);
          } else {
            // It is the "Add product" option
            openAddProductModal(productSearch, rowIdx);
            setFocusedProductIndex(-1);
          }
          return;
        }
      }
      if (key === "Escape") {
        e.preventDefault();
        setActiveLine(null);
        setFocusedProductIndex(-1);
        return;
      }
    }

    if (key === "Enter") {
      e.preventDefault();
      // Move to next cell horizontally
      const nextInput = gridRefs.current[rowIdx]?.[colIdx + 1];
      if (nextInput) {
        nextInput.focus();
      } else if (gridRefs.current[rowIdx + 1]?.[0]) {
        // Wrap to first cell of next row
        gridRefs.current[rowIdx + 1][0]?.focus();
      } else {
        // Create new row if end of matrix is reached
        addLine();
        setTimeout(() => {
          gridRefs.current[rowIdx + 1]?.[0]?.focus();
        }, 50);
      }
    } else if (key === "ArrowDown") {
      gridRefs.current[rowIdx + 1]?.[colIdx]?.focus();
    } else if (key === "ArrowUp") {
      gridRefs.current[rowIdx - 1]?.[colIdx]?.focus();
    } else if (key === "ArrowRight") {
      gridRefs.current[rowIdx]?.[colIdx + 1]?.focus();
    } else if (key === "ArrowLeft") {
      gridRefs.current[rowIdx]?.[colIdx - 1]?.focus();
    }
  };

  const filteredProducts = productSearch
    ? products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : [];

  return (
    <div className="space-y-6 max-w-[98%] 2xl:max-w-[1650px] mx-auto pb-20 px-2 md:px-4">
      {/* Navigation Header */}
      <div className="flex items-center gap-4 border-b pb-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0 text-muted-foreground hover:text-foreground">
          <Link to="/purchases">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {editFrom ? "Edit Purchase Invoice" : "Purchase Invoice Intake (ERP Grid)"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Marg-compatible spreadsheet entries. F2: Product Finder | F4: Select Supplier | F6: Add Supplier.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Supplier & Invoice metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 shadow-soft border-border/50">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Supplier Details</span>
                <Button type="button" variant="ghost" className="h-6 text-[10px] text-primary" onClick={() => setShowSupplierModal(true)}>
                  + Add Supplier (F6)
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1 relative">
                <Label className="text-[11px]">Supplier Name</Label>
                <Input
                  placeholder="Enter name or search"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  onFocus={() => setSupplierSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSupplierSearchFocused(false), 200)}
                  onKeyDown={handleSupplierNameKeyDown}
                  className="h-8 text-xs font-semibold"
                  autoComplete="off"
                />
                {supplierSearchFocused && matchedSuppliers.length > 0 && (
                  <div className="absolute z-50 w-full bg-popover border border-border rounded-md shadow-md mt-1 top-[calc(100%+4px)] overflow-hidden max-h-48 overflow-y-auto no-scrollbar">
                    {matchedSuppliers.map((s, idx) => (
                      <button
                        key={`${s.phone}-${s.name}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          pickSupplier(s);
                          setSupplierSearchFocused(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors outline-none block ${
                          activeSupplierMatchIdx === idx ? "bg-primary/20 text-foreground font-semibold" : "hover:bg-accent"
                        }`}
                      >
                        <div className="font-semibold truncate">{s.name}</div>
                        {(s.phone || s.gst) && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            {s.phone} {s.gst ? `· GST: ${s.gst}` : ""}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Supplier phone</Label>
                <Input
                  placeholder="Contact phone"
                  value={supplierPhone}
                  onChange={(e) => setSupplierPhone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">GSTIN</Label>
                <Input
                  placeholder="22AAAAA0000A1Z5"
                  value={supplierGst}
                  onChange={(e) => setSupplierGst(e.target.value)}
                  className="h-8 text-xs font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Drug License No</Label>
                <Input
                  placeholder="DL-12345/A"
                  value={supplierDl}
                  onChange={(e) => setSupplierDl(e.target.value)}
                  className="h-8 text-xs uppercase"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px]">Address</Label>
                <Input
                  placeholder="Full supplier warehouse address"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/50">
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-semibold">Bill Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px]">Invoice Number</Label>
                <Input
                  placeholder="INV-..."
                  value={supplierInvoice}
                  onChange={(e) => setSupplierInvoice(e.target.value)}
                  className="h-8 text-xs font-mono font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Payment Mode</Label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full text-xs p-1.5 border rounded-md bg-background focus:ring-1 focus:ring-primary h-8"
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                  <option value="online">Online / UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Credit Days</Label>
                <Input
                  type="number"
                  value={creditDays || ""}
                  onChange={(e) => setCreditDays(parseInt(e.target.value) || 0)}
                  className="h-8 text-xs"
                  disabled={paymentMode !== "credit"}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Medicine Entry Grid Spreadsheet */}
        <Card className="p-5 border-border/60 shadow-md overflow-visible bg-card">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Medicine Intake Spreadsheet</span>
                <span className="hidden md:inline text-xs text-muted-foreground font-normal">Use arrow keys/Enter to navigate grid cells.</span>
              </h3>
              <p className="md:hidden text-[11px] text-muted-foreground">Swipe horizontally to view all columns. Use arrow keys/Enter to navigate.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-9 text-xs shrink-0">
              <Plus className="h-4 w-4 mr-1.5" /> Add Row (Insert)
            </Button>
          </div>

          <div className="overflow-x-auto w-full border border-border rounded-lg shadow-sm min-h-[500px] max-h-[700px] no-scrollbar">
            <table className="w-full text-sm text-left border-collapse min-w-[1420px]">
              <thead className="bg-muted/70 sticky top-0 z-10">
                <tr className="border-b text-muted-foreground font-semibold text-[13px]">
                  <th className="py-3 px-3 w-[260px]">Medicine Name</th>
                  <th className="py-3 px-3 w-[120px]">Batch No.</th>
                  <th className="py-3 px-3 w-[145px]">Expiry Date</th>
                  <th className="py-3 px-3 w-[90px]">Pack Size</th>
                  <th className="py-3 px-3 w-[95px] text-right">Purchase Qty</th>
                  <th className="py-3 px-3 w-[95px] text-right">Free Qty</th>
                  <th className="py-3 px-3 w-[110px] text-right">Buy Rate (Cost)</th>
                  <th className="py-3 px-3 w-[110px] text-right">MRP</th>
                  <th className="py-3 px-3 w-[110px] text-right">Sale Price</th>
                  <th className="py-3 px-3 w-[90px] text-right">GST %</th>
                  <th className="py-3 px-3 w-[120px] text-right">Landing Cost</th>
                  <th className="py-3 px-3 w-[120px] text-right">Line Total</th>
                  <th className="py-3 px-3 w-[50px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line, idx) => {
                  const lineCalc = calculations.lines[idx];

                  // Expand matrix refs
                  if (!gridRefs.current[idx]) gridRefs.current[idx] = [];

                  return (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      {/* Name Search Box */}
                      <td className="p-2 relative">
                        <div className="flex items-center gap-1.5 w-full">
                          <div className="relative flex-1">
                            <MedicineNameInput
                              inputRef={(el) => (gridRefs.current[idx][0] = el)}
                              placeholder="Medicine name"
                              initialValue={line.name}
                              onChange={(val) => {
                                updateLine(idx, "name", val);
                                updateLine(idx, "productId", "");
                                setProductSearch(val);
                              }}
                              onFocus={() => {
                                setActiveLine(idx);
                                setProductSearch(line.name);
                              }}
                              onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                            />
                            {activeLine === idx && productSearch && (
                              <div ref={dropdownRef} className="absolute z-50 top-full left-0 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto no-scrollbar">
                                {filteredProducts.map((p, pIdx) => (
                                  <div
                                    key={p.id}
                                    className={`px-3 py-2 cursor-pointer text-xs transition-colors ${
                                      focusedProductIndex === pIdx ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-muted"
                                    }`}
                                    onMouseDown={() => selectProduct(idx, p)}
                                  >
                                    {p.name} <span className="text-muted-foreground text-[10px]">({p.stock} units, MRP: ₹{p.mrp})</span>
                                  </div>
                                ))}
                                {productSearch && !filteredProducts.some(p => p.name.toLowerCase() === productSearch.trim().toLowerCase()) && (
                                  <div
                                    className={`px-3 py-2.5 cursor-pointer text-xs transition-colors border-t font-semibold flex items-center gap-1.5 ${
                                      focusedProductIndex === filteredProducts.length ? "bg-primary/20 text-primary" : "hover:bg-muted text-primary"
                                    }`}
                                    onMouseDown={() => openAddProductModal(productSearch, idx)}
                                  >
                                    <PlusCircle className="h-4 w-4 text-primary" /> Add "{productSearch.toUpperCase()}" as new product
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {!line.productId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-primary hover:bg-primary/10 shrink-0 border border-dashed border-primary"
                              onClick={() => openAddProductModal(line.name, idx)}
                              title="Quick Add this product to Inventory"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>

                      {/* Batch */}
                      <td className="p-2">
                        <Input
                          ref={(el) => (gridRefs.current[idx][1] = el)}
                          placeholder="Batch"
                          value={line.batch}
                          onChange={(e) => updateLine(idx, "batch", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                          className="h-9 text-sm font-mono uppercase px-3"
                        />
                      </td>

                      {/* Expiry */}
                      <td className="p-2">
                        <Input
                          ref={(el) => (gridRefs.current[idx][2] = el)}
                          type="text"
                          placeholder="MM/YY"
                          maxLength={5}
                          value={getDisplayExpiry(line.expiry)}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^\d/]/g, "");
                            const prevDisplayLength = getDisplayExpiry(line.expiry || "").length;
                            if (val.length === 2 && prevDisplayLength !== 3 && !val.includes("/")) {
                              val += "/";
                            }
                            if (val.length === 5) {
                              const parts = val.split("/");
                              if (parts.length === 2) {
                                const month = parseInt(parts[0], 10);
                                const year = 2000 + parseInt(parts[1], 10);
                                if (month >= 1 && month <= 12) {
                                  const lastDay = new Date(year, month, 0).getDate();
                                  const fullDate = `${year}-${parts[0].padStart(2, "0")}-${lastDay.toString().padStart(2, "0")}`;
                                  updateLine(idx, "expiry", fullDate);
                                  return;
                                }
                              }
                            }
                            updateLine(idx, "expiry", val);
                          }}
                          onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                          className="h-9 text-sm px-2 text-center"
                        />
                      </td>

                      {/* Pack */}
                      <td className="p-2">
                        <Input
                          ref={(el) => (gridRefs.current[idx][3] = el)}
                          placeholder="10x15"
                          value={line.pack}
                          onChange={(e) => updateLine(idx, "pack", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 3)}
                          className="h-9 text-sm text-center px-2"
                        />
                      </td>

                      {/* Purchase Qty */}
                      <td className="p-2">
                        <Input
                          ref={(el) => (gridRefs.current[idx][4] = el)}
                          type="number"
                          min="1"
                          value={line.qty || ""}
                          onChange={(e) => updateLine(idx, "qty", parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 4)}
                          className="h-9 text-sm text-right px-3"
                        />
                      </td>

                      {/* Free Qty */}
                      <td className="p-2">
                        <Input
                          ref={(el) => (gridRefs.current[idx][5] = el)}
                          type="number"
                          min="0"
                          value={line.freeQty || ""}
                          onChange={(e) => updateLine(idx, "freeQty", parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 5)}
                          className="h-9 text-sm text-right px-3"
                        />
                      </td>

                      {/* Buy Rate */}
                      <td className="p-2">
                        <Input
                          ref={(el) => (gridRefs.current[idx][6] = el)}
                          type="number"
                          step="0.01"
                          value={line.costPrice || ""}
                          onChange={(e) => updateLine(idx, "costPrice", parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 6)}
                          className="h-9 text-sm text-right font-mono px-3"
                        />
                      </td>

                      {/* MRP */}
                      <td className="p-2">
                        <Input
                          ref={(el) => (gridRefs.current[idx][7] = el)}
                          type="number"
                          step="0.01"
                          value={line.mrp || ""}
                          onChange={(e) => updateLine(idx, "mrp", parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 7)}
                          className="h-9 text-sm text-right font-mono px-3"
                        />
                      </td>

                      {/* Sale Price */}
                      <td className="p-2">
                        <Input
                          ref={(el) => (gridRefs.current[idx][8] = el)}
                          type="number"
                          step="0.01"
                          value={line.saleRate || ""}
                          onChange={(e) => updateLine(idx, "saleRate", parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 8)}
                          className="h-9 text-sm text-right font-mono px-3"
                        />
                      </td>

                      {/* GST */}
                      <td className="p-2">
                        <Input
                          ref={(el) => (gridRefs.current[idx][9] = el)}
                          type="number"
                          step="0.1"
                          value={line.taxPercent || ""}
                          onChange={(e) => updateLine(idx, "taxPercent", parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 9)}
                          className="h-9 text-sm text-right px-3"
                        />
                      </td>

                      {/* Landing cost info display */}
                      <td className="p-2 text-right font-mono text-muted-foreground select-none align-middle text-[13px]">
                        ₹{lineCalc?.landingCost.toFixed(2) || "0.00"}
                      </td>

                      {/* Line total info display */}
                      <td className="p-2 text-right font-mono font-semibold text-primary select-none align-middle text-[13px]">
                        ₹{lineCalc?.lineTotal.toFixed(2) || "0.00"}
                      </td>

                      {/* Remove line */}
                      <td className="p-2 text-center align-middle">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)} className="h-8 w-8 text-rose-500 hover:bg-rose-50" disabled={lines.length === 1}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* GST Summary & Live Summary Box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left panel: GST summary */}
          <Card className="md:col-span-2 shadow-soft border-border/50">
            <CardHeader className="py-3">
              <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">GST Summary splits</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="py-2 text-[10px]">Slab Rate</TableHead>
                    <TableHead className="py-2 text-[10px] text-right">Taxable Amt</TableHead>
                    <TableHead className="py-2 text-[10px] text-right">CGST</TableHead>
                    <TableHead className="py-2 text-[10px] text-right">SGST</TableHead>
                    <TableHead className="py-2 text-[10px] text-right">Total Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gstBreakdown.map((row) => (
                    <TableRow key={row.rate} className="hover:bg-transparent">
                      <TableCell className="py-1.5 font-bold text-xs">{row.rate}%</TableCell>
                      <TableCell className="py-1.5 text-right font-mono text-xs">{formatMoney(row.taxable)}</TableCell>
                      <TableCell className="py-1.5 text-right font-mono text-xs">{formatMoney(row.cgst)}</TableCell>
                      <TableCell className="py-1.5 text-right font-mono text-xs">{formatMoney(row.sgst)}</TableCell>
                      <TableCell className="py-1.5 text-right font-mono text-xs font-semibold text-primary">{formatMoney(row.totalTax)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Right panel: Grand Total summary */}
          <Card className="shadow-soft border-border/50 bg-muted/10">
            <CardContent className="p-5 space-y-3.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (Excl. Tax)</span>
                <span className="font-semibold font-mono">{formatMoney(calculations.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax amount (GST)</span>
                <span className="font-semibold font-mono">{formatMoney(calculations.tax)}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Add Flat Discount</span>
                <Input
                  type="number"
                  step="0.01"
                  className="w-24 h-7 text-right"
                  value={discount || ""}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
              {calculations.roundOff !== 0 && (
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Round Off Adjustment</span>
                  <span className="font-mono">
                    {calculations.roundOff > 0 ? "+" : ""}
                    {formatMoney(calculations.roundOff)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-base font-extrabold pt-3 border-t border-border mt-3">
                <span>Grand Total (Net)</span>
                <span className="text-primary font-mono">{formatMoney(calculations.grandTotal)}</span>
              </div>

              <div className="pt-4 flex gap-2">
                <Button type="submit" className="flex-1 shadow-soft bg-primary text-white font-medium hover:bg-primary/95" disabled={isSubmitting}>
                  <Save className="h-4 w-4 mr-1.5" /> {isSubmitting ? "Processing..." : "Save (Ctrl+S)"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/purchases">Cancel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Supplier registration popup modal (F6) */}
      <Dialog open={showSupplierModal} onOpenChange={setShowSupplierModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Distributor Profile</DialogTitle>
            <DialogDescription>Quickly record the supplier settings to use on purchase intake drafts.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Supplier Name</Label>
              <Input
                placeholder="Distributor name"
                onChange={(e) => setSupplierName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Contact Phone</Label>
              <Input
                placeholder="Phone number"
                onChange={(e) => setSupplierPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input
                placeholder="Address"
                onChange={(e) => setSupplierAddress(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setShowSupplierModal(false)}>
              <CheckCircle className="h-4 w-4 mr-1.5" /> Save Supplier
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Add Product popup modal */}
      <Dialog open={showQuickProductModal} onOpenChange={setShowQuickProductModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Add Product to Inventory</DialogTitle>
            <DialogDescription>
              Define a new product definition. It will be saved into the inventory database catalog and auto-selected for this row.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickProductSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <Field label="Name *" className="col-span-full">
              <Input
                value={quickProductForm.name}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, name: e.target.value.toUpperCase() })}
                required
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Category / Generic Name">
              <Input
                value={quickProductForm.category}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, category: e.target.value.toUpperCase() })}
                placeholder="e.g. Antibiotic"
                list="category-recent-quick"
                className="h-8 text-xs"
              />
              <RecentOptions id="category-recent-quick" options={recentCategories} />
            </Field>
            <Field label="Manufacturer">
              <Input
                value={quickProductForm.manufacturer}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, manufacturer: e.target.value.toUpperCase() })}
                list="manufacturer-recent-quick"
                className="h-8 text-xs"
              />
              <RecentOptions id="manufacturer-recent-quick" options={recentManufacturers} />
            </Field>
            
            <Field label="Initial Stock Qty">
              <Input
                type="number"
                value={quickProductForm.stock}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, stock: e.target.value })}
                placeholder="e.g. 100"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Buying price">
              <Input
                type="number"
                step="0.01"
                value={quickProductForm.costPrice}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, costPrice: e.target.value })}
                placeholder="Cost per unit"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Selling price">
              <Input
                type="number"
                step="0.01"
                value={quickProductForm.price}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, price: e.target.value })}
                placeholder="Rate per unit"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="MRP">
              <Input
                type="number"
                step="0.01"
                value={quickProductForm.mrp}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, mrp: e.target.value })}
                placeholder="Printed price"
                className="h-8 text-xs"
              />
            </Field>

            <Field label="Stock Type">
              <select
                className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={quickProductForm.stockType}
                onChange={(e) => {
                  const type = e.target.value;
                  setQuickProductForm({
                    ...quickProductForm,
                    stockType: type,
                    stockPacks: "",
                    stockUnits: type === "inj" ? "ML" : "",
                  });
                }}
              >
                <option value="other">General / Other</option>
                <option value="tab">Tablet (Tab)</option>
                <option value="cap">Capsule (Cap)</option>
                <option value="syp">Syrup (Syp)</option>
                <option value="inj">Injection (Inj)</option>
                <option value="cream">Cream</option>
                <option value="drop">Drop</option>
              </select>
            </Field>

            {quickProductForm.stockType === "other" && (
              <Field label="Pack Options">
                <div className="flex items-center gap-2">
                  <Input
                    list="general-options-quick"
                    placeholder="e.g. 10X10, ML, GM..."
                    value={quickProductForm.stockPacks}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, stockPacks: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <datalist id="general-options-quick">
                    <option value="10X10" />
                    <option value="10X1X10" />
                    <option value="ML" />
                    <option value="MG" />
                    <option value="GM" />
                    <option value="CAP" />
                  </datalist>
                </div>
              </Field>
            )}

            {(quickProductForm.stockType === "tab" || quickProductForm.stockType === "cap") && (
              <Field label="Pack Format">
                <div className="flex items-center gap-2 w-full">
                  <Input
                    list="tab-cap-pack-options-quick"
                    placeholder="e.g. 10x10, 10X1X10, CAP"
                    value={quickProductForm.stockPacks}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, stockPacks: e.target.value })}
                    required
                    className="h-8 text-xs"
                  />
                  <datalist id="tab-cap-pack-options-quick">
                    <option value="10X10" />
                    <option value="10X1X10" />
                    <option value="CAP" />
                  </datalist>
                </div>
              </Field>
            )}

            {quickProductForm.stockType === "syp" && (
              <Field label="Pack (ML)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="ML Amount"
                    value={quickProductForm.stockPacks}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, stockPacks: e.target.value })}
                    required
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground text-xs font-medium">ML</span>
                </div>
              </Field>
            )}

            {quickProductForm.stockType === "inj" && (
              <Field label="Pack (Measure)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={quickProductForm.stockPacks}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, stockPacks: e.target.value })}
                    required
                    className="h-8 text-xs"
                  />
                  <select
                    className="flex h-8 w-24 items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={quickProductForm.stockUnits || "ML"}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, stockUnits: e.target.value })}
                  >
                    <option value="ML">ML</option>
                    <option value="MG">MG</option>
                    <option value="GM">GM</option>
                  </select>
                </div>
              </Field>
            )}

            {quickProductForm.stockType === "cream" && (
              <Field label="Pack (Measure)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={quickProductForm.stockPacks}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, stockPacks: e.target.value })}
                    required
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground text-xs font-medium">GM</span>
                </div>
              </Field>
            )}

            {quickProductForm.stockType === "drop" && (
              <Field label="Pack (Measure)">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={quickProductForm.stockPacks}
                    onChange={(e) => setQuickProductForm({ ...quickProductForm, stockPacks: e.target.value })}
                    required
                    className="h-8 text-xs"
                  />
                  <span className="text-muted-foreground text-xs font-medium">ML</span>
                </div>
              </Field>
            )}

            <Field label="Expiry (MM/YY)">
              <Input
                type="text"
                placeholder="MM/YY"
                maxLength={5}
                value={quickProductForm.expiry}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^\d/]/g, "");
                  if (val.length === 2 && quickProductForm.expiry.length !== 3 && !val.includes("/")) {
                    val += "/";
                  }
                  setQuickProductForm({ ...quickProductForm, expiry: val });
                }}
                className="h-8 text-xs"
              />
            </Field>

            <Field label="Tax %">
              <Input
                type="number"
                value={quickProductForm.taxPercent}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, taxPercent: e.target.value })}
                className="h-8 text-xs"
              />
            </Field>

            <Field label="Batch">
              <Input
                value={quickProductForm.batch}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, batch: e.target.value.toUpperCase() })}
                placeholder="e.g. B123"
                className="h-8 text-xs uppercase font-mono"
              />
            </Field>

            <Field label="HSN Code">
              <Input
                value={quickProductForm.sku}
                onChange={(e) => setQuickProductForm({ ...quickProductForm, sku: e.target.value })}
                placeholder="Type or scan"
                list="hsn-recent-quick"
                className="h-8 text-xs"
              />
              <RecentOptions id="hsn-recent-quick" options={recentHsns} />
            </Field>

            <div className="col-span-full flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Prescription required</div>
                <div className="text-xs text-muted-foreground">
                  Mark this product as Rx-only.
                </div>
              </div>
              <Switch
                checked={quickProductForm.prescription}
                onCheckedChange={(v) => setQuickProductForm({ ...quickProductForm, prescription: v })}
              />
            </div>

            <DialogFooter className="col-span-full">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowQuickProductModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="shadow-soft">
                Save & Select
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Product Alert Dialog */}
      <Dialog open={isDuplicateAlertOpen} onOpenChange={setIsDuplicateAlertOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-900">
              Duplicate Product
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Product is already added in inventory.
          </div>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setIsDuplicateAlertOpen(false)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-soft"
              autoFocus
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
