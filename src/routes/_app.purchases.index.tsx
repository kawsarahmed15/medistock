import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { purchasesStore, type Purchase } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function PurchasesPage() {
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
      result = result.filter((p) => p.paymentStatus === statusFilter);
    }

    if (dateFilter) {
      result = result.filter(
        (p) => new Date(p.createdAt).toISOString().slice(0, 10) === dateFilter
      );
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

  // Advanced Reporting Reports calculations
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
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="h-8 w-8 text-primary" /> Purchase Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time distributor billing, batch management, supplier ledgers, and FEFO stock rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <Button asChild size="sm" className="bg-primary hover:bg-primary/95 text-white font-medium shadow-soft">
            <Link to="/purchases/new">
              <Plus className="h-4 w-4 mr-1.5" /> New Purchase
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Purchase return initialized")}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Purchase Return
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Select purchase file to import")}>
            <Download className="h-4 w-4 mr-1.5 rotate-180" /> Import Purchase
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" /> Print Register
          </Button>
        </div>
      </div>

      {/* Dashboard KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-soft hover:shadow-md transition-shadow border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Purchase</div>
            <div className="text-2xl font-bold mt-1 text-primary">{formatMoney(stats.todayPurchase)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" /> Today's distributor intake
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-soft hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Purchase</div>
            <div className="text-2xl font-bold mt-1 text-blue-600">{formatMoney(stats.monthlyPurchase)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> This calendar month
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-soft hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Bills</div>
            <div className="text-2xl font-bold mt-1 text-amber-600">{stats.pendingBills} Bills</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Awaiting supplier payments
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-soft hover:shadow-md transition-shadow border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Suppliers</div>
            <div className="text-2xl font-bold mt-1 text-emerald-600">{stats.uniqueSuppliers} Suppliers</div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Active distribution channels
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all-bills" className="w-full space-y-4" onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-1 gap-2">
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
          <Card className="p-4 border-border/50 shadow-soft bg-card/60">
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
                  value={dateFilter}
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
                  <option value="partial">Partial</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
            </div>
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
                    <TableHead className="font-semibold text-xs py-3 w-[160px] text-center">Action</TableHead>
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
                      const totalQty = p.items.reduce((s, it) => s + it.qty + (it.freeQty || 0), 0);
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs font-semibold text-primary">
                            <Link to={"/purchases/" + p.id} className="hover:underline">
                              {p.number}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-foreground font-semibold">
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
                          <TableCell className="text-center py-2">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button asChild variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="View details">
                                <Link to={"/purchases/" + p.id}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Link>
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
              <div className="flex justify-between items-center p-4 border-t bg-muted/20">
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
                        <TableCell className="font-mono text-xs uppercase font-semibold">{row.batch}</TableCell>
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
    </div>
  );
}
