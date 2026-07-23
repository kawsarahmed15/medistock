import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Truck, Printer, Download, Pill, FileText, CheckCircle } from "lucide-react";
import { purchasesStore, type Purchase } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/purchases/$id")({
  component: PurchaseDetailsPage,
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

function PurchaseDetailsPage() {
  const { id } = Route.useParams();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);

  // De-serialize metadata
  const meta = useMemo(() => {
    if (!purchase?.notes) return null;
    try {
      return JSON.parse(purchase.notes);
    } catch {
      return null;
    }
  }, [purchase]);

  useEffect(() => {
    purchasesStore
      .get(id)
      .then((p) => {
        setPurchase(p);
        setLoading(false);
      })
      .catch((err) => {
        toast.error(err.message || "Failed to load purchase");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading purchase...</div>;
  }
  if (!purchase) {
    return <div className="p-8 text-center text-rose-500">Purchase not found.</div>;
  }

  const cgst = purchase.tax / 2;
  const sgst = purchase.tax / 2;
  const netPayable = purchase.total;
  const roundOff = netPayable - (purchase.subtotal + purchase.tax - purchase.discount);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden bg-background py-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/purchases">
            <ArrowLeft className="h-4 w-4 mr-2" /> All purchases
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print PO
          </Button>
        </div>
      </div>

      {/* Invoice Document Layout */}
      <div className="bg-card text-card-foreground p-8 sm:p-10 shadow-lg print:shadow-none print:p-0 print:m-0 w-full min-h-[297mm] mx-auto border print:border-none relative rounded-xl">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-4">
          <div className="flex gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-primary flex items-center justify-center text-primary-foreground print:bg-primary print:text-white">
              <Pill className="h-8 w-8" />
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
          <div className="text-right text-sm flex flex-col gap-1">
            <h2 className="text-xl font-bold uppercase tracking-widest text-primary mb-1">
              PO Voucher
            </h2>
            <div className="flex justify-end gap-2 text-xs">
              <span className="text-muted-foreground">PO Ref No:</span>
              <span className="font-bold font-mono text-primary">{purchase.number}</span>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <span className="text-muted-foreground">Invoice No:</span>
              <span className="font-bold font-mono">{purchase.supplierInvoice || "—"}</span>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <span className="text-muted-foreground">Date:</span>
              <span>{new Date(purchase.createdAt).toLocaleDateString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Distributor details */}
        <div className="border border-border rounded-lg p-4 mb-4 flex flex-col sm:flex-row justify-between text-xs gap-4 bg-muted/20">
          <div className="sm:w-1/2">
            <p className="font-semibold mb-1 uppercase text-xs text-primary">SUPPLIER / DISTRIBUTOR</p>
            <p className="font-bold uppercase text-base">{purchase.supplierName}</p>
            {purchase.supplierPhone && (
              <p className="text-muted-foreground mt-0.5">
                PHONE: <span className="text-foreground">{purchase.supplierPhone}</span>
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
              Payment Method: <span className="uppercase font-semibold text-primary">{purchase.paymentMethod}</span>
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
            {meta?.dueDate && (
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
              {purchase.items.map((it, idx) => {
                const lineAmount = it.costPrice * it.qty;
                const taxAmount = (lineAmount * it.taxPercent) / 100;

                return (
                  <TableRow key={idx} className="hover:bg-muted/10">
                    <TableCell className="text-center">{idx + 1}</TableCell>
                    <TableCell className="font-semibold">{it.name}</TableCell>
                    <TableCell className="font-mono uppercase text-muted-foreground">{it.batch || "—"}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{it.expiry || "—"}</TableCell>
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
              <p className="font-bold capitalize">{numberToWords(purchase.total)}</p>
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
                <span className="font-mono text-foreground">{formatMoney(purchase.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>CGST</span>
                <span className="font-mono text-foreground">{formatMoney(cgst)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs pb-2 border-b">
                <span>SGST</span>
                <span className="font-mono text-foreground">{formatMoney(sgst)}</span>
              </div>
              {purchase.discount > 0 && (
                <div className="flex justify-between text-success text-xs">
                  <span>Discount</span>
                  <span className="font-mono">-{formatMoney(purchase.discount)}</span>
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
                <span className="font-mono">{formatMoney(purchase.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
