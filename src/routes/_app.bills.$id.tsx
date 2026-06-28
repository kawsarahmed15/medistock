import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Download,
  Pill,
  Printer,
  ReceiptText,
  Smartphone,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { billsStore, type Bill } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadBillPdf } from "@/lib/bill-pdf";
import { useAuth } from "@/lib/auth-context";

import { BillDetailSkeleton } from "@/components/loading-skeleton";

export const Route = createFileRoute("/_app/bills/$id")({
  component: BillDetailPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function BillDetailPage() {
  const { id } = useParams({ from: "/_app/bills/$id" });
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const pharmacyName = session?.pharmacyName || "MediStock Pharmacy";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    billsStore
      .get(id)
      .then((b) => {
        if (!cancelled) {
          setBill(b);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBill(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const stats = useMemo(() => {
    if (!bill) return null;
    const itemCount = bill.items.reduce((s, it) => s + it.qty, 0);
    const cost = bill.items.reduce(
      (s, it) => s + (it.costPrice ?? 0) * it.qty,
      0,
    );
    const profit = bill.subtotal - cost;
    const margin = bill.subtotal > 0 ? (profit / bill.subtotal) * 100 : 0;
    return { itemCount, cost, profit, margin };
  }, [bill]);

  if (loading) return <BillDetailSkeleton />;

  if (!bill) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted-foreground">Bill not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/bills">Back to bills</Link>
        </Button>
      </div>
    );
  }

  const PayIcon = bill.paymentMethod === "cash" ? Banknote : Smartphone;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/bills">
            <ArrowLeft className="h-4 w-4" /> All bills
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button
            size="sm"
            onClick={() => void downloadBillPdf(bill)}
            className="shadow-soft"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
          <MiniStat label="Items sold" value={String(stats.itemCount)} icon={ReceiptText} />
          <MiniStat
            label="Payment"
            value={bill.paymentMethod}
            icon={PayIcon}
            valueClass="capitalize"
          />
          <MiniStat
            label="Profit"
            value={formatMoney(stats.profit)}
            icon={Wallet}
            valueClass={stats.profit < 0 ? "text-destructive" : "text-success"}
          />
          <MiniStat
            label="Margin"
            value={`${stats.margin.toFixed(1)}%`}
            icon={TrendingUp}
          />
        </div>
      )}

      <Card className="shadow-soft p-5 sm:p-8 animate-scale-in print:shadow-none print:border-0">
        <div className="flex items-start justify-between border-b pb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Pill className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold text-lg leading-tight">{pharmacyName}</div>
              <div className="text-xs text-muted-foreground">Invoice / Tax bill</div>
              {session?.gstNumber && (
                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  GSTIN: {session.gstNumber.toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold">{bill.number}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(bill.createdAt).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 py-5 text-sm">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Billed to</div>
            <div className="font-bold text-lg uppercase mt-1 flex items-center gap-1.5">
              <User className="h-4 w-4 text-muted-foreground" />
              {bill.customerName ?? "Walk-in customer"}
            </div>
            {bill.customerPhone && (
              <div className="text-xs text-muted-foreground mt-0.5">{bill.customerPhone}</div>
            )}
            {bill.customerNotes && (
              <div className="text-sm mt-2 whitespace-pre-wrap">
                {bill.customerNotes}
              </div>
            )}
          </div>
          <div className="sm:text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Cashier</div>
            <div className="font-medium mt-1">{bill.cashier ?? "—"}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mt-2">Payment</div>
            <div className="font-medium mt-1 capitalize inline-flex items-center gap-1.5 sm:justify-end">
              <PayIcon className="h-3.5 w-3.5" />
              {bill.paymentMethod}
            </div>
          </div>
        </div>

        {/* Items: table on sm+, stacked rows on mobile */}
        {(() => {
          const paidItems = bill.items;

          return (
            <>
              {paidItems.length > 0 && (
                <div className="rounded-lg overflow-hidden border hidden sm:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 text-center p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Item</th>
                <th className="w-16 text-right p-3 font-medium">Pack</th>
                <th className="w-16 text-center p-3 font-medium">Exp.</th>
                <th className="w-16 text-right p-3 font-medium">MRP</th>
                <th className="w-12 text-right p-3 font-medium">Qty</th>
                <th className="w-12 text-right p-3 font-medium">Free</th>
                <th className="w-20 text-right p-3 font-medium">Price</th>
                <th className="w-24 text-right p-3 font-medium">Tax</th>
                <th className="w-24 text-right p-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {paidItems.map((it, idx) => {
                const line = it.price * it.qty;
                const tax = (line * it.taxPercent) / 100;
                return (
                  <tr key={it.productId || it.name} className="border-t">
                    <td className="p-3 text-center text-muted-foreground">{idx + 1}</td>
                    <td className="p-3">{it.name}</td>
                    <td className="p-3 text-right tabular-nums">{it.pack ? it.pack.replace(/[*x]/gi, "X") : "—"}</td>
                    <td className="p-3 text-center text-xs tabular-nums">{it.expiry ? new Date(it.expiry).toLocaleDateString(undefined, {month: 'short', year: '2-digit'}) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{it.mrp != null ? it.mrp.toFixed(2) : "—"}</td>
                    <td className="p-3 text-right tabular-nums">{it.qty}</td>
                    <td className="p-3 text-right tabular-nums text-primary font-medium">{it.freeQty || 0}</td>
                    <td className="p-3 text-right tabular-nums">{it.price.toFixed(2)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {it.taxPercent}% ({tax.toFixed(2)})
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium">
                      {(line + tax).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
              )}

        {paidItems.length > 0 && (
          <div className="space-y-2 sm:hidden mt-4">
            {paidItems.map((it, idx) => {
              const line = it.price * it.qty;
            const tax = (line * it.taxPercent) / 100;
            return (
              <div
                key={it.productId || it.name}
                className="border rounded-lg p-3 text-sm"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{idx + 1}. {it.name}</span>
                  <span className="font-semibold tabular-nums">
                    {(line + tax).toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {it.qty} × {it.price.toFixed(2)} · Tax {it.taxPercent}% ({tax.toFixed(2)})
                  {it.freeQty ? ` · Free ${it.freeQty}` : ""}
                  {it.pack && ` · Pack ${it.pack.replace(/[*x]/gi, "X")}`}
                  {it.expiry && ` · Exp ${new Date(it.expiry).toLocaleDateString(undefined, {month: 'short', year: '2-digit'})}`}
                  {it.mrp != null && ` · MRP ${it.mrp.toFixed(2)}`}
                </div>
              </div>
            );
          })}
        </div>
        )}
        </>
      );
    })()}

        <div className="mt-6 sm:ml-auto w-full sm:w-72 space-y-1.5 text-sm">
          <Row label="Subtotal" value={bill.subtotal.toFixed(2)} />
          <Row label="Tax" value={bill.tax.toFixed(2)} />
          <div className="border-t my-3 border-dashed" />
          <div className="text-primary text-base">
            <Row label="Grand total" value={bill.total.toFixed(2)} bold />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Thank you for choosing {pharmacyName} — get well soon!
        </p>
      </Card>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-base" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClass?: string;
}) {
  return (
    <Card className="shadow-soft p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1 text-base font-semibold ${valueClass ?? ""}`}>
        {value}
      </div>
    </Card>
  );
}
