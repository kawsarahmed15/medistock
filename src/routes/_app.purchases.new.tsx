import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { Trash2, Plus, ArrowLeft, Search, Save, Printer, PlusCircle, CheckCircle } from "lucide-react";
import { purchasesStore, productsStore, type Product } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
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

  // Supplier add popup
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  // Medicine search modal
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [medicineSearchQuery, setMedicineSearchQuery] = useState("");

  // Refs for keyboard matrix navigation
  const gridRefs = useRef<Array<Array<HTMLInputElement | null>>>([[]]);

  // Load products list
  const loadProducts = () => {
    productsStore.list().then(setProducts).catch(console.error);
  };

  useEffect(() => {
    loadProducts();
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
          saleRate: it.mrp,
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

  const selectProduct = (index: number, p: Product) => {
    const newLines = [...lines];
    newLines[index] = {
      ...newLines[index],
      productId: p.id,
      name: p.name,
      costPrice: p.costPrice || 0,
      taxPercent: p.taxPercent || 0,
      mrp: p.mrp || 0,
      pack: p.pack || "",
      genericName: p.category || "",
      hsn: p.sku || "",
      saleRate: p.price || p.mrp || 0,
      ptr: p.costPrice || 0,
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
        items: lines,
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
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
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
              <div className="space-y-1">
                <Label className="text-[11px]">Supplier Name</Label>
                <Input
                  placeholder="Enter name or search"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="h-8 text-xs font-semibold"
                />
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
        <Card className="p-4 border-border/60 shadow-soft overflow-visible">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-1">
              <span>Medicine Intake Spreadsheet</span>
              <span className="text-[10px] text-muted-foreground font-normal">Use arrow keys/Enter to navigate grid cells.</span>
            </h3>
            <Button type="button" variant="outline" size="xs" onClick={addLine} className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Row (Insert)
            </Button>
          </div>

          <div className="overflow-x-auto w-full border rounded-lg max-h-[400px]">
            <table className="w-full text-xs text-left border-collapse min-w-[1400px]">
              <thead className="bg-muted/60 sticky top-0 z-10">
                <tr className="border-b text-muted-foreground font-semibold">
                  <th className="py-2.5 px-2 w-[220px]">Medicine Name</th>
                  <th className="py-2.5 px-2 w-[110px]">Batch No.</th>
                  <th className="py-2.5 px-2 w-[100px]">Expiry Date</th>
                  <th className="py-2.5 px-2 w-[80px]">Pack Size</th>
                  <th className="py-2.5 px-2 w-[80px] text-right">Purchase Qty</th>
                  <th className="py-2.5 px-2 w-[80px] text-right">Free Qty</th>
                  <th className="py-2.5 px-2 w-[100px] text-right">Buy Rate (Cost)</th>
                  <th className="py-2.5 px-2 w-[100px] text-right">MRP</th>
                  <th className="py-2.5 px-2 w-[80px] text-right">GST %</th>
                  <th className="py-2.5 px-2 w-[120px] text-right">Landing Cost</th>
                  <th className="py-2.5 px-2 w-[120px] text-right">Line Total</th>
                  <th className="py-2.5 px-2 w-[40px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line, idx) => {
                  const lineCalc = calculations.lines[idx];

                  // Expand matrix refs
                  if (!gridRefs.current[idx]) gridRefs.current[idx] = [];

                  return (
                    <tr key={idx} className="hover:bg-muted/10">
                      {/* Name Search Box */}
                      <td className="p-1.5 relative">
                        <Input
                          ref={(el) => (gridRefs.current[idx][0] = el)}
                          placeholder="Medicine or search finder"
                          value={line.name}
                          onChange={(e) => {
                            updateLine(idx, "name", e.target.value);
                            updateLine(idx, "productId", "");
                            setProductSearch(e.target.value);
                          }}
                          onFocus={() => {
                            setActiveLine(idx);
                            setProductSearch(line.name);
                          }}
                          onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                          className="h-7 text-xs py-0 px-2"
                        />
                        {activeLine === idx && productSearch && (
                          <div className="absolute z-50 top-full left-0 mt-1 w-full bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                            {filteredProducts.length > 0 ? (
                              filteredProducts.map((p) => (
                                <div
                                  key={p.id}
                                  className="px-3 py-1.5 hover:bg-muted cursor-pointer text-xs"
                                  onMouseDown={() => selectProduct(idx, p)}
                                >
                                  {p.name} <span className="text-muted-foreground text-[10px]">({p.stock} units, MRP: ₹{p.mrp})</span>
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                Product not found.<br />
                                <Link to="/inventory" className="text-primary hover:underline">Create product first</Link>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Batch */}
                      <td className="p-1.5">
                        <Input
                          ref={(el) => (gridRefs.current[idx][1] = el)}
                          placeholder="Batch"
                          value={line.batch}
                          onChange={(e) => updateLine(idx, "batch", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                          className="h-7 text-xs font-mono uppercase"
                        />
                      </td>

                      {/* Expiry */}
                      <td className="p-1.5">
                        <Input
                          ref={(el) => (gridRefs.current[idx][2] = el)}
                          type="date"
                          value={line.expiry}
                          onChange={(e) => updateLine(idx, "expiry", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                          className="h-7 text-xs p-1"
                        />
                      </td>

                      {/* Pack */}
                      <td className="p-1.5">
                        <Input
                          ref={(el) => (gridRefs.current[idx][3] = el)}
                          placeholder="10x15"
                          value={line.pack}
                          onChange={(e) => updateLine(idx, "pack", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 3)}
                          className="h-7 text-xs text-center"
                        />
                      </td>

                      {/* Purchase Qty */}
                      <td className="p-1.5">
                        <Input
                          ref={(el) => (gridRefs.current[idx][4] = el)}
                          type="number"
                          min="1"
                          value={line.qty || ""}
                          onChange={(e) => updateLine(idx, "qty", parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 4)}
                          className="h-7 text-xs text-right"
                        />
                      </td>

                      {/* Free Qty */}
                      <td className="p-1.5">
                        <Input
                          ref={(el) => (gridRefs.current[idx][5] = el)}
                          type="number"
                          min="0"
                          value={line.freeQty || ""}
                          onChange={(e) => updateLine(idx, "freeQty", parseInt(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 5)}
                          className="h-7 text-xs text-right"
                        />
                      </td>

                      {/* Buy Rate */}
                      <td className="p-1.5">
                        <Input
                          ref={(el) => (gridRefs.current[idx][6] = el)}
                          type="number"
                          step="0.01"
                          value={line.costPrice || ""}
                          onChange={(e) => updateLine(idx, "costPrice", parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 6)}
                          className="h-7 text-xs text-right font-mono"
                        />
                      </td>

                      {/* MRP */}
                      <td className="p-1.5">
                        <Input
                          ref={(el) => (gridRefs.current[idx][7] = el)}
                          type="number"
                          step="0.01"
                          value={line.mrp || ""}
                          onChange={(e) => updateLine(idx, "mrp", parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 7)}
                          className="h-7 text-xs text-right font-mono"
                        />
                      </td>

                      {/* GST */}
                      <td className="p-1.5">
                        <Input
                          ref={(el) => (gridRefs.current[idx][8] = el)}
                          type="number"
                          step="0.1"
                          value={line.taxPercent || ""}
                          onChange={(e) => updateLine(idx, "taxPercent", parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => handleKeyDown(e, idx, 8)}
                          className="h-7 text-xs text-right"
                        />
                      </td>

                      {/* Landing cost info display */}
                      <td className="p-1.5 text-right font-mono text-muted-foreground select-none">
                        ₹{lineCalc?.landingCost.toFixed(2) || "0.00"}
                      </td>

                      {/* Line total info display */}
                      <td className="p-1.5 text-right font-mono font-bold text-primary select-none">
                        ₹{lineCalc?.lineTotal.toFixed(2) || "0.00"}
                      </td>

                      {/* Remove line */}
                      <td className="p-1 text-center">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(idx)} className="h-6 w-6 text-rose-500 hover:bg-rose-50" disabled={lines.length === 1}>
                          <Trash2 className="h-3.5 w-3.5" />
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
    </div>
  );
}
