import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Download,
  Eye,
  ReceiptText,
  Search,
  Smartphone,
  CreditCard,
  RotateCcw,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { billsStore, type Bill } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { downloadBillPdf } from "@/lib/bill-pdf";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/loading-skeleton";
import { cn } from "@/lib/utils";

type FilterRange = "all" | "day" | "month" | "year" | "custom";
type PayFilter = "all" | "cash" | "online" | "credit";
type StatusTab = "all" | "pending" | "completed" | "returns";
type BillsSearch = { range?: FilterRange; from?: string; to?: string; pay?: PayFilter; status?: StatusTab };

export const Route = createFileRoute("/_app/bills/")({
  validateSearch: (search: Record<string, unknown>): BillsSearch => {
    const r = search.range as string | undefined;
    const valid: FilterRange[] = ["all", "day", "month", "year", "custom"];
    const p = search.pay as string | undefined;
    const validPay: PayFilter[] = ["all", "cash", "online", "credit"];
    const s = search.status as string | undefined;
    const validStatus: StatusTab[] = ["all", "pending", "completed", "returns"];
    return {
      range: valid.includes(r as FilterRange) ? (r as FilterRange) : undefined,
      from: typeof search.from === "string" ? search.from : undefined,
      to: typeof search.to === "string" ? search.to : undefined,
      pay: validPay.includes(p as PayFilter) ? (p as PayFilter) : undefined,
      status: validStatus.includes(s as StatusTab) ? (s as StatusTab) : undefined,
    };
  },
  component: BillsPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function BillsPage() {
  const { session } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const routerNavigate = useNavigate();
  const range: FilterRange = search.range ?? "all";
  const pay: PayFilter = search.pay ?? "all";
  const statusTab: StatusTab = search.status ?? "all";
  const [focusedIdx, setFocusedIdx] = useState(0);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  // Sale Return Dialog State
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedBillForReturn, setSelectedBillForReturn] = useState<Bill | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnNotes, setReturnNotes] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const loadBills = () => {
    setLoading(true);
    billsStore
      .list()
      .then((b) => {
        setBills(b);
        setLoading(false);
      })
      .catch(() => {
        setBills([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadBills();
  }, []);

  const handleApproveBill = async (b: Bill, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setActionLoading(b.id);
    try {
      await billsStore.approve(b.id);
      toast.success(`Bill ${b.number} approved! Stock decremented and registered.`);
      loadBills();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve bill");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectBill = async (b: Bill, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!confirm(`Are you sure you want to reject bill ${b.number}?`)) return;
    setActionLoading(b.id);
    try {
      await billsStore.reject(b.id);
      toast.success(`Bill ${b.number} rejected.`);
      loadBills();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject bill");
    } finally {
      setActionLoading(null);
    }
  };

  const getItemKey = (it: { productId?: string; name: string }, idx: number) => {
    const pId = (it.productId || "").trim();
    return pId ? `${pId}_${idx}` : `${it.name.trim()}_${idx}`;
  };

  const getAlreadyReturnedQtyForBillItem = (bill: Bill, item: Bill["items"][number]) => {
    if (!bill || !item) return 0;
    const billNum = bill.number;
    const billId = bill.id;
    const returnBills = bills.filter(
      (b) => b.number.startsWith("SR-") && (
        (b.customerNotes || "").includes(billNum) ||
        (b.customerNotes || "").includes(billId)
      )
    );

    let returned = 0;
    for (const rb of returnBills) {
      for (const rItem of rb.items) {
        const p1 = (item.productId || "").trim();
        const p2 = (rItem.productId || "").trim();
        const matchProduct = (p1 && p2)
          ? p1 === p2
          : item.name.trim().toLowerCase() === rItem.name.trim().toLowerCase();

        const itemBatch = String(item.batch || "").trim().toUpperCase();
        const rItemBatch = String(rItem.batch || "").trim().toUpperCase();
        const matchBatch = !itemBatch || !rItemBatch || itemBatch === rItemBatch;

        if (matchProduct && matchBatch) {
          returned += Math.abs(rItem.qty || 0);
        }
      }
    }
    return returned;
  };

  const handleOpenReturnDialog = (billToReturn?: Bill) => {
    if (billToReturn) {
      setSelectedBillForReturn(billToReturn);
      const qtys: Record<string, number> = {};
      billToReturn.items.forEach((it, idx) => {
        const itemKey = getItemKey(it, idx);
        qtys[itemKey] = 0;
      });
      setReturnQuantities(qtys);
    } else {
      setSelectedBillForReturn(null);
      setReturnQuantities({});
    }
    setReturnNotes("");
    setIsReturnDialogOpen(true);
  };

  const handleConfirmReturn = async () => {
    if (!selectedBillForReturn) return;

    const returnedItems = selectedBillForReturn.items
      .filter((it, idx) => {
        const itemKey = getItemKey(it, idx);
        const qty = returnQuantities[itemKey] || 0;
        const alreadyReturned = getAlreadyReturnedQtyForBillItem(selectedBillForReturn, it);
        const maxReturnable = Math.max(0, it.qty - alreadyReturned);
        return qty > 0 && qty <= maxReturnable;
      })
      .map((it, idx) => {
        const itemKey = getItemKey(it, idx);
        const alreadyReturned = getAlreadyReturnedQtyForBillItem(selectedBillForReturn, it);
        const maxReturnable = Math.max(0, it.qty - alreadyReturned);
        const qty = Math.min(maxReturnable, returnQuantities[itemKey] || 0);
        return {
          productId: it.productId || "",
          name: it.name,
          sku: it.sku,
          price: it.price,
          costPrice: it.costPrice,
          qty: -qty, // Negative quantity for sale return
          freeQty: 0,
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
        const lineCost = it.price * it.qty; // negative
        const lineTax = lineCost * (it.taxPercent / 100);
        subtotal += lineCost;
        tax += lineTax;
      });
      const total = subtotal + tax;

      const returnBill = await billsStore.add({
        customerName: selectedBillForReturn.customerName,
        customerPhone: selectedBillForReturn.customerPhone,
        customerAddress: selectedBillForReturn.customerAddress,
        customerDrugLicNo: selectedBillForReturn.customerDrugLicNo,
        customerGstin: selectedBillForReturn.customerGstin,
        customerNotes: `Return for invoice ${selectedBillForReturn.number}.${returnNotes ? " Reason: " + returnNotes : ""}`,
        cashier: session?.name,
        paymentMethod: selectedBillForReturn.paymentMethod as any,
        subtotal: subtotal,
        tax: tax,
        discount: 0,
        total: total,
        isReturn: true, // triggers backend logic for SR- prefix & inventory stock restoration
        items: returnedItems as any,
      } as any);

      toast.success(`Sale return ${returnBill.number} successfully registered`);
      setIsReturnDialogOpen(false);
      setSelectedBillForReturn(null);
      setReturnNotes("");
      loadBills();
    } catch (err: any) {
      toast.error(err.message || "Failed to process sale return");
    } finally {
      setSubmittingReturn(false);
    }
  };

  const setRange = (r: FilterRange) => {
    navigate({
      search: (prev: BillsSearch) => ({ ...prev, range: r === "all" ? undefined : r }),
      replace: true,
    });
  };

  const setFrom = (v: string) =>
    navigate({
      search: (prev: BillsSearch) => ({ ...prev, range: "custom", from: v || undefined }),
      replace: true,
    });
  const setTo = (v: string) =>
    navigate({
      search: (prev: BillsSearch) => ({ ...prev, range: "custom", to: v || undefined }),
      replace: true,
    });

  const setStatus = (s: StatusTab) => {
    navigate({
      search: (prev: BillsSearch) => ({ ...prev, status: s === "all" ? undefined : s }),
      replace: true,
    });
  };

  const pendingCount = useMemo(() => bills.filter((b) => b.status === "pending").length, [bills]);

  const filtered = useMemo(() => {
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;
    if (range === "day") {
      from = new Date(now);
      from.setHours(0, 0, 0, 0);
    } else if (range === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === "year") {
      from = new Date(now.getFullYear(), 0, 1);
    } else if (range === "custom") {
      if (search.from) from = new Date(search.from);
      if (search.to) {
        to = new Date(search.to);
        to.setHours(23, 59, 59, 999);
      }
    }

    return bills.filter((b) => {
      // Status tab filter
      if (statusTab === "pending" && b.status !== "pending") return false;
      if (statusTab === "completed" && (b.status === "pending" || b.status === "rejected" || b.number.startsWith("SR-"))) return false;
      if (statusTab === "returns" && !b.number.startsWith("SR-")) return false;

      const t = new Date(b.createdAt).getTime();
      if (from && t < from.getTime()) return false;
      if (to && t > to.getTime()) return false;
      if (pay !== "all" && b.paymentMethod !== pay) return false;
      const q = query.toLowerCase();
      if (
        q &&
        !b.number.toLowerCase().includes(q) &&
        !(b.customerName ?? "").toLowerCase().includes(q) &&
        !(b.cashier ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [bills, range, search.from, search.to, query, pay, statusTab]);

  const totalForRange = filtered.reduce((s, b) => (b.status === "rejected" ? s : s + b.total), 0);
  const cashTotal = filtered
    .filter((b) => b.paymentMethod === "cash" && b.status !== "rejected")
    .reduce((s, b) => s + b.total, 0);
  const onlineTotal = filtered
    .filter((b) => b.paymentMethod === "online" && b.status !== "rejected")
    .reduce((s, b) => s + b.total, 0);
  const creditTotal = filtered
    .filter((b) => b.paymentMethod === "credit" && b.status !== "rejected")
    .reduce((s, b) => s + b.total, 0);

  const setPay = (p: PayFilter) => {
    navigate({
      search: (prev: BillsSearch) => ({ ...prev, pay: p === "all" ? undefined : p }),
      replace: true,
    });
  };

  const handleDownload = async (b: Bill, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const fresh = (await billsStore.get(b.id)) ?? b;
      await downloadBillPdf(fresh, {
        pharmacyName: session?.pharmacyName,
        pharmacyPhone: session?.pharmacyPhone,
        pharmacyAddress: session?.pharmacyAddress,
        gstNumber: session?.gstNumber,
        drugLicNo: session?.drugLicNo,
        billColor: session?.billColor,
        signature: session?.signature,
      });
    } catch {
      await downloadBillPdf(b, {
        pharmacyName: session?.pharmacyName,
        pharmacyAddress: session?.pharmacyAddress,
        gstNumber: session?.gstNumber,
        drugLicNo: session?.drugLicNo,
        billColor: session?.billColor,
        signature: session?.signature,
      });
      toast.error("Could not refresh, downloaded cached copy");
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (focusedIdx >= filtered.length) setFocusedIdx(0);
  }, [filtered.length, focusedIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      if (filtered.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedIdx((i) => {
          const next = Math.min(filtered.length - 1, i + 1);
          rowRefs.current[next]?.focus();
          rowRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIdx((i) => {
          const next = Math.max(0, i - 1);
          rowRefs.current[next]?.focus();
          rowRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "Enter") {
        const b = filtered[focusedIdx];
        if (b) {
          e.preventDefault();
          routerNavigate({ to: "/bills/$id", params: { id: b.id } });
        }
      } else if (e.key === "d" || e.key === "D") {
        const b = filtered[focusedIdx];
        if (b) {
          e.preventDefault();
          void handleDownload(b, { preventDefault() {}, stopPropagation() {} } as React.MouseEvent);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusedIdx, routerNavigate]);

  if (loading && bills.length === 0) return <TableSkeleton cols={7} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {session?.isEmployee ? "My Bills & Sales" : "Sales & Bills"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {session?.isEmployee
              ? "All sales bills generated by you. Track live approval status (Pending, Approved, or Rejected)."
              : "All customer invoices and sale returns generated in your pharmacy."}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 hidden md:block">
            Tip: use <kbd className="px-1 rounded border bg-muted">↑</kbd>
            <kbd className="px-1 rounded border bg-muted ml-1">↓</kbd> to move,
            <kbd className="px-1 rounded border bg-muted ml-1">Enter</kbd> to open,
            <kbd className="px-1 rounded border bg-muted ml-1">D</kbd> to download PDF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {!session?.isEmployee && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenReturnDialog()}
              className="border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 shadow-soft"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" /> Process Sale Return
            </Button>
          )}
          <div className="relative w-full md:w-72">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by invoice or customer…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <Card className="shadow-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          value={statusTab}
          onValueChange={(v) => setStatus(v as StatusTab)}
          className="w-full sm:w-auto"
        >
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="all">All Bills</TabsTrigger>
            <TabsTrigger value="pending" className="relative flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              <span>Pending Approval</span>
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              {session?.isEmployee ? "Approved / Completed" : "Completed Sales"}
            </TabsTrigger>
            {!session?.isEmployee && <TabsTrigger value="returns">Sale Returns</TabsTrigger>}
          </TabsList>
        </Tabs>
      </Card>

      <Card className="shadow-soft p-4 flex flex-col lg:flex-row lg:items-end gap-4">
        <Tabs
          value={range}
          onValueChange={(v) => setRange(v as FilterRange)}
          className="w-full lg:w-auto"
        >
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="day">Today</TabsTrigger>
            <TabsTrigger value="month">This month</TabsTrigger>
            <TabsTrigger value="year">This year</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
        {range === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={search.from ?? ""}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={search.to ?? ""}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        )}
        <div className="lg:ml-auto text-left lg:text-right">
          <div className="text-xs text-muted-foreground">
            {filtered.length} bill{filtered.length === 1 ? "" : "s"}
          </div>
          <div className="text-lg font-semibold tabular-nums">{formatMoney(totalForRange)}</div>
        </div>
      </Card>

      <Card className="shadow-soft p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs
          value={pay}
          onValueChange={(v) => setPay(v as PayFilter)}
          className="w-full sm:w-auto"
        >
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="all">All payments</TabsTrigger>
            <TabsTrigger value="cash">
              <Banknote className="h-3.5 w-3.5" /> Cash
            </TabsTrigger>
            <TabsTrigger value="online">
              <Smartphone className="h-3.5 w-3.5" /> Online
            </TabsTrigger>
            <TabsTrigger value="credit">
              <CreditCard className="h-3.5 w-3.5" /> Credit
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="sm:ml-auto flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/15 text-success font-medium">
            <Banknote className="h-3.5 w-3.5" /> Cash {formatMoney(cashTotal)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
            <Smartphone className="h-3.5 w-3.5" /> Online {formatMoney(onlineTotal)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium">
            <CreditCard className="h-3.5 w-3.5" /> Credit {formatMoney(creditTotal)}
          </span>
        </div>
      </Card>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <Card className="shadow-soft p-10 text-center text-muted-foreground">
            <ReceiptText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No bills in this range.
          </Card>
        ) : (
          filtered.map((b, idx) => {
            const isReturnBill = b.number.startsWith("SR-");
            const isPending = b.status === "pending";
            const isRejected = b.status === "rejected";
            return (
              <Card
                key={b.id}
                className={cn(
                  "shadow-soft p-4 active:scale-[0.99] transition-smooth cursor-pointer border-l-4",
                  idx === focusedIdx
                    ? "bg-primary/15 dark:bg-primary/25 border-l-primary ring-2 ring-primary/40 shadow-md font-medium"
                    : isPending
                      ? "bg-amber-500/10 border-amber-500/40 border-l-amber-500 hover:border-amber-500"
                      : isRejected
                        ? "bg-rose-500/10 border-rose-300 border-l-rose-500 opacity-75"
                        : isReturnBill
                          ? "bg-amber-50/40 border-amber-200 border-l-amber-500 hover:border-primary/30"
                          : "hover:border-primary/30 border-l-transparent"
                )}
                onClick={() => {
                  setFocusedIdx(idx);
                  routerNavigate({ to: "/bills/$id", params: { id: b.id } });
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-base text-primary font-mono tracking-wide">{b.number}</span>
                      {isPending && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] gap-1 px-1.5 py-0">
                          <Clock className="h-3 w-3" /> Pending
                        </Badge>
                      )}
                      {isRejected && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Rejected
                        </Badge>
                      )}
                      {isReturnBill && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                          Sale Return
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{new Date(b.createdAt).toLocaleString()}</span>
                      {b.cashier && (
                        <span className="text-[11px] bg-muted px-1.5 py-0.2 rounded font-medium">
                          By: {b.cashier}
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-1.5 truncate">{b.customerName ?? "Walk-in"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-semibold tabular-nums ${isReturnBill ? "text-amber-700" : ""}`}>
                      {formatMoney(b.total)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {b.items.length} item{b.items.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span
                    className={
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize " +
                      (b.paymentMethod === "cash"
                        ? "bg-success/15 text-success"
                        : "bg-primary/10 text-primary")
                    }
                  >
                    {b.paymentMethod === "cash" ? (
                      <Banknote className="h-3 w-3" />
                    ) : (
                      <Smartphone className="h-3 w-3" />
                    )}
                    {b.paymentMethod}
                  </span>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {isPending && (
                      !session?.isEmployee ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50 border-rose-200"
                            onClick={(e) => handleRejectBill(b, e)}
                            disabled={actionLoading === b.id}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={(e) => handleApproveBill(b, e)}
                            disabled={actionLoading === b.id}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                          </Button>
                        </>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                          Awaiting Admin
                        </span>
                      )
                    )}
                    {!isReturnBill && !isPending && !session?.isEmployee && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-amber-700 hover:bg-amber-50 border-amber-200"
                        onClick={() => handleOpenReturnDialog(b)}
                        title="Process Return"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => void handleDownload(b, e)}
                      title="Download PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop / tablet table */}
      <Card className="shadow-soft overflow-x-auto hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Staff / Cashier</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  <ReceiptText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No bills in this range.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b, idx) => {
                const isReturnBill = b.number.startsWith("SR-");
                const isPending = b.status === "pending";
                const isRejected = b.status === "rejected";
                return (
                  <TableRow
                    key={b.id}
                    ref={(el) => {
                      rowRefs.current[idx] = el as any;
                    }}
                    tabIndex={0}
                    onFocus={() => setFocusedIdx(idx)}
                    data-focused={idx === focusedIdx}
                    className={cn(
                      "animate-fade-in cursor-pointer transition-colors border-l-4 focus:outline-none",
                      idx === focusedIdx
                        ? "bg-primary/15 dark:bg-primary/25 border-l-primary shadow-sm ring-1 ring-primary/30 font-medium"
                        : isPending
                          ? "bg-amber-500/5 hover:bg-amber-500/10 border-l-amber-500"
                          : isRejected
                            ? "bg-rose-500/5 opacity-75 border-l-rose-500"
                            : isReturnBill
                              ? "bg-amber-50/40 hover:bg-amber-100/50 border-l-amber-500"
                              : "hover:bg-muted/40 border-l-transparent"
                    )}
                    onClick={() => routerNavigate({ to: "/bills/$id", params: { id: b.id } })}
                  >
                    <TableCell className="font-extrabold text-base text-primary font-mono tracking-wide">
                      <div className="flex items-center gap-2">
                        <span>{b.number}</span>
                        {isReturnBill && (
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                            Sale Return
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isPending ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs gap-1 font-medium">
                          <Clock className="h-3 w-3" /> Pending
                        </Badge>
                      ) : isRejected ? (
                        <Badge variant="destructive" className="text-xs">
                          Rejected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                          Completed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{b.customerName ?? "Walk-in"}</TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-muted-foreground">
                        {b.cashier || "Admin"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize " +
                          (b.paymentMethod === "cash"
                            ? "bg-success/15 text-success"
                            : "bg-primary/10 text-primary")
                        }
                      >
                        {b.paymentMethod === "cash" ? (
                          <Banknote className="h-3 w-3" />
                        ) : (
                          <Smartphone className="h-3 w-3" />
                        )}
                        {b.paymentMethod}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{b.items.length}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${isReturnBill ? "text-amber-700" : ""}`}>
                      {formatMoney(b.total)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {isPending ? (
                          !session?.isEmployee ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 text-rose-600 hover:bg-rose-50 border-rose-200"
                                onClick={(e) => handleRejectBill(b, e)}
                                disabled={actionLoading === b.id}
                                title="Reject Bill"
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={(e) => handleApproveBill(b, e)}
                                disabled={actionLoading === b.id}
                                title="Confirm & Deduct Stock"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                            </>
                          ) : (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                              Awaiting Admin
                            </span>
                          )
                        ) : (
                          <>
                            {!isReturnBill && !session?.isEmployee && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 text-amber-700 hover:bg-amber-50 border-amber-200"
                                onClick={() => handleOpenReturnDialog(b)}
                                title="Process Return"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => void handleDownload(b, e)}
                          title="Download PDF"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Process Sale Return Dialog */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleConfirmReturn();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-amber-600" /> Process Sale Return
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="bill-select">Select Original Sales Invoice</Label>
                <select
                  id="bill-select"
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={selectedBillForReturn?.id || ""}
                  onChange={(e) => {
                    const b = bills.find((x) => x.id === e.target.value) || null;
                    setSelectedBillForReturn(b);
                    const qtys: Record<string, number> = {};
                    b?.items.forEach((it, idx) => {
                      const itemKey = getItemKey(it, idx);
                      qtys[itemKey] = 0;
                    });
                    setReturnQuantities(qtys);
                  }}
                >
                  <option value="">-- Select Sales Invoice --</option>
                  {bills.filter(b => !b.number.startsWith("SR-")).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.number} - {b.customerName || "Walk-in"} ({new Date(b.createdAt).toLocaleDateString("en-IN")}) - {formatMoney(b.total)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBillForReturn && (
                <div className="space-y-4 mt-4">
                  <h4 className="text-sm font-semibold text-muted-foreground">Select Items and Quantities to Return</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {selectedBillForReturn.items.map((it, idx) => {
                      const itemKey = getItemKey(it, idx);
                      const alreadyReturned = getAlreadyReturnedQtyForBillItem(selectedBillForReturn, it);
                      const maxReturnable = Math.max(0, it.qty - alreadyReturned);
                      const isFullyReturned = maxReturnable === 0;

                      return (
                        <div key={itemKey} className="flex justify-between items-center gap-4 p-2.5 border rounded-md text-sm bg-slate-50/50">
                          <div className="flex-1">
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              <span>{it.name}</span>
                              {isFullyReturned && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                                  Fully Returned
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Batch: <span className="uppercase">{String(it.batch || "—").toUpperCase()}</span> | Exp: {it.expiry || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Price: {formatMoney(it.price)} | Sold Qty: <span className="font-medium text-foreground">{it.qty}</span>
                              {alreadyReturned > 0 && (
                                <span className="text-amber-700 font-medium"> | Returned: {alreadyReturned}</span>
                              )}
                              <span className="font-bold text-foreground"> | Available to Return: {maxReturnable}</span>
                            </div>
                          </div>
                          <div className="w-28">
                            <Label className="text-xs text-muted-foreground">Return Qty</Label>
                            <Input
                              type="number"
                              min={0}
                              max={maxReturnable}
                              disabled={isFullyReturned}
                              placeholder={isFullyReturned ? "0" : ""}
                              value={returnQuantities[itemKey] || ""}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void handleConfirmReturn();
                                }
                              }}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === "") {
                                  setReturnQuantities((prev) => ({ ...prev, [itemKey]: 0 }));
                                } else {
                                  const val = Math.min(maxReturnable, Math.max(0, parseInt(raw) || 0));
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
                      placeholder="e.g. Damaged medicine, customer changed mind, wrong order"
                      value={returnNotes}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleConfirmReturn();
                        }
                      }}
                      onChange={(e) => setReturnNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsReturnDialogOpen(false);
                  setSelectedBillForReturn(null);
                  setReturnNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingReturn || !selectedBillForReturn}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {submittingReturn ? "Processing..." : "Confirm Return"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
