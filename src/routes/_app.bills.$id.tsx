import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Printer,
  Pill,
} from "lucide-react";
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
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const val = Math.floor(num);
  if (val === 0) return 'Zero Rupees Only';
  
  // Format up to 9,99,99,999
  const n = ('000000000' + val).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';

  let str = '';
  str += (n[1] != '00') ? (a[Number(n[1])] || b[n[1][0] as any] + ' ' + a[n[1][1] as any]) + 'Crore ' : '';
  str += (n[2] != '00') ? (a[Number(n[2])] || b[n[2][0] as any] + ' ' + a[n[2][1] as any]) + 'Lakh ' : '';
  str += (n[3] != '00') ? (a[Number(n[3])] || b[n[3][0] as any] + ' ' + a[n[3][1] as any]) + 'Thousand ' : '';
  str += (n[4] != '0') ? (a[Number(n[4])] || b[n[4][0] as any] + ' ' + a[n[4][1] as any]) + 'Hundred ' : '';
  str += (n[5] != '00') ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0] as any] + ' ' + a[n[5][1] as any]) + 'Rupees ' : 'Rupees ';
  return str.trim() + ' Only';
}

function BillDetailPage() {
  const { id } = useParams({ from: "/_app/bills/$id" });
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  
  const pharmacyName = session?.pharmacyName || "MediStock Pharmacy";
  const pharmacyAddress = session?.pharmacyAddress || "123 Health Ave, Medical District, City";

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
  
  const netPayable = Math.round(bill.total);
  const roundOff = netPayable - bill.total;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Action Bar (Hidden in Print) */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden bg-background sticky top-0 z-10 py-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/bills">
            <ArrowLeft className="h-4 w-4 mr-2" /> All bills
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button
            size="sm"
            onClick={() => void downloadBillPdf(bill, {
              pharmacyName,
              pharmacyAddress,
              gstNumber: session?.gstNumber,
              drugLicNo: session?.drugLicNo,
              billColor: session?.billColor,
              signature: session?.signature,
            })}
            className="shadow-soft"
          >
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>

      {/* Invoice Document */}
      <div className="bg-white text-black p-8 sm:p-10 shadow-lg print:shadow-none print:p-0 print:m-0 w-full min-h-[297mm] mx-auto border print:border-none relative">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
          <div className="flex gap-4">
            <div className="h-16 w-16 rounded-xl bg-slate-900 flex items-center justify-center text-white print:border print:border-black print:bg-white print:text-black">
              <Pill className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide m-0 leading-tight">
                {pharmacyName}
              </h1>
              <p className="text-sm max-w-xs leading-snug mt-1 whitespace-pre-wrap">
                {pharmacyAddress}
              </p>
              <div className="flex flex-wrap gap-x-4 mt-2 text-xs font-mono">
                {session?.gstNumber && <p><strong>GSTIN:</strong> {session.gstNumber.toUpperCase()}</p>}
                {session?.drugLicNo && <p><strong>DL No:</strong> {session.drugLicNo.toUpperCase()}</p>}
              </div>
            </div>
          </div>
          <div className="text-right text-sm flex flex-col gap-1">
            <h2 className="text-xl font-bold uppercase tracking-widest text-gray-500 mb-1 print:text-black">Invoice</h2>
            <div className="flex justify-end gap-2">
              <span className="text-gray-500 print:text-black">Inv No:</span>
              <span className="font-bold font-mono">{bill.number}</span>
            </div>
            <div className="flex justify-end gap-2">
              <span className="text-gray-500 print:text-black">Date:</span>
              <span>{new Date(bill.createdAt).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="flex justify-end gap-2">
              <span className="text-gray-500 print:text-black">Time:</span>
              <span>{new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex justify-end gap-2 mt-1">
              <span className="text-gray-500 print:text-black">Cashier:</span>
              <span>{bill.cashier || "Admin"}</span>
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="border border-black p-3 mb-4 flex flex-col sm:flex-row justify-between text-sm gap-4">
          <div className="sm:w-1/2">
            <p className="font-semibold mb-1 uppercase text-xs text-gray-600 print:text-black">Customer Details</p>
            <p className="font-bold uppercase text-base">{bill.customerName || "Walk-in Customer"}</p>
            {bill.customerPhone && <p>Phone: {bill.customerPhone}</p>}
            {bill.customerAddress && <p>Address: {bill.customerAddress}</p>}
            {bill.customerDrugLicNo && <p className="font-mono text-xs mt-1">DL: {bill.customerDrugLicNo}</p>}
          </div>
          <div className="sm:w-1/2 sm:border-l border-black sm:pl-4">
            <p className="font-semibold mb-1 uppercase text-xs text-gray-600 print:text-black">Prescription Info</p>
            <p>Doctor: {bill.customerNotes ? "See Notes" : "N/A"}</p>
            <p>Payment Mode: <span className="uppercase font-semibold">{bill.paymentMethod}</span></p>
            {bill.customerNotes && (
              <p className="mt-1 text-xs text-gray-700 print:text-black italic">{bill.customerNotes}</p>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-6 w-full overflow-x-auto">
          <table className="w-full text-xs border-collapse table-fixed min-w-[700px]">
            <thead className="table-header-group">
              <tr className="border-y-2 border-black bg-gray-50 print:bg-transparent">
                <th className="py-2 px-1 text-center w-[4%]">#</th>
                <th className="py-2 px-1 text-left w-[24%]">Medicine Name</th>
                <th className="py-2 px-1 text-center w-[12%]">Batch No</th>
                <th className="py-2 px-1 text-center w-[8%]">Expiry</th>
                <th className="py-2 px-1 text-center w-[8%]">HSN</th>
                <th className="py-2 px-1 text-right w-[8%]">Qty</th>
                <th className="py-2 px-1 text-right w-[10%]">MRP</th>
                <th className="py-2 px-1 text-center w-[6%]">GST%</th>
                <th className="py-2 px-1 text-right w-[10%]">Rate</th>
                <th className="py-2 px-1 text-right w-[10%]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((it, idx) => {
                const lineAmount = it.price * it.qty;
                const taxAmount = (lineAmount * it.taxPercent) / 100;
                
                const expFormatted = it.expiry ? (() => {
                  const d = new Date(it.expiry);
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const y = String(d.getFullYear()).slice(-2);
                  return `${m}/${y}`;
                })() : "-";

                return (
                  <tr key={idx} className="border-b border-gray-300 print:border-black break-inside-avoid">
                    <td className="py-2 px-1 text-center align-top">{idx + 1}</td>
                    <td className="py-2 px-1 text-left align-top font-semibold truncate break-words whitespace-normal">
                      {it.name}
                      <div className="text-[10px] text-gray-500 font-normal mt-0.5 print:text-black">
                        {it.pack ? `Pack: ${it.pack.replace(/[*x]/gi, "X")}` : ''}
                        {it.freeQty ? ` + ${it.freeQty} Free` : ''}
                      </div>
                    </td>
                    <td className="py-2 px-1 text-center align-top font-mono text-[10px] uppercase">{it.batch || "-"}</td>
                    <td className="py-2 px-1 text-center align-top font-mono text-[10px]">{expFormatted}</td>
                    <td className="py-2 px-1 text-center align-top font-mono text-[10px]">-</td>
                    <td className="py-2 px-1 text-right align-top font-medium">{it.qty}</td>
                    <td className="py-2 px-1 text-right align-top font-mono">{it.mrp != null ? it.mrp.toFixed(2) : "-"}</td>
                    <td className="py-2 px-1 text-center align-top">{it.taxPercent}%</td>
                    <td className="py-2 px-1 text-right align-top font-mono">{it.price.toFixed(2)}</td>
                    <td className="py-2 px-1 text-right align-top font-mono font-bold">{(lineAmount + taxAmount).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary Area */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t-2 border-black pt-4 break-inside-avoid">
          
          {/* Left Footer Area */}
          <div className="w-full sm:w-[55%] flex flex-col gap-4">
            <div className="flex gap-4 items-center">
              <div className="p-2 border border-black bg-white inline-block">
                <QRCode value={bill.number} size={64} level="M" />
              </div>
              <div className="text-xs space-y-1">
                <p><strong>Total Items:</strong> {bill.items.length}</p>
                <p><strong>Total Qty:</strong> {totalQty} {totalFree > 0 ? `(+${totalFree} Free)` : ''}</p>
              </div>
            </div>
            
            <div className="text-xs">
              <p className="font-semibold text-gray-600 uppercase print:text-black mb-1">Amount in Words:</p>
              <p className="font-bold capitalize">{numberToWords(netPayable)}</p>
            </div>
            
            <div className="text-[10px] text-gray-500 print:text-black mt-2 leading-relaxed">
              <p className="font-bold uppercase text-gray-700 print:text-black mb-1">Terms & Conditions:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Goods once sold will not be taken back or exchanged.</li>
                <li>Please consult your doctor before using the medicines.</li>
                <li>Keep medicines out of reach of children.</li>
              </ul>
            </div>
          </div>
          
          {/* Right Summary Area */}
          <div className="w-full sm:w-[40%] text-sm">
            <div className="space-y-1.5 w-full">
              <div className="flex justify-between">
                <span>Gross Amount</span>
                <span className="font-mono">{(bill.subtotal + (bill.discount || 0)).toFixed(2)}</span>
              </div>
              {(bill.discount || 0) > 0 && (
                <div className="flex justify-between text-green-700 print:text-black">
                  <span>Discount</span>
                  <span className="font-mono">-{bill.discount!.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Taxable Amount</span>
                <span className="font-mono">{bill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST</span>
                <span className="font-mono">{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-black pb-1.5">
                <span>SGST</span>
                <span className="font-mono">{sgst.toFixed(2)}</span>
              </div>
              {roundOff !== 0 && (
                <div className="flex justify-between text-xs text-gray-600 print:text-black pt-1.5">
                  <span>Round Off</span>
                  <span className="font-mono">{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between py-2 text-xl font-bold uppercase tracking-wide bg-gray-100 px-2 print:bg-transparent print:px-0">
                <span>Net Payable</span>
                <span className="font-mono">₹{netPayable.toFixed(2)}</span>
              </div>
              
              {bill.paymentMethod === "credit" ? (
                <div className="text-xs pt-2 space-y-1 border-t border-dashed border-black">
                  <div className="flex justify-between">
                    <span>Advance Paid</span>
                    <span className="font-mono">₹{bill.advanceAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Balance Due</span>
                    <span className="font-mono">₹{(netPayable - bill.advanceAmount).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs pt-2 space-y-1 border-t border-dashed border-black">
                  <div className="flex justify-between">
                    <span>Amount Paid</span>
                    <span className="font-mono">₹{netPayable.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Balance</span>
                    <span className="font-mono">₹0.00</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-16 flex justify-between items-end text-sm break-inside-avoid px-2">
          <div className="text-center">
            <div className="border-t border-black w-40 pt-1">Customer Signature</div>
          </div>
          <div className="text-center">
            <div className="h-10"></div> {/* Space for signature or stamp */}
            <div className="font-bold text-xs uppercase text-gray-500 print:text-black mb-1">For {pharmacyName}</div>
            <div className="border-t border-black w-48 pt-1">Authorized Signatory</div>
          </div>
        </div>
        
        {/* Absolute Footer message */}
        <div className="mt-8 pt-4 border-t border-gray-200 print:border-black text-center text-[10px] font-semibold tracking-widest uppercase text-gray-400 print:text-black">
          Thank you for your business. Get well soon!
        </div>

      </div>
    </div>
  );
}
