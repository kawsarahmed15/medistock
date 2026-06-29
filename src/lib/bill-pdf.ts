import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Bill } from "@/lib/storage";
import { apiRequest } from "@/lib/api-client";

// jsPDF's built-in Helvetica font doesn't include the Rupee glyph (₹)
// or many Unicode dashes — they render as "Ø<>" boxes. Use ASCII only.
const RUPEE = "Rs.";

function money(n: number) {
  // Format Indian-style with two decimals, no currency symbol from Intl
  // (avoids the unsupported ₹ glyph).
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${RUPEE} ${formatted}`;
}

function clean(s: string | undefined | null): string {
  if (!s) return "";
  // Strip characters jsPDF helvetica can't render (em dash, en dash, smart quotes, ₹)
  return s
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u20B9/g, RUPEE)
    .replace(/[^\x20-\x7E]/g, "");
}

export async function downloadBillPdf(
  bill: Bill,
  settings?: {
    pharmacyName?: string;
    pharmacyAddress?: string;
    gstNumber?: string;
    billColor?: string;
    signature?: string;
  }
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 40;
  const right = pageWidth - 40;

  // Retrieve customized billing settings from passed options
  const pharmacyName = settings?.pharmacyName || "MediStock Pharmacy";
  const pharmacyAddress = settings?.pharmacyAddress || "";
  const gstNumber = settings?.gstNumber || "";
  const billColor = settings?.billColor || "#1a9890";
  const signature = settings?.signature || "";

  // Parse color hex to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const cleanHex = hex.replace("#", "");
    const num = parseInt(cleanHex, 16);
    return [
      (num >> 16) & 255,
      (num >> 8) & 255,
      num & 255
    ];
  };

  const primaryRgb = hexToRgb(billColor);

  // ===== Header band =====
  doc.setFillColor(...primaryRgb);
  
  // Calculate header height based on content
  let headerHeight = 90;
  let addressLines = [];
  if (pharmacyAddress) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    addressLines = doc.splitTextToSize(clean(pharmacyAddress), 300);
    headerHeight += addressLines.length * 13; // 13pt per line
  }
  headerHeight += 10; // Add gap between address and tax invoice text

  doc.rect(0, 0, pageWidth, headerHeight, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(clean(pharmacyName), left, 36);

  let currentY = 50; // closer to clinic name
  if (addressLines.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(addressLines, left, currentY);
    currentY += addressLines.length * 13;
  }

  currentY += 10; // Gap between address and Tax invoice text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Tax invoice / Sale bill", left, currentY);
  currentY += 14;

  if (gstNumber) {
    doc.setFontSize(9);
    doc.text(`GSTIN: ${clean(gstNumber.toUpperCase())}`, left, currentY);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(clean(bill.number), right, 38, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    clean(new Date(bill.createdAt).toLocaleString("en-IN")),
    right,
    56,
    { align: "right" },
  );

  // ===== Parties block =====
  doc.setTextColor(35, 35, 35);
  let y = headerHeight + 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Billed to", left, y);
  doc.text("Payment", right - 160, y);

  doc.setFont("helvetica", "normal");
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.text((clean(bill.customerName) || "Walk-in customer").toUpperCase(), left, y);
  doc.setFont("helvetica", "normal");
  doc.text(bill.paymentMethod.toUpperCase(), right - 160, y);

  let leftY = y + 14;
  if (bill.customerPhone) {
    doc.text(clean(bill.customerPhone), left, leftY);
    leftY += 14;
  }
  
  if (bill.customerAddress) {
    const custAddrLines = doc.splitTextToSize(clean(bill.customerAddress), 200);
    doc.text(custAddrLines, left, leftY);
    leftY += custAddrLines.length * 12;
  }

  let rightY = y + 14;
  if (bill.cashier) {
    doc.text(`Cashier: ${clean(bill.cashier)}`, right - 160, rightY);
    rightY += 14;
  }

  y = Math.max(leftY, rightY);
  
  if (bill.customerNotes) {
    y += 14;
    const splitNotes = doc.splitTextToSize(clean(bill.customerNotes), right - 160 - left);
    doc.text(splitNotes, left, y);
    y += (splitNotes.length - 1) * 12; // Adjust y in case it wraps
  }

  // ===== Items table =====
  autoTable(doc, {
    startY: 165,
    head: [["#", "Item", "Pack", "Exp.", "MRP", "Qty", "Free", "Price", "Tax %", "Total"]],
    body: bill.items.map((it, idx) => {
      const line = it.price * it.qty;
      const tax = (line * it.taxPercent) / 100;
      return [
        String(idx + 1),
        clean(it.name),
        it.pack ? it.pack.replace(/[*x]/gi, "X") : "-",
        it.expiry ? new Date(it.expiry).toLocaleDateString(undefined, {month: 'short', year: '2-digit'}) : "-",
        it.mrp != null ? it.mrp.toFixed(2) : "-",
        String(it.qty),
        String(it.freeQty || 0),
        it.price.toFixed(2),
        `${it.taxPercent}%`,
        (line + tax).toFixed(2),
      ];
    }),
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      lineColor: [220, 220, 220],
      lineWidth: 0.4,
      textColor: [40, 40, 40],
      overflow: "hidden",
    },
    headStyles: {
      fillColor: primaryRgb,
      textColor: 255,
      fontStyle: "bold",
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 18, halign: "center" },
      2: { halign: "center", cellWidth: 32 },
      3: { halign: "center", cellWidth: 36 },
      4: { halign: "right", cellWidth: 36 },
      5: { halign: "right", cellWidth: 26 },
      6: { halign: "center", cellWidth: 26 },
      7: { halign: "right", cellWidth: 40 },
      8: { halign: "right", cellWidth: 32 },
      9: { halign: "right", cellWidth: 50 },
    },
    margin: { left, right: 40 },
    theme: "grid",
  });

  // ===== Totals =====
  const tableEndY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 200;

  const totalsLabelX = right - 180;
  const totalsValueX = right;
  let ty = tableEndY + 26;

  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text("Subtotal", totalsLabelX, ty);
  doc.setTextColor(35, 35, 35);
  doc.text(bill.subtotal.toFixed(2), totalsValueX, ty, { align: "right" });

  ty += 16;
  doc.setTextColor(110, 110, 110);
  doc.text("Tax", totalsLabelX, ty);
  doc.setTextColor(35, 35, 35);
  doc.text(bill.tax.toFixed(2), totalsValueX, ty, { align: "right" });

  if ((bill.discount || 0) > 0) {
    ty += 16;
    doc.setTextColor(110, 110, 110);
    doc.text("Discount", totalsLabelX, ty);
    doc.setTextColor(35, 35, 35);
    doc.text(`-${(bill.discount || 0).toFixed(2)}`, totalsValueX, ty, { align: "right" });
  }

  ty += 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(totalsLabelX, ty, totalsValueX, ty);

  ty += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primaryRgb);
  doc.text("Grand total", totalsLabelX, ty);
  doc.text(bill.total.toFixed(2), totalsValueX, ty, { align: "right" });
  
  if (bill.paymentMethod === "credit") {
    if (bill.advanceAmount > 0) {
      ty += 16;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(110, 110, 110);
      doc.text("Advance Paid", totalsLabelX, ty);
      doc.setTextColor(35, 35, 35);
      doc.text(bill.advanceAmount.toFixed(2), totalsValueX, ty, { align: "right" });
    }
    ty += 16;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38); // destructive red
    if (bill.total >= bill.advanceAmount) {
      doc.text("Balance Due:", totalsLabelX, ty);
      doc.text((bill.total - bill.advanceAmount).toFixed(2), totalsValueX, ty, { align: "right" });
    } else {
      doc.text("Change / Credit:", totalsLabelX, ty);
      doc.text((bill.advanceAmount - bill.total).toFixed(2), totalsValueX, ty, { align: "right" });
    }
  }

  // Customer notes (optional)
  if (bill.customerNotes && bill.customerNotes.trim()) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    const notes = doc.splitTextToSize(`Notes: ${clean(bill.customerNotes)}`, pageWidth - 80);
    doc.text(notes, left, ty);
  }

  // ===== Signature (On Last Page) =====
  const totalPages = doc.internal.getNumberOfPages();
  doc.setPage(totalPages);

  const sigWidth = 120;
  const sigHeight = 50;
  const sigX = right - sigWidth;
  let sigY = ty + 20;

  const footerSpace = 60;
  if (sigY + sigHeight + 30 > pageHeight - footerSpace) {
    doc.addPage();
    const finalPages = doc.internal.getNumberOfPages();
    doc.setPage(finalPages);
    sigY = 50; // top of new page
  }

  // Draw signature line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(sigX, sigY + sigHeight, right, sigY + sigHeight);

  // Label
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 110);
  doc.text("Authorized Signature", right, sigY + sigHeight + 12, { align: "right" });

  if (signature) {
    try {
      doc.addImage(signature, "PNG", sigX, sigY, sigWidth, sigHeight);
    } catch (err) {
      console.error("Failed to add signature image to PDF", err);
    }
  }

  // ===== Footer =====
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(
    `Thank you for choosing ${pharmacyName} - get well soon!`,
    pageWidth / 2,
    pageHeight - 32,
    { align: "center" },
  );

  doc.save(`${clean(bill.number) || "bill"}.pdf`);
}
