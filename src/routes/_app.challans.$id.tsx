import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  ArrowLeft,
  Printer,
  FileCheck2,
  Edit,
  XCircle,
  Receipt,
  Lock,
  Clock,
  CheckCircle2,
  Calendar,
  User,
  Phone,
  MapPin,
  Building2,
  FileText,
  AlertCircle,
  Check,
} from "lucide-react";
import { challansStore, type SaleChallan } from "@/lib/storage";
import { downloadChallanPdf } from "@/lib/challan-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/challans/$id")({
  component: SaleChallanDetailsPage,
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

function numberToWords(num: number): string {
  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ", "Ten ",
    "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen ",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const val = Math.floor(Math.abs(num));
  if (val === 0) return "Zero Rupees Only";

  const n = ("000000000" + val).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";

  let str = "";
  str += n[1] !== "00" ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "Crore " : "";
  str += n[2] !== "00" ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "Lakh " : "";
  str += n[3] !== "00" ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "Thousand " : "";
  str += n[4] !== "0" ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "Hundred " : "";
  str += n[5] !== "00" ? (str !== "" ? "and " : "") + (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) + "Rupees " : "Rupees ";
  return str.trim() + " Only";
}

function SaleChallanDetailsPage() {
  const { id } = useParams({ from: "/_app/challans/$id" });
  const navigate = useNavigate();

  const [challan, setChallan] = useState<SaleChallan | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate Bill Modal state
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [billPaymentMethod, setBillPaymentMethod] = useState<"cash" | "online" | "credit">("cash");
  const [billAdvanceAmount, setBillAdvanceAmount] = useState<string>("0");
  const [billNotes, setBillNotes] = useState<string>("");
  const [billingLoading, setBillingLoading] = useState(false);

  // Cancel Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingLoading, setCancellingLoading] = useState(false);

  const loadChallan = async () => {
    try {
      setLoading(true);
      const data = await challansStore.get(id);
      setChallan(data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load Sale Challan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallan();
  }, [id]);

  const handlePrint = async () => {
    if (!challan) return;
    try {
      toast.info(`Preparing print for Challan ${challan.challanNumber}...`);
      await downloadChallanPdf(challan);
      toast.success(`PDF downloaded for Challan ${challan.challanNumber}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to download Challan PDF");
    }
  };

  const handleOpenGenerateBill = () => {
    if (!challan) return;
    setBillPaymentMethod("cash");
    setBillAdvanceAmount("0");
    setBillNotes(`Billed from Challan ${challan.challanNumber}`);
    setBillModalOpen(true);
  };

  const handleConfirmGenerateBill = async () => {
    if (!challan) return;
    try {
      setBillingLoading(true);
      const res = await challansStore.generateBill(challan.id, {
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
      loadChallan();
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate sales bill");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!challan) return;
    try {
      setCancellingLoading(true);
      await challansStore.cancel(challan.id);
      toast.success(`Challan ${challan.challanNumber} cancelled. Reserved stock released.`);
      setCancelModalOpen(false);
      loadChallan();
    } catch (err: any) {
      toast.error(err?.message || "Failed to cancel challan");
    } finally {
      setCancellingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-muted-foreground">
        Loading Sale Challan details...
      </div>
    );
  }

  if (!challan) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="text-sm font-semibold">Sale Challan Not Found</div>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/challans" })}>
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Challans
        </Button>
      </div>
    );
  }

  const canEdit = challan.status === "draft" || (challan.status === "issued" && (challan.items.every(it => (it.billedQty || 0) === 0)));
  const canGenerateBill = challan.status === "issued" || challan.status === "partially_billed";
  const canCancel = challan.status !== "billed" && challan.status !== "cancelled";

  return (
    <div className="space-y-5 animate-fade-in pb-16">
      {/* ── Top Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border shadow-soft">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/challans" })}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                {challan.challanNumber}
              </h1>
              {challan.status === "issued" && (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold gap-1">
                  <Lock className="w-3 h-3" /> Issued (Reserved)
                </Badge>
              )}
              {challan.status === "partially_billed" && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold gap-1">
                  <Clock className="w-3 h-3" /> Partially Billed
                </Badge>
              )}
              {challan.status === "billed" && (
                <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Billed
                </Badge>
              )}
              {challan.status === "cancelled" && (
                <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-semibold gap-1">
                  <XCircle className="w-3 h-3" /> Cancelled
                </Badge>
              )}
              {challan.status === "draft" && (
                <Badge className="bg-neutral-500/15 text-neutral-700 dark:text-neutral-400 border-neutral-500/30 font-semibold">
                  Draft
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Challan Date: {formatDate(challan.challanDate)} | Created by: {challan.createdByName || "Admin"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print A4 PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 text-xs font-semibold gap-1.5 shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Challan (A4)
          </Button>

          {/* Edit */}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: `/challans/new`, search: { editId: challan.id } as any })}
              className="h-9 text-xs font-semibold gap-1.5"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit Challan
            </Button>
          )}

          {/* Generate Bill */}
          {canGenerateBill && (
            <Button
              size="sm"
              onClick={handleOpenGenerateBill}
              className="h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-soft"
            >
              <FileCheck2 className="w-4 h-4" />
              Generate Bill
            </Button>
          )}

          {/* Cancel */}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCancelModalOpen(true)}
              className="h-9 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel Challan
            </Button>
          )}
        </div>
      </div>

      {/* ── Notice Banner ── */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3 text-amber-900 dark:text-amber-300 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <strong className="font-bold">SALE CHALLAN – NOT A TAX INVOICE:</strong>
          <span className="ml-1">
            This document represents temporary delivery dispatch. The selected stock quantities are reserved from available stock. Actual inventory deduction and billing take place only when "Generate Bill" is clicked.
          </span>
        </div>
      </div>

      {/* ── Customer & Pharmacy Meta ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Box */}
        <Card className="p-4 border shadow-soft space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <User className="w-4 h-4 text-primary" />
            Customer / Consignee
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="font-bold text-sm text-foreground">
              {challan.customerName || "Counter Customer"}
            </div>
            {challan.customerPhone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span>{challan.customerPhone}</span>
              </div>
            )}
            {challan.customerAddress && (
              <div className="flex items-start gap-1.5 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{challan.customerAddress}</span>
              </div>
            )}
            {challan.customerGstin && (
              <div className="font-mono text-muted-foreground pt-1">
                GSTIN: <span className="font-semibold text-foreground">{challan.customerGstin}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Dispatch & Pharmacy Meta */}
        <Card className="p-4 border shadow-soft space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-primary" />
            Dispatch Details
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Store Name:</span>
              <span className="font-semibold text-foreground">
                {challan.pharmacy?.name || "MediStock Pharmacy"}
              </span>
            </div>
            {challan.pharmacy?.gstin && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Store GSTIN:</span>
                <span className="font-mono font-medium">{challan.pharmacy.gstin}</span>
              </div>
            )}
            {challan.pharmacy?.drugLicNo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Drug License:</span>
                <span className="font-mono font-medium">{challan.pharmacy.drugLicNo}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Notes / Remarks:</span>
              <span className="font-medium text-foreground">{challan.notes || "None"}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Linked Invoices Card (if billed or partially billed) ── */}
      {challan.linkedInvoices && challan.linkedInvoices.length > 0 && (
        <Card className="p-4 border border-blue-500/20 bg-blue-500/5 shadow-soft space-y-3">
          <div className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Receipt className="w-4 h-4" />
            Linked Final Sales Invoices ({challan.linkedInvoices.length})
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {challan.linkedInvoices.map((inv) => (
              <div
                key={inv.billId}
                className="bg-card p-3 rounded-lg border shadow-xs flex items-center justify-between"
              >
                <div>
                  <div className="font-mono font-bold text-xs text-primary">{inv.invoiceNumber}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Generated on {formatDate(inv.createdAt)}
                  </div>
                  {inv.total != null && (
                    <div className="text-xs font-semibold mt-0.5">{formatMoney(inv.total)}</div>
                  )}
                </div>

                <Link
                  to="/bills/$id"
                  params={{ id: inv.billId }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  View Bill →
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Challan Products & Batches Table ── */}
      <Card className="border shadow-soft overflow-hidden">
        <div className="p-3 bg-muted/40 border-b flex justify-between items-center">
          <div className="text-xs font-bold text-foreground">
            Dispatched Products & Batch Stock Reservations ({challan.items.length})
          </div>
          <div className="text-[11px] text-muted-foreground">
            Stock is reserved batch-wise
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow className="text-xs">
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead className="min-w-[180px]">Product Name</TableHead>
                <TableHead className="w-24">Batch No</TableHead>
                <TableHead className="w-20">Expiry</TableHead>
                <TableHead className="w-16 text-center">Challan Qty</TableHead>
                <TableHead className="w-14 text-center">Free</TableHead>
                <TableHead className="w-20 text-center text-emerald-600 dark:text-emerald-400">Reserved</TableHead>
                <TableHead className="w-20 text-center text-blue-600 dark:text-blue-400">Billed</TableHead>
                <TableHead className="w-20 text-center text-amber-600 dark:text-amber-400">Remaining</TableHead>
                <TableHead className="w-20 text-right">MRP (₹)</TableHead>
                <TableHead className="w-20 text-right">Rate (₹)</TableHead>
                <TableHead className="w-16 text-right">Disc %</TableHead>
                <TableHead className="w-16 text-right">GST %</TableHead>
                <TableHead className="w-24 text-right pr-4">Total (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {challan.items.map((it, idx) => (
                <TableRow key={idx} className="text-xs hover:bg-muted/30">
                  <TableCell className="text-center font-medium">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground">{it.productName}</div>
                    {it.pack && <div className="text-[10px] text-muted-foreground">{it.pack}</div>}
                  </TableCell>
                  <TableCell className="font-mono uppercase font-semibold">
                    {it.batchNo || "DEFAULT"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {it.expiryDate ? String(it.expiryDate).slice(0, 7) : "—"}
                  </TableCell>
                  <TableCell className="text-center font-bold">{it.qty}</TableCell>
                  <TableCell className="text-center">{it.freeQty || 0}</TableCell>
                  <TableCell className="text-center font-bold text-emerald-600 dark:text-emerald-400">
                    {it.reservation?.reservedQty ?? (it.qty + (it.freeQty || 0))}
                  </TableCell>
                  <TableCell className="text-center font-bold text-blue-600 dark:text-blue-400">
                    {it.billedQty || 0}
                  </TableCell>
                  <TableCell className="text-center font-bold text-amber-600 dark:text-amber-400">
                    {it.remainingQtyToBill ?? (it.qty - (it.billedQty || 0))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {it.mrp != null ? Number(it.mrp).toFixed(2) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {Number(it.rate).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(it.discountPercent) > 0 ? `${Number(it.discountPercent)}%` : "0%"}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(it.taxPercent) > 0 ? `${Number(it.taxPercent)}%` : "0%"}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums pr-4">
                    ₹{Number(it.amount).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ── Summary & Totals ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 border shadow-soft bg-card space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Delivery & Billing Status
          </div>
          <div className="text-xs space-y-1.5 text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Amount in Words: </span>
              <span className="font-bold text-foreground">{numberToWords(challan.total)}</span>
            </div>
            <p className="pt-2">
              Challan is linked to the pharmacy stock reservation ledger. All stock deduction is logged to product audit history upon bill confirmation.
            </p>
          </div>
        </Card>

        <Card className="p-4 border shadow-soft bg-card space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Financial Summary
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal (Taxable):</span>
              <span className="font-mono font-medium">₹{Number(challan.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                - ₹{Number(challan.discount).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST:</span>
              <span className="font-mono font-medium">+ ₹{Number(challan.tax).toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="font-bold text-sm text-foreground">Grand Total:</span>
              <span className="font-mono font-bold text-lg text-primary">
                {formatMoney(challan.total)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Generate Bill Modal ── */}
      <Dialog open={billModalOpen} onOpenChange={setBillModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <FileCheck2 className="w-5 h-5" />
              Convert Sale Challan into Final Sales Bill
            </DialogTitle>
            <DialogDescription>
              Confirming this bill will deduct the physical inventory from stock and release the reserved quantity atomically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted/50 p-3 rounded-lg border text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Challan:</span>
                <span className="font-mono font-bold text-foreground">{challan.challanNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-semibold text-foreground">
                  {challan.customerName || "Counter Customer"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Bill Value:</span>
                <span className="font-bold text-primary text-sm">{formatMoney(challan.total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment Method</Label>
                <select
                  value={billPaymentMethod}
                  onChange={(e) => setBillPaymentMethod(e.target.value as any)}
                  className="w-full h-9 rounded-md border bg-background px-3 text-xs outline-none"
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
                <strong>Stock Rule:</strong> Deducts physical quantity from inventory and releases this challan's reservation atomically.
              </span>
            </div>
          </div>

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
              Are you sure you want to cancel Challan <strong>{challan.challanNumber}</strong>?
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
