import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Printer, Pill } from "lucide-react";
import QRCode from "react-qr-code";
import { billsStore, type Bill } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { downloadBillPdf } from "@/lib/bill-pdf";
import { useAuth } from "@/lib/auth-context";
import { BillDetailSkeleton } from "@/components/loading-skeleton";

export const Route = createFileRoute("/_app/bills/$id")({
  component: BillDetailPage,
});

function numberToWords(num: number): string {
  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const val = Math.floor(num);
  if (val === 0) return "Zero Rupees Only";

  const n = ("000000000" + val).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";

  let str = "";
  str +=
    n[1] != "00" ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "Crore " : "";
  str +=
    n[2] != "00" ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "Lakh " : "";
  str +=
    n[3] != "00"
      ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "Thousand "
      : "";
  str +=
    n[4] != "0"
      ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "Hundred "
      : "";
  str +=
    n[5] != "00"
      ? (str != "" ? "and " : "") +
        (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) +
        "Rupees "
      : "Rupees ";
  return str.trim() + " Only";
}

function BillDetailPage() {
  const { id } = useParams({ from: "/_app/bills/$id" });
  const navigate = useNavigate();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  const pharmacyName = session?.pharmacyName || "MediStock Pharmacy";
  const pharmacyAddress = session?.pharmacyAddress || "";

  // Backspace → go back to bills list (guarded when typing)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (isTyping) return;
      e.preventDefault();
      void navigate({ to: "/bills" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

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

  const totalQty = bill.items.reduce((acc, item) => acc + item.qty, 0);
  const totalFree = bill.items.reduce((acc, item) => acc + (item.freeQty || 0), 0);
  const cgst = bill.tax / 2;
  const sgst = bill.tax / 2;

  const netPayable = bill.total;
  const roundOff = bill.total - (bill.subtotal + bill.tax - (bill.discount || 0));

  const handlePrint = () => {
    downloadBillPdf(bill, {
      pharmacyName,
      pharmacyPhone: session?.pharmacyPhone,
      pharmacyAddress,
      gstNumber: session?.gstNumber,
      drugLicNo: session?.drugLicNo,
      billColor: session?.billColor,
      signature: session?.signature,
      print: true,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            margin: 1.5cm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          /* Print page numbers at bottom center */
          @page {
            @bottom-center {
              content: "Page " counter(page) " of " counter(pages);
              font-size: 10px;
              color: #666;
            }
          }
        }
      `,
        }}
      />

      {/* Action Bar (Hidden in Print) */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden bg-background sticky top-0 z-10 py-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/bills">
            <ArrowLeft className="h-4 w-4 mr-2" /> All bills
            <kbd className="ml-2 hidden sm:inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Backspace
            </kbd>
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button
            size="sm"
            onClick={() =>
              void downloadBillPdf(bill, {
                pharmacyName,
                pharmacyPhone: session?.pharmacyPhone,
                pharmacyAddress,
                gstNumber: session?.gstNumber,
                drugLicNo: session?.drugLicNo,
                billColor: session?.billColor,
                signature: session?.signature,
              })
            }
            className="shadow-soft"
          >
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="bg-card text-card-foreground p-8 sm:p-10 shadow-lg print:shadow-none print:p-0 print:m-0 w-full min-h-[297mm] mx-auto border print:border-none relative rounded-xl">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-4">
          <div className="flex gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-primary flex items-center justify-center text-primary-foreground print:bg-primary print:text-white">
              <Pill className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide m-0 leading-tight text-primary">
                {pharmacyName}
              </h1>
              {pharmacyAddress && (
                <p className="text-sm max-w-xs leading-snug mt-1 whitespace-pre-wrap text-muted-foreground">
                  {pharmacyAddress}
                </p>
              )}
              <div className="flex flex-wrap flex-col gap-y-1 mt-2 text-xs font-mono text-muted-foreground">
                {session?.pharmacyPhone && (
                  <p>
                    <strong>Phone:</strong> {session.pharmacyPhone}
                  </p>
                )}
                {session?.gstNumber && (
                  <p>
                    <strong>GSTIN:</strong> {session.gstNumber.toUpperCase()}
                  </p>
                )}
                {session?.drugLicNo && (
                  <p>
                    <strong>D.L.No.:</strong> {session.drugLicNo.toUpperCase()}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-sm flex flex-col gap-1">
            <h2 className="text-xl font-bold uppercase tracking-widest text-primary mb-1">
              Tax Invoice
            </h2>
            <div className="flex justify-end gap-2">
              <span className="text-muted-foreground">Inv No:</span>
              <span className="font-bold font-mono text-primary">{bill.number}</span>
            </div>
            <div className="flex justify-end gap-2">
              <span className="text-muted-foreground">Date:</span>
              <span>{new Date(bill.createdAt).toLocaleDateString("en-IN")}</span>
            </div>
            <div className="flex justify-end gap-2">
              <span className="text-muted-foreground">Time:</span>
              <span>
                {new Date(bill.createdAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <span className="text-muted-foreground">Cashier:</span>
              <span className="font-medium">{bill.cashier || "Admin"}</span>
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="border border-border rounded-lg p-4 mb-4 flex flex-col sm:flex-row justify-between text-xs gap-4 bg-muted/20">
          <div className="sm:w-1/2">
            <p className="font-semibold mb-1 uppercase text-xs text-primary">CUSTOMER DETAILS</p>
            <p className="font-bold uppercase text-base">
              {bill.customerName || "Walk-in Customer"}
            </p>
            {bill.customerPhone && (
              <p className="text-muted-foreground">
                PHONE: <span className="text-foreground">{bill.customerPhone}</span>
              </p>
            )}
            {bill.customerDrugLicNo && (
              <p className="text-muted-foreground">
                D.L.NO.: <span className="text-foreground uppercase">{bill.customerDrugLicNo}</span>
              </p>
            )}
            {bill.customerGstin && (
              <p className="text-muted-foreground">
                GSTIN: <span className="text-foreground uppercase">{bill.customerGstin}</span>
              </p>
            )}
            {bill.customerAddress && (
              <p className="text-muted-foreground truncate">
                ADDRESS: <span className="text-foreground">{bill.customerAddress}</span>
              </p>
            )}
          </div>
          <div className="sm:w-1/2 sm:border-l border-border sm:pl-4">
            <p className="font-semibold mb-1 uppercase text-xs text-primary">DISPATCH & PAYMENT</p>
            <p className="text-muted-foreground">
              Transport: <span className="text-foreground">Direct / By Hand</span>
            </p>
            <p className="text-muted-foreground">
              Payment Mode:{" "}
              <span className="uppercase font-semibold text-primary">{bill.paymentMethod}</span>
            </p>
            {bill.customerNotes && (
              <p className="mt-1 text-xs text-muted-foreground italic">{bill.customerNotes}</p>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-6 w-full overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs border-collapse table-fixed min-w-[700px]">
            <thead className="table-header-group bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-2 text-center w-[4%] font-medium">#</th>
                <th className="py-3 px-2 text-left w-[20%] font-medium">Medicine Name</th>
                <th className="py-3 px-2 text-center w-[8%] font-medium whitespace-nowrap">Pack</th>
                <th className="py-3 px-2 text-left w-[10%] font-medium whitespace-nowrap">
                  Batch No
                </th>
                <th className="py-3 px-2 text-center w-[8%] font-medium">Expiry</th>
                <th className="py-3 px-2 text-left w-[6%] font-medium">HSN</th>
                <th className="py-3 px-2 text-right w-[8%] font-medium">Qty</th>
                <th className="py-3 px-2 text-right w-[10%] font-medium">MRP</th>
                <th className="py-3 px-2 text-center w-[6%] font-medium">GST%</th>
                <th className="py-3 px-2 text-right w-[10%] font-medium">Rate</th>
                <th className="py-3 px-2 text-right w-[10%] font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bill.items.map((it, idx) => {
                const lineAmount = it.price * it.qty;
                const taxAmount = (lineAmount * it.taxPercent) / 100;

                const expFormatted = it.expiry
                  ? (() => {
                      const d = new Date(it.expiry);
                      const m = String(d.getMonth() + 1).padStart(2, "0");
                      const y = String(d.getFullYear()).slice(-2);
                      return `${m}/${y}`;
                    })()
                  : "-";

                return (
                  <tr key={idx} className="break-inside-avoid hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2 text-center align-top text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-2 text-left align-top font-semibold truncate break-words whitespace-normal">
                      {it.name}
                    </td>
                    <td className="py-3 px-2 text-center align-top text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                      {it.pack ? it.pack.replace(/[*x]/gi, "X") : "-"}
                    </td>
                    <td className="py-3 px-2 text-left align-top font-mono text-[10px] uppercase text-muted-foreground whitespace-nowrap">
                      {String(it.batch || "-").toUpperCase()}
                    </td>
                    <td className="py-3 px-2 text-center align-top font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {expFormatted}
                    </td>
                    <td className="py-3 px-2 text-left align-top font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {it.sku || "-"}
                    </td>
                    <td className="py-3 px-2 text-right align-top font-medium whitespace-nowrap">
                      {it.qty}
                      {it.freeQty ? `+${it.freeQty}` : ""}
                    </td>
                    <td className="py-3 px-2 text-right align-top font-mono text-muted-foreground">
                      {it.mrp != null ? it.mrp.toFixed(2) : "-"}
                    </td>
                    <td className="py-3 px-2 text-center align-top text-muted-foreground">
                      {it.taxPercent}%
                    </td>
                    <td className="py-3 px-2 text-right align-top font-mono">
                      {it.price.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right align-top font-mono font-bold text-primary">
                      {(lineAmount + taxAmount).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Area */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 break-inside-avoid">
          {/* Left Footer Area */}
          <div className="w-full sm:w-[55%] flex flex-col gap-4">
            <div className="flex gap-4 items-center p-3 border border-border rounded-lg bg-muted/10">
              <div className="p-1.5 bg-white rounded-md shrink-0">
                <QRCode value={bill.number} size={56} level="M" />
              </div>
              <div className="text-sm space-y-1">
                <p>
                  <strong className="text-muted-foreground font-medium">Total Items:</strong>{" "}
                  {bill.items.length}
                </p>
                <p>
                  <strong className="text-muted-foreground font-medium">Total Qty:</strong>{" "}
                  {totalQty}{" "}
                  {totalFree > 0 ? (
                    <span className="text-primary font-medium">(+{totalFree} Free)</span>
                  ) : (
                    ""
                  )}
                </p>
              </div>
            </div>

            <div className="text-xs p-3 bg-primary/5 border border-primary/10 rounded-lg">
              <p className="font-semibold text-primary uppercase mb-1">Amount in Words:</p>
              <p className="font-bold capitalize">{numberToWords(netPayable)}</p>
            </div>

            <div className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              <p className="font-bold uppercase text-foreground mb-1">Terms & Conditions:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Goods once sold will not be taken back or exchanged.</li>
                <li>verify the exp. date printed on the medicine strip.</li>
                <li>Keep medicines out of reach of children.</li>
              </ul>
            </div>
          </div>

          {/* Right Summary Area */}
          <div className="w-full sm:w-[40%] text-sm">
            <div className="space-y-2 w-full p-4 border border-border rounded-lg bg-muted/10">
              <div className="flex justify-between text-muted-foreground">
                <span>Gross Amount</span>
                <span className="font-mono text-foreground">
                  {(bill.subtotal + (bill.discount || 0)).toFixed(2)}
                </span>
              </div>
              {(bill.discount || 0) > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount</span>
                  <span className="font-mono font-medium">-{bill.discount!.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Taxable Amount</span>
                <span className="font-mono text-foreground">{bill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST</span>
                <span className="font-mono text-foreground">{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground pb-2 border-b border-border">
                <span>SGST</span>
                <span className="font-mono text-foreground">{sgst.toFixed(2)}</span>
              </div>
              {roundOff !== 0 && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>Round Off</span>
                  <span className="font-mono">
                    {roundOff > 0 ? "+" : ""}
                    {roundOff.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between py-2 text-xl font-bold uppercase tracking-wide text-primary">
                <span>Net Payable</span>
                <span className="font-mono">₹{netPayable.toFixed(2)}</span>
              </div>

              {bill.paymentMethod === "credit" ? (
                <div className="text-xs pt-2 space-y-1.5 border-t border-border">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Advance Paid</span>
                    <span className="font-mono text-foreground">
                      ₹{bill.advanceAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-destructive">
                    <span>Balance Due</span>
                    <span className="font-mono">
                      ₹{(netPayable - bill.advanceAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs pt-2 space-y-1.5 border-t border-border">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount Paid</span>
                    <span className="font-mono text-foreground">₹{netPayable.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-success">
                    <span>Balance</span>
                    <span className="font-mono">₹0.00</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-16 flex justify-between items-end text-sm break-inside-avoid px-4">
          <div className="text-center">
            <div className="border-t border-border w-40 pt-2 text-muted-foreground">
              Customer Signature
            </div>
          </div>
          <div className="text-center">
            <div className="h-12"></div> {/* Space for signature or stamp */}
            <div className="font-bold text-xs uppercase text-primary mb-2">For {pharmacyName}</div>
            <div className="border-t border-border w-48 pt-2 text-muted-foreground">
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* Absolute Footer message */}
        <div className="mt-10 pt-4 border-t border-border text-center text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
          Thank you for your business. Get well soon!
        </div>
      </div>
    </div>
  );
}
