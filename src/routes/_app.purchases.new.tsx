import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { Trash2, Plus, ArrowLeft, Search, Save, PackagePlus, FileSpreadsheet, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api-client";

export const Route = createFileRoute("/_app/purchases/new")({
  component: AddPurchasePage,
});

type PurchaseLine = {
  medicine_name: string;
  generic_name: string;
  batch_number: string;
  expiry_date: string;
  purchase_rate: number;
  mrp: number;
  sale_rate: number;
  gst: number;
  discount: number;
  rack: string;
  quantity: number;
  free_quantity: number;
  barcode?: string;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function AddPurchasePage() {
  const navigate = useNavigate();

  // Invoice headers
  const [invoiceNo, setInvoiceNo] = useState("");
  const [supplierId, setSupplierId] = useState("default-supplier");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);

  // Invoice rows
  const [lines, setLines] = useState<PurchaseLine[]>([
    {
      medicine_name: "",
      generic_name: "",
      batch_number: "",
      expiry_date: "",
      purchase_rate: 0,
      mrp: 0,
      sale_rate: 0,
      gst: 12,
      discount: 0,
      rack: "",
      quantity: 1,
      free_quantity: 0,
      barcode: "",
    },
  ]);

  const [activeRowIdx, setActiveRowIdx] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [highlightedSearchIdx, setHighlightedSearchIdx] = useState(0);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // New Medicine Dialog
  const [newMedOpen, setNewMedOpen] = useState(false);
  const [newMedForm, setNewMedForm] = useState({
    name: "",
    generic: "",
    gst: "12",
    hsn: "",
    barcode: "",
  });

  // Duplicate Batch popup dialog
  const [duplicateBatchOpen, setDuplicateBatchOpen] = useState(false);
  const [dupInfo, setDupInfo] = useState<{
    medicineName: string;
    batchNumber: string;
    expiryDate: string;
    currentStock: number;
    purchasedQty: number;
    newStock: number;
    rowIdx: number;
  } | null>(null);

  // Fetch medicines autocomplete list on query change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/marg/medicines/autocomplete?query=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res);
      } catch (err) {
        console.error(err);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addLine = () => {
    setLines([
      ...lines,
      {
        medicine_name: "",
        generic_name: "",
        batch_number: "",
        expiry_date: "",
        purchase_rate: 0,
        mrp: 0,
        sale_rate: 0,
        gst: 12,
        discount: 0,
        rack: "",
        quantity: 1,
        free_quantity: 0,
        barcode: "",
      },
    ]);
    setActiveRowIdx(lines.length);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
      setActiveRowIdx(Math.max(0, activeRowIdx - 1));
    }
  };

  const updateLine = (index: number, field: keyof PurchaseLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  // Check if batch already exists for the medicine name
  const checkBatchDuplication = async (rowIdx: number, batchNum: string) => {
    const medName = lines[rowIdx].medicine_name;
    if (!medName || !batchNum) return;
    try {
      const items = await apiRequest("GET", `/api/marg/medicines/search?query=${encodeURIComponent(medName)}`);
      const matchedMed = items.find((m: any) => m.medicine_name.toLowerCase() === medName.toLowerCase());
      if (matchedMed) {
        const matchedBatch = matchedMed.batches.find((b: any) => b.batch_number.toLowerCase() === batchNum.toLowerCase().trim());
        if (matchedBatch) {
          setDupInfo({
            medicineName: matchedMed.medicine_name,
            batchNumber: matchedBatch.batch_number,
            expiryDate: matchedBatch.expiry_date.slice(0, 7),
            currentStock: matchedBatch.stock,
            purchasedQty: lines[rowIdx].quantity,
            newStock: Number(matchedBatch.stock) + Number(lines[rowIdx].quantity),
            rowIdx,
          });
          setDuplicateBatchOpen(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Enter to Next Field grid logic
  const handleFieldKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Move to next cell horizontally
      const nextCell = document.getElementById(`cell-${rowIdx}-${colIdx + 1}`);
      if (nextCell) {
        (nextCell as HTMLInputElement).focus();
        (nextCell as HTMLInputElement).select();
      } else {
        // Wrap to the first column of the next row
        const nextRowCell = document.getElementById(`cell-${rowIdx + 1}-0`);
        if (nextRowCell) {
          (nextRowCell as HTMLInputElement).focus();
          (nextRowCell as HTMLInputElement).select();
        } else {
          // If it's the very last field, add a line and focus it
          addLine();
          setTimeout(() => {
            const newRowCell = document.getElementById(`cell-${rowIdx + 1}-0`);
            newRowCell?.focus();
          }, 50);
        }
      }
    }
  };

  // Keyboard Shortcuts (MARG style)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (e.key === "F2") {
        e.preventDefault();
        // Focus active row medicine name search
        document.getElementById(`cell-${activeRowIdx}-0`)?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        setNewMedOpen(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        navigate({ to: "/inventory" });
      } else if (e.key === "F4" || (e.ctrlKey && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        void submitInvoice();
      } else if (e.key === "Escape") {
        setDuplicateBatchOpen(false);
        setNewMedOpen(false);
      }
    };
    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  });

  const selectMedicine = (item: any, rowIdx: number) => {
    updateLine(rowIdx, "medicine_name", item.medicine_name);
    updateLine(rowIdx, "generic_name", item.generic_name || "");
    updateLine(rowIdx, "gst", item.gst || 12);
    updateLine(rowIdx, "barcode", item.barcode || "");
    setShowSearchDropdown(false);
    // Focus next cell in the row
    setTimeout(() => {
      document.getElementById(`cell-${rowIdx}-1`)?.focus();
    }, 50);
  };

  const handleAutocompleteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedSearchIdx((prev) => Math.min(searchResults.length - 1, prev + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedSearchIdx((prev) => Math.max(0, prev - 1));
    } else if (e.key === "Enter" && showSearchDropdown && searchResults.length > 0) {
      e.preventDefault();
      selectMedicine(searchResults[highlightedSearchIdx], rowIdx);
    } else if (e.key === "Escape") {
      setShowSearchDropdown(false);
    }
  };

  const totalInvoiceVal = useMemo(() => {
    return lines.reduce((sum, item) => {
      const lineCost = Number(item.purchase_rate || 0) * Number(item.quantity || 0) * (1 - Number(item.discount || 0) / 100);
      return sum + lineCost;
    }, 0);
  }, [lines]);

  const submitInvoice = async () => {
    if (!invoiceNo.trim()) {
      toast.error("Invoice Number is required");
      return;
    }
    if (lines.some((l) => !l.medicine_name.trim() || !l.batch_number.trim() || !l.expiry_date)) {
      toast.error("All rows must have Medicine Name, Batch Number, and Expiry Date.");
      return;
    }

    try {
      await apiRequest("POST", "/api/marg/purchases", {
        supplier_id: supplierId,
        invoice_no: invoiceNo,
        purchase_date: purchaseDate,
        items: lines.map((l) => ({
          ...l,
          expiry_date: l.expiry_date + "-01", // convert YYYY-MM to database YYYY-MM-DD format
        })),
      });
      toast.success("Purchase Invoice saved successfully!");
      navigate({ to: "/purchases" });
    } catch (err) {
      toast.error((err as Error).message || "Failed to save purchase");
    }
  };

  return (
    <div className="space-y-6 pb-24 text-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/purchases">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">MARG Purchase Entry</h1>
            <p className="text-xs text-muted-foreground">
              Keyboard-first grid. Press <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px]">Enter</kbd> to cycle fields.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewMedOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Medicine [F3]
          </Button>
          <Button className="bg-[#1A9890] hover:bg-[#157e77]" size="sm" onClick={submitInvoice}>
            <Save className="h-4 w-4 mr-1" /> Save Invoice [F4]
          </Button>
        </div>
      </div>

      {/* Invoice Details card */}
      <Card className="shadow-sm border">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Invoice No</Label>
            <Input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="e.g. PI-7489"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Supplier</Label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full h-10 border rounded-lg bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#1A9890]"
            >
              <option value="default-supplier">Default Supplier Co.</option>
              <option value="abc-pharma">ABC Pharma Distributors</option>
              <option value="prime-health">Prime Health Supplies</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Purchase Date</Label>
            <Input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div className="bg-slate-50 border rounded-xl p-3 flex flex-col justify-center items-end">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Purchase Value</span>
            <span className="text-2xl font-black text-[#1A9890]">{formatMoney(totalInvoiceVal)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Entry table */}
      <Card className="shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px] select-none">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b sticky top-0 z-10 uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-2">#</th>
                <th className="py-2.5 px-2 min-w-[180px]">Medicine Name</th>
                <th className="py-2.5 px-2 w-28">Batch No</th>
                <th className="py-2.5 px-2 w-28">Expiry (MM/YY)</th>
                <th className="py-2.5 px-2 w-20 text-right">P. Rate</th>
                <th className="py-2.5 px-2 w-20 text-right">MRP</th>
                <th className="py-2.5 px-2 w-20 text-right">S. Rate</th>
                <th className="py-2.5 px-2 w-16 text-center">GST %</th>
                <th className="py-2.5 px-2 w-16 text-right">Disc %</th>
                <th className="py-2.5 px-2 w-24">Rack</th>
                <th className="py-2.5 px-2 w-18 text-right">Qty</th>
                <th className="py-2.5 px-2 w-18 text-right">Free</th>
                <th className="py-2.5 px-2 w-24 text-right">Total</th>
                <th className="py-2.5 px-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {lines.map((item, idx) => {
                const itemTotal = Number(item.purchase_rate || 0) * Number(item.quantity || 0) * (1 - Number(item.discount || 0) / 100);

                return (
                  <tr key={idx} className={`hover:bg-slate-50/50 ${activeRowIdx === idx ? "bg-slate-50" : ""}`} onClick={() => setActiveRowIdx(idx)}>
                    <td className="py-1.5 px-2 text-slate-400 font-mono">{idx + 1}</td>

                    {/* Medicine Autocomplete cell */}
                    <td className="py-1 px-1 relative">
                      <input
                        id={`cell-${idx}-0`}
                        type="text"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none font-semibold"
                        placeholder="Type medicine..."
                        value={item.medicine_name}
                        onChange={(e) => {
                          updateLine(idx, "medicine_name", e.target.value);
                          setSearchQuery(e.target.value);
                          setShowSearchDropdown(true);
                          setHighlightedSearchIdx(0);
                        }}
                        onFocus={() => {
                          setActiveRowIdx(idx);
                          setSearchQuery(item.medicine_name);
                          setShowSearchDropdown(true);
                        }}
                        onKeyDown={(e) => handleAutocompleteKeyDown(e, idx)}
                      />

                      {/* Dropdown panel */}
                      {showSearchDropdown && activeRowIdx === idx && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto divide-y">
                          {searchResults.map((r, sIdx) => (
                            <div
                              key={r.id}
                              onClick={() => selectMedicine(r, idx)}
                              className={`p-2 flex items-center justify-between cursor-pointer text-xs ${
                                highlightedSearchIdx === sIdx ? "bg-[#1A9890]/10 text-slate-900 border-l-2 border-[#1A9890]" : "hover:bg-slate-50 text-slate-700"
                              }`}
                            >
                              <div>
                                <span className="font-bold">{r.medicine_name}</span>
                                <span className="text-[10px] text-muted-foreground ml-2">({r.generic_name})</span>
                              </div>
                              <span className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">GST {r.gst}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Batch Number */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-1`}
                        type="text"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none uppercase font-mono"
                        placeholder="BATCH12"
                        value={item.batch_number}
                        onChange={(e) => updateLine(idx, "batch_number", e.target.value)}
                        onBlur={() => checkBatchDuplication(idx, item.batch_number)}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 1)}
                      />
                    </td>

                    {/* Expiry Date */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-2`}
                        type="month"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-slate-800"
                        value={item.expiry_date}
                        onChange={(e) => updateLine(idx, "expiry_date", e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 2)}
                      />
                    </td>

                    {/* Purchase Rate */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-3`}
                        type="number"
                        step="0.01"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-right font-mono"
                        value={item.purchase_rate || ""}
                        onChange={(e) => updateLine(idx, "purchase_rate", Number(e.target.value))}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 3)}
                      />
                    </td>

                    {/* MRP */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-4`}
                        type="number"
                        step="0.01"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-right font-mono"
                        value={item.mrp || ""}
                        onChange={(e) => updateLine(idx, "mrp", Number(e.target.value))}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 4)}
                      />
                    </td>

                    {/* Sale Rate */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-5`}
                        type="number"
                        step="0.01"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-right font-semibold text-slate-800 font-mono"
                        value={item.sale_rate || ""}
                        onChange={(e) => updateLine(idx, "sale_rate", Number(e.target.value))}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 5)}
                      />
                    </td>

                    {/* GST */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-6`}
                        type="number"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-center font-mono"
                        value={item.gst || ""}
                        onChange={(e) => updateLine(idx, "gst", Number(e.target.value))}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 6)}
                      />
                    </td>

                    {/* Discount */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-7`}
                        type="number"
                        step="0.01"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-right font-mono"
                        value={item.discount || ""}
                        onChange={(e) => updateLine(idx, "discount", Number(e.target.value))}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 7)}
                      />
                    </td>

                    {/* Rack */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-8`}
                        type="text"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none"
                        placeholder="RACK-A"
                        value={item.rack}
                        onChange={(e) => updateLine(idx, "rack", e.target.value)}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 8)}
                      />
                    </td>

                    {/* Quantity */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-9`}
                        type="number"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-right font-bold font-mono"
                        value={item.quantity}
                        onChange={(e) => updateLine(idx, "quantity", Number(e.target.value))}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 9)}
                      />
                    </td>

                    {/* Free Quantity */}
                    <td className="py-1 px-1">
                      <input
                        id={`cell-${idx}-10`}
                        type="number"
                        className="w-full px-2 py-1 border rounded bg-transparent focus:bg-white outline-none text-right font-mono"
                        value={item.free_quantity}
                        onChange={(e) => updateLine(idx, "free_quantity", Number(e.target.value))}
                        onKeyDown={(e) => handleFieldKeyDown(e, idx, 10)}
                      />
                    </td>

                    <td className="py-2 px-2 text-right font-bold text-slate-800 tabular-nums">
                      {formatMoney(itemTotal)}
                    </td>

                    <td className="py-2 px-1 text-center">
                      <button onClick={() => removeLine(idx)} className="text-slate-300 hover:text-rose-600 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 border-t p-3 flex justify-between items-center text-xs">
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-4 w-4 mr-1" /> Add Row
          </Button>
          <div className="flex gap-4 text-slate-500 font-medium">
            <span>F2 = Search Med</span>
            <span>F3 = New Med</span>
            <span>F4 = Save Invoice</span>
            <span>F8 = Stock View</span>
          </div>
        </div>
      </Card>

      {/* DIALOG: Duplicate Batch Found */}
      <Dialog open={duplicateBatchOpen} onOpenChange={setDuplicateBatchOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base text-[#1A9890] flex items-center gap-1.5">
              <FileSpreadsheet className="h-5 w-5" /> Medicine Batch Found
            </DialogTitle>
          </DialogHeader>
          {dupInfo && (
            <div className="text-xs space-y-2 border p-3 rounded-lg bg-emerald-50/20 border-emerald-100">
              <div className="font-bold text-slate-800 text-sm">{dupInfo.medicineName}</div>
              <div>Batch: <span className="font-semibold text-slate-800 font-mono">{dupInfo.batchNumber}</span></div>
              <div>Expiry: <span className="font-semibold text-slate-800">{dupInfo.expiryDate}</span></div>
              <div className="pt-2 border-t flex justify-between">
                <span>Current Stock:</span>
                <span className="font-bold">{dupInfo.currentStock}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Purchased Qty:</span>
                <span>+{dupInfo.purchasedQty}</span>
              </div>
              <div className="border-t pt-1 flex justify-between font-bold text-emerald-700">
                <span>New Cumulative Stock:</span>
                <span>{dupInfo.newStock}</span>
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-start">
            <Button
              className="bg-[#1A9890] hover:bg-[#157e77] w-full"
              onClick={() => {
                setDuplicateBatchOpen(false);
              }}
            >
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Add New Medicine */}
      <Dialog open={newMedOpen} onOpenChange={setNewMedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-[#1A9890]" /> Add New Medicine
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px] font-bold">Medicine Name</Label>
              <Input
                value={newMedForm.name}
                onChange={(e) => setNewMedForm({ ...newMedForm, name: e.target.value })}
                placeholder="e.g. Paracetamol 500"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px] font-bold">Salt / Generic Name</Label>
              <Input
                value={newMedForm.generic}
                onChange={(e) => setNewMedForm({ ...newMedForm, generic: e.target.value })}
                placeholder="e.g. Paracetamol Acetaminophen"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold">GST %</Label>
              <Input
                type="number"
                value={newMedForm.gst}
                onChange={(e) => setNewMedForm({ ...newMedForm, gst: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold">HSN Code</Label>
              <Input
                value={newMedForm.hsn}
                onChange={(e) => setNewMedForm({ ...newMedForm, hsn: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px] font-bold">Barcode</Label>
              <Input
                value={newMedForm.barcode}
                onChange={(e) => setNewMedForm({ ...newMedForm, barcode: e.target.value })}
                placeholder="e.g. 890123456789"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewMedOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#1A9890] hover:bg-[#157e77]"
              onClick={() => {
                if (!newMedForm.name.trim()) {
                  toast.error("Medicine Name is required");
                  return;
                }
                const newLines = [...lines];
                newLines[activeRowIdx] = {
                  ...newLines[activeRowIdx],
                  medicine_name: newMedForm.name,
                  generic_name: newMedForm.generic,
                  gst: Number(newMedForm.gst),
                  barcode: newMedForm.barcode,
                };
                setLines(newLines);
                setNewMedOpen(false);
                setNewMedForm({ name: "", generic: "", gst: "12", hsn: "", barcode: "" });
                toast.success("Medicine added to active row");
              }}
            >
              Configure Medicine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
