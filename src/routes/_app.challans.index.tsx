import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Printer,
  FileCheck2,
  XCircle,
  ExternalLink,
  Calendar,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  Lock,
  X,
  CreditCard,
  Banknote,
  Smartphone,
} from "lucide-react";
import { challansStore, type SaleChallan, type SaleChallanDashboardMetrics, type SaleChallanStatus } from "@/lib/storage";
import { downloadChallanPdf } from "@/lib/challan-pdf";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FilterRange = "all" | "today" | "month" | "custom";
type ChallansSearch = {
  status?: string;
  range?: FilterRange;
  from?: string;
  to?: string;
  q?: string;
};

export const Route = createFileRoute("/_app/challans/")({
  validateSearch: (search: Record<string, unknown>): ChallansSearch => {
    return {
      status: typeof search.status === "string" ? search.status : undefined,
      range: typeof search.range === "string" ? (search.range as FilterRange) : undefined,
      from: typeof search.from === "string" ? search.from : undefined,
      to: typeof search.to === "string" ? search.to : undefined,
      q: typeof search.q === "string" ? search.q : undefined,
    };
  },
  component: SaleChallansDashboardPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const mon = String(d.getMonth() + 1).padStart(2, "0");
    const yr = d.getFullYear();
    return `${day}/${mon}/${yr}`;
  } catch {
    return dateStr;
  }
}

function SaleChallansDashboardPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [challans, setChallans] = useState<SaleChallan[]>([]);
  const [metrics, setMetrics] = useState<SaleChallanDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>(search.status || "all");
  const [rangeFilter, setRangeFilter] = useState<FilterRange>(search.range || "all");
  const [searchQuery, setSearchQuery] = useState<string>(search.q || "");
  const [customFrom, setCustomFrom] = useState<string>(search.from || "");
  const [customTo, setCustomTo] = useState<string>(search.to || "");

  // Generate Bill Modal state
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [selectedChallanForBill, setSelectedChallanForBill] = useState<SaleChallan | null>(null);
  const [billPaymentMethod, setBillPaymentMethod] = useState<"cash" | "online" | "credit">("cash");
  const [billAdvanceAmount, setBillAdvanceAmount] = useState<string>("0");
  const [billNotes, setBillNotes] = useState<string>("");
  const [billingLoading, setBillingLoading] = useState(false);

  // Cancel Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedChallanForCancel, setSelectedChallanForCancel] = useState<SaleChallan | null>(null);
  const [cancellingLoading, setCancellingLoading] = useState(false);

  // Load Metrics & List
  const loadData = async () => {
    try {
      setLoading(true);
      const metricsData = await challansStore.getDashboardMetrics();
      setMetrics(metricsData);

      let fromDate: string | undefined = undefined;
      let toDate: string | undefined = undefined;

      const todayStr = new Date().toISOString().slice(0, 10);
      if (rangeFilter === "today") {
        fromDate = todayStr;
        toDate = todayStr;
      } else if (rangeFilter === "month") {
        const d = new Date();
        const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        fromDate = startOfMonth;
        toDate = todayStr;
      } else if (rangeFilter === "custom") {
        fromDate = customFrom || undefined;
        toDate = customTo || undefined;
      }

      const listData = await challansStore.list({
        status: statusFilter,
        from: fromDate,
        to: toDate,
        q: searchQuery,
      });

      setChallans(listData);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load Sale Challans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, rangeFilter, customFrom, customTo]);

  // Handle search debounce
  useEffect(() => {
    const t = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Handle Generate Bill click
  const handleOpenGenerateBill = async (c: SaleChallan) => {
    try {
      const full = await challansStore.get(c.id);
      setSelectedChallanForBill(full);
      setBillPaymentMethod("cash");
      setBillAdvanceAmount("0");
      setBillNotes(`Billed from Challan ${full.challanNumber}`);
      setBillModalOpen(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load challan details for billing");
    }
  };

  const handleConfirmGenerateBill = async () => {
    if (!selectedChallanForBill) return;
    try {
      setBillingLoading(true);
      const res = await challansStore.generateBill(selectedChallanForBill.id, {
        paymentMethod: billPaymentMethod,
        advanceAmount: Number(billAdvanceAmount) || 0,
        notes: billNotes,
      });

      toast.success(
        `Sales Bill ${res.invoiceNumber} generated! Actual stock deducted & stock reservation released.`,
        {
          action: {
            label: "View Bill",
            onClick: () => navigate({ to: `/bills/${res.billId}` }),
          },
        }
      );

      setBillModalOpen(false);
      setSelectedChallanForBill(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate sales bill");
    } finally {
      setBillingLoading(false);
    }
  };

  // Handle Cancel Challan
  const handleOpenCancel = (c: SaleChallan) => {
    setSelectedChallanForCancel(c);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedChallanForCancel) return;
    try {
      setCancellingLoading(true);
      await challansStore.cancel(selectedChallanForCancel.id);
      toast.success(`Challan ${selectedChallanForCancel.challanNumber} cancelled. Reserved stock released.`);
      setCancelModalOpen(false);
      setSelectedChallanForCancel(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel challan");
    } finally {
      setCancellingLoading(false);
    }
  };

  // Handle Print PDF
  const handlePrint = async (c: SaleChallan) => {
    try {
      toast.info(`Preparing print for Challan ${c.challanNumber}...`);
      const full = await challansStore.get(c.id);
      await downloadChallanPdf(full);
      toast.success(`PDF downloaded for Challan ${c.challanNumber}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate Challan PDF");
    }
  };

  const getStatusBadge = (status: SaleChallanStatus) => {
    switch (status) {
      case "issued":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold">
            <Lock className="w-3 h-3" />
            Issued (Reserved)
          </Badge>
        );
      case "partially_billed":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold">
            <Clock className="w-3 h-3" />
            Partially Billed
          </Badge>
        );
      case "billed":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            Billed
          </Badge>
        );
      case "draft":
        return (
          <Badge className="bg-neutral-500/15 text-neutral-700 dark:text-neutral-400 border-neutral-500/30 gap-1">
            Draft
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Sale Challan
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Delivery Register
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Temporary delivery dispatch with live stock reservation. Deducts actual inventory upon final billing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate({ to: "/challans/new" })}
            className="h-9 gap-1.5 font-bold shadow-soft"
          >
            <Plus className="h-4 w-4" />
            Create Sale Challan
          </Button>
        </div>
      </div>

      {/* ── Section 6: Sale Challan Dashboard Metrics (7 Cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <Card className="p-3 bg-card/80 backdrop-blur-xs border shadow-xs hover:border-primary/40 transition-colors">
          <div className="text-[11px] font-medium text-muted-foreground">Total Challans</div>
          <div className="text-xl font-bold mt-1 text-foreground">{metrics?.totalChallans ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">All time records</div>
        </Card>

        <Card className="p-3 bg-card/80 backdrop-blur-xs border shadow-xs hover:border-primary/40 transition-colors">
          <div className="text-[11px] font-medium text-muted-foreground">Today's Challans</div>
          <div className="text-xl font-bold mt-1 text-primary">{metrics?.todayChallans ?? "—"}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Dispatched today</div>
        </Card>

        <Card className="p-3 bg-card/80 backdrop-blur-xs border shadow-xs hover:border-primary/40 transition-colors">
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Pending Challans
          </div>
          <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {metrics?.pendingChallans ?? "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Issued & reserved</div>
        </Card>

        <Card className="p-3 bg-card/80 backdrop-blur-xs border shadow-xs hover:border-primary/40 transition-colors">
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Partially Billed</div>
          <div className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {metrics?.partiallyBilledChallans ?? "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Partial balance left</div>
        </Card>

        <Card className="p-3 bg-card/80 backdrop-blur-xs border shadow-xs hover:border-primary/40 transition-colors">
          <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400">Fully Billed</div>
          <div className="text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">
            {metrics?.fullyBilledChallans ?? "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Converted to bill</div>
        </Card>

        <Card className="p-3 bg-card/80 backdrop-blur-xs border shadow-xs hover:border-primary/40 transition-colors">
          <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Cancelled</div>
          <div className="text-xl font-bold mt-1 text-rose-600 dark:text-rose-400">
            {metrics?.cancelledChallans ?? "—"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Stock released</div>
        </Card>

        <Card className="p-3 bg-primary/5 border border-primary/20 shadow-xs">
          <div className="text-[11px] font-medium text-primary">Reserved Stock Value</div>
          <div className="text-lg font-bold mt-1 text-primary truncate">
            {formatMoney(metrics?.totalReservedStockValue ?? 0)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Locked in delivery</div>
        </Card>
      </div>

      {/* ── Filters & Search ── */}
      <Card className="p-3 bg-card/80 backdrop-blur-xs border shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <Tabs
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val)}
            className="w-full md:w-auto"
          >
            <TabsList className="h-9 p-1 bg-muted/60">
              <TabsTrigger value="all" className="text-xs px-2.5">All</TabsTrigger>
              <TabsTrigger value="issued" className="text-xs px-2.5">Issued (Reserved)</TabsTrigger>
              <TabsTrigger value="partially_billed" className="text-xs px-2.5">Partially Billed</TabsTrigger>
              <TabsTrigger value="billed" className="text-xs px-2.5">Fully Billed</TabsTrigger>
              <TabsTrigger value="draft" className="text-xs px-2.5">Draft</TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs px-2.5">Cancelled</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Date range & search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-background px-2.5 h-9">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground mr-1.5" />
              <select
                value={rangeFilter}
                onChange={(e) => setRangeFilter(e.target.value as FilterRange)}
                className="bg-transparent text-xs outline-none cursor-pointer pr-1"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {rangeFilter === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 w-32 text-xs"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 w-32 text-xs"
                />
              </div>
            )}

            <div className="relative min-w-[200px] flex-1 md:w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search challan #, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Challans Table ── */}
      <Card className="border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-32 text-xs font-bold">Challan #</TableHead>
                <TableHead className="w-24 text-xs font-bold">Date</TableHead>
                <TableHead className="text-xs font-bold">Customer Details</TableHead>
                <TableHead className="text-xs font-bold text-center">Items</TableHead>
                <TableHead className="text-xs font-bold text-right">Challan Total</TableHead>
                <TableHead className="text-xs font-bold text-center">Status</TableHead>
                <TableHead className="text-xs font-bold">Linked Invoice</TableHead>
                <TableHead className="text-xs font-bold text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-xs text-muted-foreground">
                    Loading Sale Challans...
                  </TableCell>
                </TableRow>
              ) : challans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                      <ClipboardList className="w-8 h-8 opacity-40" />
                      <div className="text-sm font-semibold">No Sale Challans Found</div>
                      <div className="text-xs">
                        Create a temporary delivery challan to reserve product inventory and give customers a printed dispatch slip.
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate({ to: "/challans/new" })}
                        className="mt-2 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Create First Challan
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                challans.map((c) => {
                  const canEdit = c.status === "draft" || (c.status === "issued" && c.itemCount > 0);
                  const canGenerateBill = c.status === "issued" || c.status === "partially_billed";
                  const canCancel = c.status !== "billed" && c.status !== "cancelled";

                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                      {/* Challan Number */}
                      <TableCell className="font-mono font-bold text-xs">
                        <Link
                          to="/challans/$id"
                          params={{ id: c.id }}
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {c.challanNumber}
                        </Link>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(c.challanDate)}
                      </TableCell>

                      {/* Customer Details */}
                      <TableCell className="text-xs">
                        <div className="font-semibold text-foreground">
                          {c.customerName || "Counter Customer"}
                        </div>
                        {c.customerPhone && (
                          <div className="text-[11px] text-muted-foreground">
                            {c.customerPhone}
                          </div>
                        )}
                        {c.customerGstin && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            GSTIN: {c.customerGstin}
                          </div>
                        )}
                      </TableCell>

                      {/* Items */}
                      <TableCell className="text-xs text-center">
                        <span className="font-bold">{c.itemCount}</span> items
                      </TableCell>

                      {/* Total */}
                      <TableCell className="text-xs text-right font-bold tabular-nums">
                        {formatMoney(c.total)}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {getStatusBadge(c.status)}
                      </TableCell>

                      {/* Linked Invoices */}
                      <TableCell className="text-xs">
                        {c.linkedInvoices && c.linkedInvoices.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {c.linkedInvoices.map((inv) => (
                              <Link
                                key={inv.billId}
                                to="/bills/$id"
                                params={{ id: inv.billId }}
                                className="inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                              >
                                <Receipt className="w-3 h-3" />
                                {inv.invoiceNumber}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="View Challan Details"
                            onClick={() => navigate({ to: `/challans/${c.id}` })}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Print */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Print A4 Delivery Challan"
                            onClick={() => handlePrint(c)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>

                          {/* Edit */}
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Edit Challan"
                              onClick={() => navigate({ to: `/challans/new`, search: { editId: c.id } as any })}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Generate Bill */}
                          {canGenerateBill && (
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 text-xs font-semibold gap-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                              title="Convert to Final Sales Bill"
                              onClick={() => handleOpenGenerateBill(c)}
                            >
                              <FileCheck2 className="h-3.5 w-3.5" />
                              Generate Bill
                            </Button>
                          )}

                          {/* Cancel */}
                          {canCancel && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title="Cancel Challan & Release Stock"
                              onClick={() => handleOpenCancel(c)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── Generate Bill Modal ── */}
      <Dialog open={billModalOpen} onOpenChange={setBillModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <FileCheck2 className="w-5 h-5" />
              Convert Sale Challan into Final Sales Bill
            </DialogTitle>
            <DialogDescription>
              Generating the final invoice will deduct the physical inventory from stock and release the reserved quantity atomically.
            </DialogDescription>
          </DialogHeader>

          {selectedChallanForBill && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 p-3 rounded-lg border text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Challan:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedChallanForBill.challanNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold text-foreground">
                    {selectedChallanForBill.customerName || "Counter Customer"}
                  </span>
                </div>
                {selectedChallanForBill.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mobile:</span>
                    <span>{selectedChallanForBill.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bill Value:</span>
                  <span className="font-bold text-primary text-sm">
                    {formatMoney(selectedChallanForBill.total)}
                  </span>
                </div>
              </div>

              {/* Items Summary */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Products to Bill ({selectedChallanForBill.items.length})</Label>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1.5 text-xs bg-card">
                  {selectedChallanForBill.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b last:border-0">
                      <div>
                        <div className="font-medium text-foreground">{it.productName}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Batch: {it.batchNo || "DEFAULT"} | Rate: ₹{Number(it.rate).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">
                          {it.qty} {it.freeQty > 0 ? `+ ${it.freeQty} Free` : ""}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          ₹{Number(it.amount).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Permitted Billing Options */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Method</Label>
                  <select
                    value={billPaymentMethod}
                    onChange={(e) => setBillPaymentMethod(e.target.value as any)}
                    className="w-full h-9 rounded-md border bg-background px-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="cash">Cash</option>
                    <option value="online">Online / UPI</option>
                    <option value="credit">Credit (Khata)</option>
                  </select>
                </div>

                {billPaymentMethod === "credit" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Advance Paid (₹)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={billAdvanceAmount}
                      onChange={(e) => setBillAdvanceAmount(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Invoice Notes / Remarks</Label>
                <Input
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="Optional billing note..."
                  className="h-9 text-xs"
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>Stock Rule:</strong> Confirming this bill will deduct the physical strips from actual inventory and cancel the stock reservation. Stock is only deducted once.
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBillModalOpen(false)}
              disabled={billingLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmGenerateBill}
              disabled={billingLoading}
              className="font-bold bg-primary hover:bg-primary/90"
            >
              {billingLoading ? "Generating Invoice..." : "Confirm & Generate Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Challan Modal ── */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Cancel Sale Challan
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel Challan{" "}
              <strong>{selectedChallanForCancel?.challanNumber}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground space-y-2">
            <p>
              Cancelling this delivery challan will <strong>automatically release all reserved stock</strong> back to the available inventory pool.
            </p>
            <p>This action cannot be undone.</p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancellingLoading}
            >
              No, Keep It
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={cancellingLoading}
              className="font-bold"
            >
              {cancellingLoading ? "Cancelling..." : "Yes, Cancel & Release Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
