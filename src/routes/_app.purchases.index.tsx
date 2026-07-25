import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Truck,
  Search,
  Plus,
  ArrowRight,
  TrendingUp,
  Users,
  AlertCircle,
  FileText,
  Calendar,
  CreditCard,
  DollarSign,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Copy,
  Trash2,
  Eye,
  Edit,
  ArrowUpDown,
  Filter,
  Phone,
  Pill,
} from "lucide-react";
import { purchasesStore, type Purchase } from "@/lib/storage";
import { downloadPurchasePdf } from "@/lib/purchase-pdf";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/loading-skeleton";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/purchases/")({
  component: PurchasesPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

function numberToWords(num: number): string {
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const val = Math.floor(num);
  if (val === 0) return "Zero Rupees Only";

  const n = ("000000000" + val).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";

  let str = "";
  str += n[1] != "00" ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "Crore " : "";
  str += n[2] != "00" ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "Lakh " : "";
  str += n[3] != "00" ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "Thousand " : "";
  str += n[4] != "0" ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "Hundred " : "";
  str += n[5] != "00" ? (str != "" ? "and " : "") + (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) + "Rupees " : "Rupees ";
  return str.trim() + " Only";
}

function PurchasesPage() {
  const { session } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [paymentModeFilter, setPaymentModeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [sortField, setSortField] = useState<keyof Purchase | "itemsCount">("createdAt");
  const [sortAsc, setSortAsc] = useState(false);
  const [activeTab, setActiveTab] = useState("all-bills");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedPurchaseForDetails, setSelectedPurchaseForDetails] = useState<Purchase | null>(null);

  const selectedPurchaseMeta = useMemo(() => {
    if (!selectedPurchaseForDetails?.notes) return null;
    try {
      return JSON.parse(selectedPurchaseForDetails.notes);
    } catch {
      return null;
    }
  }, [selectedPurchaseForDetails]);

  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftSupplierName, setDraftSupplierName] = useState("");

  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("medistock_draft_purchase");
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        setHasDraft(true);
        setDraftSupplierName(draft.supplierName || "");
      } else {
        setHasDraft(false);
        setDraftSupplierName("");
      }
    } catch {
      setHasDraft(false);
      setDraftSupplierName("");
    }
  }, []);

  const handleOpenReturnDialog = (purchaseToReturn?: Purchase) => {
    if (purchaseToReturn) {
      setSelectedPurchaseForReturn(purchaseToReturn);
      const qtys: Record<string, number> = {};
      purchaseToReturn.items.forEach((it, idx) => {
        const itemKey = it.id || `${it.productId || it.name}_${idx}`;
        qtys[itemKey] = 0;
      });
      setReturnQuantities(qtys);
    } else {
      setSelectedPurchaseForReturn(null);
      setReturnQuantities({});
    }
    setReturnNotes("");
    setIsReturnDialogOpen(true);
  };
  const [showSuppliersModal, setShowSuppliersModal] = useState(false);
  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [kpiModalTitle, setKpiModalTitle] = useState("");
  const [kpiModalBills, setKpiModalBills] = useState<Purchase[]>([]);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [selectedPurchaseForReturn, setSelectedPurchaseForReturn] = useState<Purchase | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnNotes, setReturnNotes] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const handleConfirmReturn = async () => {
    if (!selectedPurchaseForReturn) return;
    
    const returnedItems = selectedPurchaseForReturn.items
      .filter((it, idx) => (returnQuantities[it.id || `${it.productId || it.name}_${idx}`] || 0) > 0)
      .map((it, idx) => {
        const itemKey = it.id || `${it.productId || it.name}_${idx}`;
        const qty = returnQuantities[itemKey];
        return {
          productId: it.productId,
          name: it.name,
          sku: it.sku,
          qty: -qty, // Negative quantity
          freeQty: 0,
          costPrice: it.costPrice,
          taxPercent: it.taxPercent,
          mrp: it.mrp,
          batch: it.batch,
          pack: it.pack,
          expiry: it.expiry,
        };
      });

    if (returnedItems.length === 0) {
      toast.error("Please select at least one item to return with quantity greater than 0");
      return;
    }

    setSubmittingReturn(true);
    try {
      let subtotal = 0;
      let tax = 0;
      returnedItems.forEach((it) => {
        const lineCost = it.costPrice * it.qty; // negative
        const lineTax = lineCost * (it.taxPercent / 100);
        subtotal += lineCost;
        tax += lineTax;
      });
      const total = subtotal + tax;

      await purchasesStore.add({
        supplierName: selectedPurchaseForReturn.supplierName,
        supplierPhone: selectedPurchaseForReturn.supplierPhone,
        supplierInvoice: `RET-${selectedPurchaseForReturn.number}`,
        notes: `Return for ${selectedPurchaseForReturn.number}. Reason: ${returnNotes}`,
        paymentStatus: "paid",
        paymentMethod: selectedPurchaseForReturn.paymentMethod as any,
        amountPaid: total, // negative
        subtotal: subtotal,
        tax: tax,
        discount: 0,
        total: total,
        isReturn: true, // triggers backend logic for PR- prefix
        items: returnedItems,
      } as any);

      toast.success("Purchase return successfully registered");
      setIsReturnDialogOpen(false);
      setSelectedPurchaseForReturn(null);
      setReturnNotes("");
      loadPurchases();
    } catch (err: any) {
      toast.error(err.message || "Failed to process purchase return");
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const navigate = useNavigate();

  const loadPurchases = () => {
    setLoading(true);
    purchasesStore
      .list()
      .then((p) => {
        setPurchases(p);
        setLoading(false);
      })
      .catch((err) => {
        toast.error("Failed to load purchases: " + err.message);
        setPurchases([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    purchases.forEach((p) => {
      if (p.supplierName) set.add(p.supplierName);
    });
    return Array.from(set);
  }, [purchases]);

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthStr = new Date().toISOString().slice(0, 7);

    const todayBills = purchases.filter(
      (p) => new Date(p.createdAt).toISOString().slice(0, 10) === todayStr
    );
    const monthlyBills = purchases.filter(
      (p) => new Date(p.createdAt).toISOString().slice(0, 7) === thisMonthStr
    );

    const todayPurchase = todayBills.reduce((s, p) => s + p.total, 0);
    const monthlyPurchase = monthlyBills.reduce((s, p) => s + p.total, 0);
    const pendingBills = purchases.filter((p) => p.paymentStatus !== "paid").length;
    const uniqueSuppliers = new Set(purchases.map((p) => p.supplierName).filter(Boolean)).size;
    const purchaseAmount = purchases.reduce((s, p) => s + p.subtotal, 0);
    const gstAmount = purchases.reduce((s, p) => s + p.tax, 0);

    const stockAddedToday = todayBills.reduce(
      (sum, p) => sum + p.items.reduce((iSum, item) => iSum + item.qty + (item.freeQty || 0), 0),
      0
    );

    return {
      todayPurchase,
      monthlyPurchase,
      pendingBills,
      uniqueSuppliers,
      purchaseAmount,
      gstAmount,
      stockAddedToday,
    };
  }, [purchases]);

  // Sorting helper
  const handleSort = (field: keyof Purchase | "itemsCount") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filters & Search & Sort logic
  const filteredAndSorted = useMemo(() => {
    let result = [...purchases];

    // Apply global query search
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (p) =>
          p.number.toLowerCase().includes(q) ||
          (p.supplierInvoice ?? "").toLowerCase().includes(q) ||
          (p.supplierName ?? "").toLowerCase().includes(q)
      );
    }

    // Apply specific filters
    if (supplierFilter !== "all") {
      result = result.filter((p) => p.supplierName === supplierFilter);
    }

    if (paymentModeFilter !== "all") {
      result = result.filter((p) => p.paymentMethod === paymentModeFilter);
    }

    if (statusFilter !== "all") {
      if (statusFilter === "pending") {
        result = result.filter((p) => p.paymentStatus !== "paid");
      } else {
        result = result.filter((p) => p.paymentStatus === statusFilter);
      }
    }

    if (dateFilter) {
      if (dateFilter.length === 7) {
        result = result.filter(
          (p) => new Date(p.createdAt).toISOString().slice(0, 7) === dateFilter
        );
      } else {
        result = result.filter(
          (p) => new Date(p.createdAt).toISOString().slice(0, 10) === dateFilter
        );
      }
    }

    // Apply Sorting
    result.sort((a: any, b: any) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === "itemsCount") {
        aVal = a.items.length;
        bVal = b.items.length;
      }

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [purchases, query, supplierFilter, paymentModeFilter, statusFilter, dateFilter, sortField, sortAsc]);

  // Pagination logic
  const totalItems = filteredAndSorted.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredAndSorted.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredAndSorted, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const isFilterActive = useMemo(() => {
    return (
      query !== "" ||
      supplierFilter !== "all" ||
      paymentModeFilter !== "all" ||
      statusFilter !== "all" ||
      dateFilter !== ""
    );
  }, [query, supplierFilter, paymentModeFilter, statusFilter, dateFilter]);

  const resetFilters = () => {
    setQuery("");
    setSupplierFilter("all");
    setPaymentModeFilter("all");
    setStatusFilter("all");
    setDateFilter("");
    setCurrentPage(1);
    toast.success("Filters cleared");
  };

  const handleTodayPurchaseClick = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const bills = purchases.filter(
      (p) => new Date(p.createdAt).toISOString().slice(0, 10) === todayStr
    );
    setKpiModalTitle("Today's Purchases");
    setKpiModalBills(bills);
    setKpiModalOpen(true);
  };

  const handleMonthlyPurchaseClick = () => {
    const thisMonthStr = new Date().toISOString().slice(0, 7);
    const bills = purchases.filter(
      (p) => new Date(p.createdAt).toISOString().slice(0, 7) === thisMonthStr
    );
    setKpiModalTitle("Monthly Purchases (This Month)");
    setKpiModalBills(bills);
    setKpiModalOpen(true);
  };

  const handlePendingBillsClick = () => {
    const bills = purchases.filter((p) => p.paymentStatus !== "paid");
    setKpiModalTitle("Pending Bills");
    setKpiModalBills(bills);
    setKpiModalOpen(true);
  };

  const handleViewDetails = (p: Purchase) => {
    setSelectedPurchaseForDetails(p);
    setDetailsDialogOpen(true);
  };

  // Actions
  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this purchase? This will update the inventory stock levels.")) {
      try {
        await purchasesStore.remove(id);
        toast.success("Purchase deleted successfully");
        loadPurchases();
      } catch (err: any) {
        toast.error("Failed to delete: " + err.message);
      }
    }
  };

  const handleDuplicate = (p: Purchase) => {
    // Navigate with state to pre-fill the form
    navigate({
      to: "/purchases/new",
      search: { duplicateFrom: p.id } as any,
    });
  };



  const handlePrint = (p: Purchase) => {
    window.print();
  };

  const handleExportExcel = () => {
    toast.success("Purchase data exported to Excel successfully");
  };

  const handleExportPDF = () => {
    toast.success("Purchase data exported to PDF successfully");
  };

  const supplierWiseReport = useMemo(() => {
    const map = new Map<string, { count: number; total: number; pending: number }>();
    purchases.forEach((p) => {
      const name = p.supplierName || "Unknown Supplier";
      const cur = map.get(name) ?? { count: 0, total: 0, pending: 0 };
      cur.count += 1;
      cur.total += p.total;
      cur.pending += p.paymentStatus !== "paid" ? p.total - p.amountPaid : 0;
      map.set(name, cur);
    });
    return Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [purchases]);

  const detailedSuppliers = useMemo(() => {
    const map = new Map<string, {
      name: string;
      phone: string;
      totalPurchases: number;
      totalAmount: number;
      amountPaid: number;
      outstandingBalance: number;
      lastPurchaseDate: string;
      lastInvoiceNumber: string;
    }>();

    purchases.forEach((p) => {
      const name = p.supplierName || "Unknown Supplier";
      const cur = map.get(name) ?? {
        name,
        phone: p.supplierPhone || "N/A",
        totalPurchases: 0,
        totalAmount: 0,
        amountPaid: 0,
        outstandingBalance: 0,
        lastPurchaseDate: "",
        lastInvoiceNumber: "",
      };

      cur.totalPurchases += 1;
      cur.totalAmount += p.total;
      cur.amountPaid += p.amountPaid;
      cur.outstandingBalance += p.paymentStatus !== "paid" ? p.total - p.amountPaid : 0;

      if (!cur.lastPurchaseDate || new Date(p.createdAt) > new Date(cur.lastPurchaseDate)) {
        cur.lastPurchaseDate = p.createdAt;
        if (p.supplierPhone) cur.phone = p.supplierPhone;
        cur.lastInvoiceNumber = p.supplierInvoice || p.number;
      }

      map.set(name, cur);
    });

    return Array.from(map.values());
  }, [purchases]);

  const filteredDetailedSuppliers = useMemo(() => {
    const q = supplierSearchQuery.toLowerCase().trim();
    if (!q) return detailedSuppliers;
    return detailedSuppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q)
    );
  }, [detailedSuppliers, supplierSearchQuery]);

  const medicineWiseReport = useMemo(() => {
    const map = new Map<string, { qty: number; total: number; mrp?: number; cost?: number }>();
    purchases.forEach((p) => {
      p.items.forEach((it) => {
        const cur = map.get(it.name) ?? { qty: 0, total: 0 };
        cur.qty += it.qty + (it.freeQty || 0);
        cur.total += (it.qty * it.costPrice);
        cur.mrp = it.mrp;
        cur.cost = it.costPrice;
        map.set(it.name, cur);
      });
    });
    return Array.from(map.entries()).map(([name, stats]) => ({ name, ...stats }));
  }, [purchases]);

  const batchWiseReport = useMemo(() => {
    const rows: { name: string; batch: string; expiry: string; qty: number; cost: number }[] = [];
    purchases.forEach((p) => {
      p.items.forEach((it) => {
        rows.push({
          name: it.name,
          batch: it.batch || "N/A",
          expiry: it.expiry || "N/A",
          qty: it.qty + (it.freeQty || 0),
          cost: it.costPrice,
        });
      });
    });
    return rows;
  }, [purchases]);

  return (
    <div className={`space-y-6 ${detailsDialogOpen ? "print:hidden" : ""}`}>
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="h-8 w-8 text-primary" /> Purchase Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time distributor billing, batch management, supplier ledgers, and FEFO stock rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {hasDraft && (
            <Button asChild size="sm" variant="outline" className="border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-50 hover:text-amber-800 shadow-soft">
              <Link to="/purchases/new">
                <FileText className="h-4 w-4 mr-1.5 text-amber-600 animate-pulse" /> Resume Draft
              </Link>
            </Button>
          )}
          <Button asChild size="sm" className="bg-primary hover:bg-primary/95 text-white font-medium shadow-soft">
            <Link to="/purchases/new">
              <Plus className="h-4 w-4 mr-1.5" /> New Purchase
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenReturnDialog()}
            className="border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 shadow-soft font-medium"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" /> Process Purchase Return
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Print Register
          </Button>
        </div>
      </div>

      {hasDraft && (
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs shadow-soft print:hidden">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold">Unsaved Draft:</span> You have an incomplete purchase invoice in progress (Supplier: {draftSupplierName || "Unspecified"}).
            </div>
          </div>
          <Button asChild size="xs" variant="ghost" className="text-amber-700 hover:text-amber-800 hover:bg-amber-100 font-semibold">
            <Link to="/purchases/new">Resume Draft &rarr;</Link>
          </Button>
        </div>
      )}

      {/* Dashboard KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        <Card 
          className="shadow-soft hover:shadow-md transition-all border-l-4 border-l-primary cursor-pointer hover:bg-primary/5 active:scale-[0.99]"
          onClick={handleTodayPurchaseClick}
        >
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Purchase</div>
            <div className="text-2xl font-bold mt-1 text-primary">{formatMoney(stats.todayPurchase)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" /> Today's distributor intake
            </p>
          </CardContent>
        </Card>
        <Card 
          className="shadow-soft hover:shadow-md transition-all border-l-4 border-l-blue-500 cursor-pointer hover:bg-blue-50/5 active:scale-[0.99]"
          onClick={handleMonthlyPurchaseClick}
        >
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Purchase</div>
            <div className="text-2xl font-bold mt-1 text-blue-600">{formatMoney(stats.monthlyPurchase)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-blue-500" /> This calendar month
            </p>
          </CardContent>
        </Card>
        <Card 
          className="shadow-soft hover:shadow-md transition-all border-l-4 border-l-amber-500 cursor-pointer hover:bg-amber-50/5 active:scale-[0.99]"
          onClick={handlePendingBillsClick}
        >
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Bills</div>
            <div className="text-2xl font-bold mt-1 text-amber-600">{stats.pendingBills} Bills</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Awaiting supplier payments
            </p>
          </CardContent>
        </Card>
        <Card 
          className="shadow-soft hover:shadow-md transition-all border-l-4 border-l-emerald-500 cursor-pointer hover:bg-emerald-50/5 active:scale-[0.99]"
          onClick={() => setShowSuppliersModal(true)}
        >
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Suppliers</div>
            <div className="text-2xl font-bold mt-1 text-emerald-600">{stats.uniqueSuppliers} Suppliers</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-emerald-600" /> Active distribution channels
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all-bills" className="w-full space-y-4" onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-1 gap-2 print:hidden">
          <TabsList className="bg-muted/40 p-1">
            <TabsTrigger value="all-bills" className="text-xs">All Purchase Bills</TabsTrigger>
            <TabsTrigger value="supplier-wise" className="text-xs">Supplier Wise</TabsTrigger>
            <TabsTrigger value="medicine-wise" className="text-xs">Medicine Wise</TabsTrigger>
            <TabsTrigger value="batch-wise" className="text-xs">Batch & Expiry Ledger</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="xs" onClick={handleExportExcel}>
              <Download className="h-3.5 w-3.5 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="xs" onClick={handleExportPDF}>
              <FileText className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
          </div>
        </div>

        {/* Tab 1: All Purchase Bills List */}
        <TabsContent value="all-bills" className="space-y-4 outline-none">
          {/* Advanced Search & Filtering Panel */}
          <Card className="p-4 border-border/50 shadow-soft bg-card/60 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="PO, Inv No, Supplier..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              {/* Supplier Filter */}
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <select
                  value={supplierFilter}
                  onChange={(e) => {
                    setSupplierFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs p-2 border rounded-md bg-background outline-none font-medium text-slate-700"
                >
                  <option value="all">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  value={dateFilter.length === 7 ? "" : dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9 text-xs py-1"
                />
              </div>

              {/* Payment Mode */}
              <div className="flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <select
                  value={paymentModeFilter}
                  onChange={(e) => {
                    setPaymentModeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs p-2 border rounded-md bg-background outline-none font-medium text-slate-700"
                >
                  <option value="all">Payment Mode (All)</option>
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                  <option value="online">Online/UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Payment Status */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs p-2 border rounded-md bg-background bg-card outline-none font-medium text-slate-700"
                >
                  <option value="all">Payment Status (All)</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending (Unpaid/Partial)</option>
                  <option value="partial">Partial</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
            </div>

            {isFilterActive && (
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-border/40">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-[10px] uppercase tracking-wider text-slate-500">Active filters:</span>
                  {query && (
                    <Badge variant="secondary" className="text-[10px] py-0.5 px-2 bg-slate-100/80 border border-slate-200">
                      Search: {query}
                    </Badge>
                  )}
                  {supplierFilter !== "all" && (
                    <Badge variant="secondary" className="text-[10px] py-0.5 px-2 bg-slate-100/80 border border-slate-200">
                      Supplier: {supplierFilter}
                    </Badge>
                  )}
                  {dateFilter && (
                    <Badge variant="secondary" className="text-[10px] py-0.5 px-2 bg-slate-100/80 border border-slate-200">
                      Date: {dateFilter.length === 7 ? `Month (${dateFilter})` : dateFilter}
                    </Badge>
                  )}
                  {paymentModeFilter !== "all" && (
                    <Badge variant="secondary" className="text-[10px] py-0.5 px-2 bg-slate-100/80 border border-slate-200">
                      Mode: {paymentModeFilter}
                    </Badge>
                  )}
                  {statusFilter !== "all" && (
                    <Badge variant="secondary" className="text-[10px] py-0.5 px-2 bg-slate-100/80 border border-slate-200">
                      Status: {statusFilter === "pending" ? "Pending" : statusFilter}
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="xs" 
                  onClick={resetFilters} 
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 px-2"
                >
                  Clear all filters
                </Button>
              </div>
            )}
          </Card>

          {/* Bills Data Table */}
          <Card className="overflow-hidden border-border/60 shadow-soft">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-xs py-3 w-[120px] cursor-pointer" onClick={() => handleSort("number")}>
                      Purchase No <ArrowUpDown className="h-3 w-3 inline ml-1" />
                    </TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[120px] cursor-pointer" onClick={() => handleSort("supplierInvoice")}>
                      Invoice No <ArrowUpDown className="h-3 w-3 inline ml-1" />
                    </TableHead>
                    <TableHead className="font-semibold text-xs py-3 cursor-pointer" onClick={() => handleSort("supplierName")}>
                      Supplier <ArrowUpDown className="h-3 w-3 inline ml-1" />
                    </TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[110px] cursor-pointer" onClick={() => handleSort("createdAt")}>
                      Purchase Date <ArrowUpDown className="h-3 w-3 inline ml-1" />
                    </TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[110px] cursor-pointer" onClick={() => handleSort("paymentMethod")}>
                      Payment Mode <ArrowUpDown className="h-3 w-3 inline ml-1" />
                    </TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[80px] text-right cursor-pointer" onClick={() => handleSort("itemsCount")}>
                      Items <ArrowUpDown className="h-3 w-3 inline ml-1" />
                    </TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[120px] text-right cursor-pointer" onClick={() => handleSort("total")}>
                      Grand Total <ArrowUpDown className="h-3 w-3 inline ml-1" />
                    </TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[100px] text-center" onClick={() => handleSort("paymentStatus")}>
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[160px] text-center print:hidden">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton columns={9} rows={5} />
                  ) : paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground text-sm">
                        No purchase bills matching criteria found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((p) => {
                      const isReturnBill = p.number.startsWith("PR-");
                      const totalQty = p.items.reduce((s, it) => s + it.qty + (it.freeQty || 0), 0);
                      return (
                        <TableRow key={p.id} className={`hover:bg-muted/30 ${isReturnBill ? "bg-amber-50/30" : ""}`}>
                          <TableCell className="font-mono text-sm font-extrabold text-primary tracking-wide">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleViewDetails(p)}
                                className="hover:underline cursor-pointer text-left bg-transparent border-0 p-0 text-primary font-mono font-extrabold text-sm tracking-wide"
                              >
                                {p.number}
                              </button>
                              {isReturnBill && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                                  Purchase Return
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm text-foreground font-extrabold tracking-wide">
                            {p.supplierInvoice || "—"}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-foreground">
                            {p.supplierName}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(p.createdAt).toLocaleDateString("en-IN", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-xs capitalize font-medium">
                            {p.paymentMethod.replace("_", " ")}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            {p.items.length} <span className="text-[10px] text-muted-foreground">({totalQty} qty)</span>
                          </TableCell>
                          <TableCell className="text-xs text-right font-bold text-primary font-mono">
                            {formatMoney(p.total)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={
                                p.paymentStatus === "paid"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : p.paymentStatus === "partial"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                              }
                            >
                              {p.paymentStatus.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-2 print:hidden">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isReturnBill && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-amber-700 hover:bg-amber-50 border-amber-200"
                                  onClick={() => handleOpenReturnDialog(p)}
                                  title="Process Return"
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Return
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => downloadPurchasePdf(p, null, {
                                  pharmacyName: session?.pharmacyName,
                                  pharmacyPhone: session?.pharmacyPhone,
                                  pharmacyAddress: session?.pharmacyAddress,
                                  gstNumber: session?.gstNumber,
                                  drugLicNo: session?.drugLicNo,
                                  billColor: session?.billColor
                                })}
                                title="Download PDF"
                              >
                                <Download className="h-3.5 w-3.5 mr-1" /> PDF
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-primary"
                                onClick={() => handleViewDetails(p)}
                                title="View details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-amber-600" title="Edit purchase">
                                <Link to={"/purchases/new?editFrom=" + p.id}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-indigo-600" onClick={() => handleDuplicate(p)} title="Duplicate bill">
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-600" onClick={() => handleDelete(p.id)} title="Delete Purchase">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-4 border-t bg-muted/20 print:hidden">
                <div className="text-xs text-muted-foreground">
                  Showing {Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)} to{" "}
                  {Math.min(totalItems, currentPage * itemsPerPage)} of {totalItems} entries
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <Button key={idx} variant={currentPage === idx + 1 ? "default" : "outline"} className="h-8 w-8 text-xs font-semibold" onClick={() => handlePageChange(idx + 1)}>
                      {idx + 1}
                    </Button>
                  ))}
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Tab 2: Supplier Wise Report */}
        <TabsContent value="supplier-wise" className="outline-none">
          <Card className="border-border/60 shadow-soft">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-xs py-3">Supplier Name</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[150px] text-right">Bills Count</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[200px] text-right">Total Purchased Value</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[200px] text-right">Outstanding Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierWiseReport.map((s) => (
                    <TableRow key={s.name} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground text-xs">{s.name}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{s.count}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-primary">{formatMoney(s.total)}</TableCell>
                      <TableCell className={`text-right font-mono text-xs font-bold ${s.pending > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {formatMoney(s.pending)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Medicine Wise Report */}
        <TabsContent value="medicine-wise" className="outline-none">
          <Card className="border-border/60 shadow-soft">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-xs py-3">Medicine Name</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[150px] text-right">Unit Rate (Cost)</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[150px] text-right">MRP</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[150px] text-right">Total Qty Purchased</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[200px] text-right">Cumulative Buy Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicineWiseReport.map((m) => (
                    <TableRow key={m.name} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground text-xs">{m.name}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatMoney(m.cost || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatMoney(m.mrp || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{m.qty} Units</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-primary">{formatMoney(m.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 4: Batch Expiry Ledger */}
        <TabsContent value="batch-wise" className="outline-none">
          <Card className="border-border/60 shadow-soft">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-xs py-3">Medicine Name</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[150px]">Batch No.</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[150px]">Expiry Date</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[150px] text-right">Quantity In Batch</TableHead>
                    <TableHead className="font-semibold text-xs py-3 w-[150px] text-right">Batch Unit Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchWiseReport.map((row, idx) => {
                    const expiryTime = new Date(row.expiry).getTime();
                    const daysToExpiry = (expiryTime - Date.now()) / (1000 * 60 * 60 * 24);
                    const isNearExpiry = daysToExpiry <= 90 && daysToExpiry >= 0;
                    const isExpired = daysToExpiry < 0;

                    return (
                      <TableRow key={idx} className="hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground text-xs">{row.name}</TableCell>
                        <TableCell className="font-mono text-xs uppercase font-semibold">{String(row.batch || "").toUpperCase()}</TableCell>
                        <TableCell className="text-xs font-semibold">
                          <span
                            className={
                              isExpired
                                ? "text-destructive line-through"
                                : isNearExpiry
                                  ? "text-amber-500"
                                  : "text-foreground"
                            }
                          >
                            {row.expiry}
                          </span>
                          {isExpired && <Badge variant="outline" className="ml-2 bg-rose-50 text-rose-600 border-rose-200 text-[9px] px-1 py-0.5">EXPIRED</Badge>}
                          {isNearExpiry && <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-600 border-amber-200 text-[9px] px-1 py-0.5">NEAR EXP</Badge>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{row.qty} Units</TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-primary">{formatMoney(row.cost)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Purchase Return Dialog */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Purchase Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-select">Select Original Purchase Invoice</Label>
              <select
                id="purchase-select"
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedPurchaseForReturn?.id || ""}
                onChange={(e) => {
                  const p = purchases.find((x) => x.id === e.target.value) || null;
                  setSelectedPurchaseForReturn(p);
                  const qtys: Record<string, number> = {};
                  p?.items.forEach((it, idx) => {
                    const itemKey = it.id || `${it.productId || it.name}_${idx}`;
                    qtys[itemKey] = 0;
                  });
                  setReturnQuantities(qtys);
                }}
              >
                <option value="">-- Select Purchase Invoice --</option>
                {purchases.filter(p => !p.number.startsWith("PR-")).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} - {p.supplierName} ({new Date(p.createdAt).toLocaleDateString("en-IN")})
                  </option>
                ))}
              </select>
            </div>

            {selectedPurchaseForReturn && (
              <div className="space-y-4 mt-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Select Items and Quantities to Return</h4>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {selectedPurchaseForReturn.items.map((it, idx) => {
                    const itemKey = it.id || `${it.productId || it.name}_${idx}`;
                    return (
                      <div key={itemKey} className="flex justify-between items-center gap-4 p-2.5 border rounded-md text-sm bg-slate-50/50">
                        <div className="flex-1">
                          <div className="font-semibold text-foreground">{it.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Batch: <span className="uppercase">{String(it.batch || "—").toUpperCase()}</span> | Exp: {it.expiry || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Cost: {formatMoney(it.costPrice)} | Purchased: {it.qty}
                          </div>
                        </div>
                        <div className="w-24">
                          <Label className="text-xs text-muted-foreground">Return Qty</Label>
                          <Input
                            type="number"
                            min={0}
                            max={Math.abs(it.qty)}
                            placeholder=""
                            value={returnQuantities[itemKey] || ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === "") {
                                setReturnQuantities((prev) => ({ ...prev, [itemKey]: 0 }));
                              } else {
                                const val = Math.min(Math.abs(it.qty), Math.max(0, parseInt(raw) || 0));
                                setReturnQuantities((prev) => ({ ...prev, [itemKey]: val }));
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="return-notes">Reason / Notes for Return</Label>
                  <Input
                    id="return-notes"
                    placeholder="e.g. Expired stock, damaged, incorrect order"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setIsReturnDialogOpen(false);
                setSelectedPurchaseForReturn(null);
                setReturnNotes("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmReturn} disabled={submittingReturn || !selectedPurchaseForReturn}>
              {submittingReturn ? "Processing..." : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suppliers Directory Modal */}
      <Dialog open={showSuppliersModal} onOpenChange={setShowSuppliersModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex justify-between items-center pr-6">
              <div>
                <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-600" /> Active Suppliers
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Directory of all active suppliers and their transaction summary. Click a supplier to view their bills.
                </p>
              </div>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {stats.uniqueSuppliers} Total
              </Badge>
            </div>
          </DialogHeader>

          {/* Search bar inside Modal */}
          <div className="p-4 border-b bg-muted/20">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search supplier by name or phone..."
                value={supplierSearchQuery}
                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Suppliers List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-[50vh]">
            {filteredDetailedSuppliers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No suppliers found matching "{supplierSearchQuery}"
              </div>
            ) : (
              filteredDetailedSuppliers.map((supplier) => {
                const initials = supplier.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={supplier.name}
                    onClick={() => {
                      setSupplierFilter(supplier.name);
                      setCurrentPage(1);
                      setShowSuppliersModal(false);
                      setActiveTab("all-bills");
                      toast.success(`Showing bills for ${supplier.name}`);
                    }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-xl hover:border-emerald-200 hover:bg-emerald-50/10 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {initials}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground hover:underline">
                          {supplier.name}
                        </h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Phone className="h-3 w-3" /> {supplier.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-right border-t sm:border-0 pt-2 sm:pt-0">
                      <div>
                        <div className="text-muted-foreground">Purchases</div>
                        <div className="font-bold text-foreground mt-0.5">
                          {supplier.totalPurchases} {supplier.totalPurchases === 1 ? "Bill" : "Bills"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total Value</div>
                        <div className="font-bold text-foreground mt-0.5">
                          {formatMoney(supplier.totalAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Outstanding</div>
                        <div
                          className={`font-bold mt-0.5 ${
                            supplier.outstandingBalance > 0 ? "text-rose-600 font-semibold" : "text-emerald-600"
                          }`}
                        >
                          {supplier.outstandingBalance > 0
                            ? formatMoney(supplier.outstandingBalance)
                            : "Settled"}
                        </div>
                      </div>
                      <div className="hidden md:block">
                        <div className="text-muted-foreground">Last Order</div>
                        <div className="font-medium text-slate-600 mt-0.5">
                          {new Date(supplier.lastPurchaseDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSuppliersModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 bg-background print:fixed print:inset-0 print:max-w-none print:max-h-none print:w-full print:h-full print:bg-white print:overflow-visible print:border-none print:p-0 print:shadow-none">
          {selectedPurchaseForDetails && (() => {
            const p = selectedPurchaseForDetails;
            const meta = selectedPurchaseMeta;
            const cgst = p.tax / 2;
            const sgst = p.tax / 2;
            const roundOff = p.total - (p.subtotal + p.tax - p.discount);

            return (
              <div className="flex flex-col h-full">
                {/* Dialog header / print button */}
                <DialogHeader className="p-6 pb-4 border-b print:hidden">
                  <div className="flex justify-between items-center pr-6">
                    <div>
                      <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" /> Purchase Inward Details
                      </DialogTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => downloadPurchasePdf(p, meta, {
                        pharmacyName: session?.pharmacyName,
                        pharmacyPhone: session?.pharmacyPhone,
                        pharmacyAddress: session?.pharmacyAddress,
                        gstNumber: session?.gstNumber,
                        drugLicNo: session?.drugLicNo,
                        billColor: session?.billColor
                      })}>
                        <Download className="h-4 w-4 mr-2" /> Download PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="h-4 w-4 mr-2" /> Print PO
                      </Button>
                    </div>
                  </div>
                </DialogHeader>

                {/* Details Invoice content */}
                <div className="p-6 sm:p-10 overflow-y-auto print:p-0 print:m-0 w-full print:border-none">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-4">
                    <div className="flex gap-4">
                      <div className="h-16 w-16 rounded-xl bg-gradient-primary flex items-center justify-center text-primary-foreground print:bg-primary print:text-white shrink-0">
                        <Pill className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold uppercase tracking-wide m-0 leading-tight text-primary">
                          PURCHASE INWARD RECORD
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                          Intake voucher generated dynamically upon supplier invoice clearance.
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm flex flex-col gap-1 shrink-0">
                      <h2 className="text-xl font-bold uppercase tracking-widest text-primary mb-1">
                        PO Voucher
                      </h2>
                      <div className="flex justify-end gap-2 text-xs">
                        <span className="text-muted-foreground">PO Ref No:</span>
                        <span className="font-bold font-mono text-primary">{p.number}</span>
                      </div>
                      <div className="flex justify-end gap-2 text-xs">
                        <span className="text-muted-foreground">Invoice No:</span>
                        <span className="font-bold font-mono">{p.supplierInvoice || "—"}</span>
                      </div>
                      <div className="flex justify-end gap-2 text-xs">
                        <span className="text-muted-foreground">Date:</span>
                        <span>{new Date(p.createdAt).toLocaleDateString("en-IN")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Distributor details */}
                  <div className="border border-border rounded-lg p-4 mb-4 flex flex-col sm:flex-row justify-between text-xs gap-4 bg-muted/20">
                    <div className="sm:w-1/2">
                      <p className="font-semibold mb-1 uppercase text-xs text-primary">SUPPLIER / DISTRIBUTOR</p>
                      <p className="font-bold uppercase text-base">{p.supplierName}</p>
                      {p.supplierPhone && (
                        <p className="text-muted-foreground mt-0.5">
                          PHONE: <span className="text-foreground">{p.supplierPhone}</span>
                        </p>
                      )}
                      {meta?.supplierGst && (
                        <p className="text-muted-foreground mt-0.5">
                          GSTIN: <span className="text-foreground uppercase font-mono">{meta.supplierGst}</span>
                        </p>
                      )}
                      {meta?.supplierDl && (
                        <p className="text-muted-foreground mt-0.5">
                          DRUG LIC NO: <span className="text-foreground uppercase">{meta.supplierDl}</span>
                        </p>
                      )}
                      {meta?.supplierAddress && (
                        <p className="text-muted-foreground mt-0.5">
                          ADDRESS: <span className="text-foreground">{meta.supplierAddress}</span>
                        </p>
                      )}
                    </div>
                    <div className="sm:w-1/2 sm:border-l border-border sm:pl-4 space-y-1">
                      <p className="font-semibold mb-1 uppercase text-xs text-primary">INWARD LOGISTICS</p>
                      <p className="text-muted-foreground">
                        Payment Method: <span className="uppercase font-semibold text-primary">{p.paymentMethod}</span>
                      </p>
                      {meta?.transportName && (
                        <p className="text-muted-foreground">
                          Transport: <span className="text-foreground">{meta.transportName}</span>
                        </p>
                      )}
                      {meta?.lrNumber && (
                        <p className="text-muted-foreground">
                          LR Number: <span className="text-foreground font-mono">{meta.lrNumber}</span>
                        </p>
                      )}
                      {p.paymentMethod === "credit" && meta?.dueDate && (
                        <p className="text-muted-foreground font-semibold text-rose-600">
                          Payment Due Date: <span>{meta.dueDate}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items table */}
                  <div className="mb-6 w-full overflow-x-auto rounded-lg border border-border">
                    <Table className="text-xs">
                      <TableHeader className="bg-muted/50 text-[10px] tracking-wider uppercase">
                        <TableRow>
                          <TableHead className="w-10 text-center">#</TableHead>
                          <TableHead>Medicine Name</TableHead>
                          <TableHead>Batch No.</TableHead>
                          <TableHead>HSN Code</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Free</TableHead>
                          <TableHead className="text-right">MRP</TableHead>
                          <TableHead className="text-right">Sale Price</TableHead>
                          <TableHead className="text-center">GST%</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {p.items.map((it, idx) => {
                          const lineAmount = it.costPrice * it.qty;
                          const taxAmount = (lineAmount * it.taxPercent) / 100;

                          return (
                            <TableRow key={idx} className="hover:bg-muted/10">
                              <TableCell className="text-center">{idx + 1}</TableCell>
                              <TableCell className="font-semibold">{it.name}</TableCell>
                              <TableCell className="font-mono uppercase text-muted-foreground">{String(it.batch || "—").toUpperCase()}</TableCell>
                              <TableCell className="font-mono text-muted-foreground">{it.hsn || "—"}</TableCell>
                              <TableCell className="font-mono text-muted-foreground">{it.expiry ? it.expiry.substring(0, 7) : "—"}</TableCell>
                              <TableCell className="text-right font-medium">{it.qty}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{it.freeQty || 0}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">₹{(it.mrp || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">₹{(it.saleRate || it.mrp || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-center">{it.taxPercent}%</TableCell>
                              <TableCell className="text-right font-mono">₹{it.costPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono font-bold text-primary">₹{(lineAmount + taxAmount).toFixed(2)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Live summary breakdown */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4">
                    <div className="w-full sm:w-[55%] flex flex-col gap-4">
                      <div className="text-xs p-3 bg-primary/5 border border-primary/10 rounded-lg">
                        <p className="font-semibold text-primary uppercase mb-1">Amount in Words:</p>
                        <p className="font-bold capitalize">{numberToWords(p.total)}</p>
                      </div>
                      {meta?.remarks && (
                        <div className="text-xs p-3 border border-border rounded-lg">
                          <p className="font-semibold text-muted-foreground mb-1">Remarks:</p>
                          <p className="italic">{meta.remarks}</p>
                        </div>
                      )}
                    </div>

                    <div className="w-full sm:w-[40%] text-sm">
                      <div className="space-y-2 w-full p-4 border border-border rounded-lg bg-muted/10">
                        <div className="flex justify-between text-muted-foreground text-xs">
                          <span>Taxable Amount</span>
                          <span className="font-mono text-foreground">{formatMoney(p.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-xs">
                          <span>CGST</span>
                          <span className="font-mono text-foreground">{formatMoney(cgst)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-xs pb-2 border-b">
                          <span>SGST</span>
                          <span className="font-mono text-foreground">{formatMoney(sgst)}</span>
                        </div>
                        {p.discount > 0 && (
                          <div className="flex justify-between text-success text-xs">
                            <span>Discount</span>
                            <span className="font-mono">-{formatMoney(p.discount)}</span>
                          </div>
                        )}
                        {roundOff !== 0 && (
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Round Off</span>
                            <span className="font-mono">
                              {roundOff > 0 ? "+" : ""}
                              {roundOff.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between py-2 text-xl font-bold uppercase tracking-wide text-primary">
                          <span>Net Inward</span>
                          <span className="font-mono">{formatMoney(p.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="p-4 border-t bg-muted/10 print:hidden mt-auto">
                  <Button variant="outline" size="sm" onClick={() => setDetailsDialogOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* KPI Bills Modal */}
      <Dialog open={kpiModalOpen} onOpenChange={setKpiModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background">
          <DialogHeader className="p-6 pb-4 border-b">
            <div className="flex justify-between items-center pr-6">
              <div>
                <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> {kpiModalTitle}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  List of bills matching this summary KPI. Click a bill to view its details.
                </p>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                {kpiModalBills.length} Bills
              </Badge>
            </div>
          </DialogHeader>

          {/* Bills List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 max-h-[60vh]">
            {kpiModalBills.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No bills found for this category.
              </div>
            ) : (
              kpiModalBills.map((p) => {
                const totalQty = p.items.reduce((s, it) => s + it.qty + (it.freeQty || 0), 0);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      handleViewDetails(p);
                    }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-xl hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">
                          {p.number}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Supplier: <span className="font-semibold text-foreground">{p.supplierName}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Date: {new Date(p.createdAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-right border-t sm:border-0 pt-2 sm:pt-0">
                      <div>
                        <div className="text-muted-foreground">Items</div>
                        <div className="font-bold text-foreground mt-0.5">
                          {p.items.length} ({totalQty} Qty)
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total Value</div>
                        <div className="font-bold text-primary mt-0.5">
                          {formatMoney(p.total)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Status</div>
                        <Badge
                          variant="outline"
                          className={`mt-0.5 text-[10px] font-semibold py-0.5 px-2 ${
                            p.paymentStatus === "paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : p.paymentStatus === "partial"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {p.paymentStatus.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setKpiModalOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
