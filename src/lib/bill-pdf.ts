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
    drugLicNo?: string;
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
  const drugLicNo = settings?.drugLicNo || "";
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
  let currentY = 40;
  
  // Left Side: Pharmacy Info
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(clean(pharmacyName).toUpperCase(), left, currentY);
  
  currentY += 16;
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  let addressLines = [];
  if (pharmacyAddress) {
    addressLines = doc.splitTextToSize(clean(pharmacyAddress), 250);
    doc.text(addressLines, left, currentY);
    currentY += addressLines.length * 12;
  }
  
  currentY += 4;
  doc.setFontSize(9);
  let gstDlText = "";
  if (gstNumber) gstDlText += `GSTIN: ${clean(gstNumber.toUpperCase())}   `;
  if (drugLicNo) gstDlText += `DL No: ${clean(drugLicNo.toUpperCase())}`;
  if (gstDlText) {
    doc.text(gstDlText, left, currentY);
    currentY += 12;
  }
  
  const headerBottomY = currentY + 10;
  
  // Right Side: Invoice Meta
  let rightY = 40;
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TAX INVOICE", right, rightY, { align: "right" });
  
  rightY += 16;
  doc.setTextColor(110, 110, 110);
  doc.setFontSize(9);
  doc.text(`Inv No:`, right - 60, rightY);
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.text(clean(bill.number), right, rightY, { align: "right" });
  
  rightY += 14;
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.text(`Date:`, right - 60, rightY);
  doc.setTextColor(35, 35, 35);
  doc.text(clean(new Date(bill.createdAt).toLocaleDateString("en-IN")), right, rightY, { align: "right" });
  
  rightY += 14;
  doc.setTextColor(110, 110, 110);
  doc.text(`Time:`, right - 60, rightY);
  doc.setTextColor(35, 35, 35);
  doc.text(clean(new Date(bill.createdAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })), right, rightY, { align: "right" });
  
  rightY += 14;
  doc.setTextColor(110, 110, 110);
  doc.text(`Cashier:`, right - 60, rightY);
  doc.setTextColor(35, 35, 35);
  doc.text(clean(bill.cashier) || "Admin", right, rightY, { align: "right" });
  
  // Header Bottom Border
  let y = Math.max(headerBottomY, rightY + 10);
  doc.setDrawColor(...primaryRgb);
  doc.setLineWidth(1.5);
  doc.line(left, y, right, y);

  // ===== Parties block =====
  y += 15;
  const boxTop = y;
  
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CUSTOMER DETAILS", left + 10, y + 14);
  doc.text("PRESCRIPTION INFO", left + 260, y + 14);

  doc.setTextColor(35, 35, 35);
  let cy = y + 28;
  doc.setFontSize(11);
  doc.text((clean(bill.customerName) || "Walk-in customer").toUpperCase(), left + 10, cy);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Doctor: ", left + 260, cy);
  doc.setTextColor(35, 35, 35);
  doc.text(bill.customerNotes ? "See Notes" : "N/A", left + 295, cy);

  let leftY = cy + 14;
  if (bill.customerPhone) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Phone: `, left + 10, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(bill.customerPhone), left + 45, leftY);
    leftY += 14;
  }
  
  if (bill.customerAddress) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Address: `, left + 10, leftY);
    doc.setTextColor(35, 35, 35);
    const custAddrLines = doc.splitTextToSize(clean(bill.customerAddress), 200);
    doc.text(custAddrLines, left + 55, leftY);
    leftY += custAddrLines.length * 12;
  }

  if (bill.customerDrugLicNo) {
    doc.setTextColor(110, 110, 110);
    doc.text(`DL: `, left + 10, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(bill.customerDrugLicNo.toUpperCase()), left + 30, leftY);
    leftY += 14;
  }

  rightY = cy + 14;
  doc.setTextColor(110, 110, 110);
  doc.text(`Payment Mode: `, left + 260, rightY);
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.text(bill.paymentMethod.toUpperCase(), left + 330, rightY);
  doc.setFont("helvetica", "normal");
  rightY += 14;

  if (bill.customerNotes) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(110, 110, 110);
    const splitNotes = doc.splitTextToSize(clean(bill.customerNotes), right - (left + 260) - 10);
    doc.text(splitNotes, left + 260, rightY);
    rightY += splitNotes.length * 12;
    doc.setFont("helvetica", "normal");
  }

  let boxBottom = Math.max(leftY, rightY) + 6;
  
  // Draw Customer Box
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(left, boxTop, pageWidth - (left * 2), boxBottom - boxTop, 4, 4, "FD");
  
  // Re-draw text since roundedRect filled over it
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CUSTOMER DETAILS", left + 10, y + 14);
  doc.text("PRESCRIPTION INFO", left + 260, y + 14);

  doc.setTextColor(35, 35, 35);
  cy = y + 28;
  doc.setFontSize(11);
  doc.text((clean(bill.customerName) || "Walk-in customer").toUpperCase(), left + 10, cy);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Doctor: ", left + 260, cy);
  doc.setTextColor(35, 35, 35);
  doc.text(bill.customerNotes ? "See Notes" : "N/A", left + 295, cy);

  leftY = cy + 14;
  if (bill.customerPhone) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Phone: `, left + 10, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(bill.customerPhone), left + 45, leftY);
    leftY += 14;
  }
  
  if (bill.customerAddress) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Address: `, left + 10, leftY);
    doc.setTextColor(35, 35, 35);
    const custAddrLines = doc.splitTextToSize(clean(bill.customerAddress), 200);
    doc.text(custAddrLines, left + 55, leftY);
    leftY += custAddrLines.length * 12;
  }

  if (bill.customerDrugLicNo) {
    doc.setTextColor(110, 110, 110);
    doc.text(`DL: `, left + 10, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(bill.customerDrugLicNo.toUpperCase()), left + 30, leftY);
    leftY += 14;
  }

  rightY = cy + 14;
  doc.setTextColor(110, 110, 110);
  doc.text(`Payment Mode: `, left + 260, rightY);
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.text(bill.paymentMethod.toUpperCase(), left + 330, rightY);
  doc.setFont("helvetica", "normal");
  rightY += 14;

  if (bill.customerNotes) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(110, 110, 110);
    const splitNotes = doc.splitTextToSize(clean(bill.customerNotes), right - (left + 260) - 10);
    doc.text(splitNotes, left + 260, rightY);
    rightY += splitNotes.length * 12;
    doc.setFont("helvetica", "normal");
  }

  // Draw separator line inside box
  doc.setDrawColor(220, 220, 220);
  doc.line(left + 245, boxTop, left + 245, boxBottom);

  y = boxBottom;

  // ===== Items table =====
  autoTable(doc, {
    startY: Math.max(165, y + 15),
    head: [["#", "Medicine Name", "Batch No", "Expiry", "HSN", "Qty", "MRP", "GST%", "Rate", "Amount"]],
    body: bill.items.map((it, idx) => {
      const line = it.price * it.qty;
      const tax = (line * it.taxPercent) / 100;
      let nameStr = clean(it.name);
      if (it.pack) nameStr += `\nPack: ${it.pack.replace(/[*x]/gi, "X")}`;
      if (it.freeQty) nameStr += `\n+ ${it.freeQty} Free`;
      
      return [
        String(idx + 1),
        nameStr,
        clean(it.batch || "-"),
        it.expiry ? (() => {
          const d = new Date(it.expiry);
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const y = String(d.getFullYear()).slice(-2);
          return `${m}/${y}`;
        })() : "-",
        "-",
        String(it.qty),
        it.mrp != null ? it.mrp.toFixed(2) : "-",
        `${it.taxPercent}%`,
        it.price.toFixed(2),
        (line + tax).toFixed(2),
      ];
    }),
    styles: {
      fontSize: 8.5,
      cellPadding: 6,
      lineColor: [220, 220, 220],
      lineWidth: 0.4,
      textColor: [40, 40, 40],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [80, 80, 80],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 16, halign: "center" },
      1: { halign: "left" },
      2: { halign: "center", cellWidth: 42 },
      3: { halign: "center", cellWidth: 32 },
      4: { halign: "center", cellWidth: 32 },
      5: { halign: "right", cellWidth: 32 },
      6: { halign: "right", cellWidth: 40 },
      7: { halign: "center", cellWidth: 30 },
      8: { halign: "right", cellWidth: 40 },
      9: { halign: "right", cellWidth: 50, fontStyle: "bold", textColor: primaryRgb },
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
  
  const netPayable = Math.round(bill.total);
  const roundOff = netPayable - bill.total;
  const cgst = bill.tax / 2;
  const sgst = bill.tax / 2;

  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text("Gross Amount", totalsLabelX, ty);
  doc.setTextColor(35, 35, 35);
  doc.text((bill.subtotal + (bill.discount || 0)).toFixed(2), totalsValueX, ty, { align: "right" });

  if ((bill.discount || 0) > 0) {
    ty += 16;
    doc.setTextColor(22, 163, 74); // green
    doc.text("Discount", totalsLabelX, ty);
    doc.text(`-${(bill.discount || 0).toFixed(2)}`, totalsValueX, ty, { align: "right" });
  }

  ty += 16;
  doc.setTextColor(110, 110, 110);
  doc.text("Taxable Amount", totalsLabelX, ty);
  doc.setTextColor(35, 35, 35);
  doc.text(bill.subtotal.toFixed(2), totalsValueX, ty, { align: "right" });

  ty += 16;
  doc.setTextColor(110, 110, 110);
  doc.text("CGST", totalsLabelX, ty);
  doc.setTextColor(35, 35, 35);
  doc.text(cgst.toFixed(2), totalsValueX, ty, { align: "right" });

  ty += 16;
  doc.setTextColor(110, 110, 110);
  doc.text("SGST", totalsLabelX, ty);
  doc.setTextColor(35, 35, 35);
  doc.text(sgst.toFixed(2), totalsValueX, ty, { align: "right" });

  if (roundOff !== 0) {
    ty += 14;
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text("Round Off", totalsLabelX, ty);
    doc.text(`${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}`, totalsValueX, ty, { align: "right" });
    doc.setFontSize(10);
  }

  ty += 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(totalsLabelX, ty, totalsValueX, ty);

  ty += 20;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primaryRgb);
  doc.text("Net Payable", totalsLabelX, ty);
  doc.text(`${RUPEE} ${netPayable.toFixed(2)}`, totalsValueX, ty, { align: "right" });
  
  if (bill.paymentMethod === "credit") {
    ty += 24;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text("Advance Paid", totalsLabelX, ty);
    doc.setTextColor(35, 35, 35);
    doc.text(`${RUPEE} ${bill.advanceAmount.toFixed(2)}`, totalsValueX, ty, { align: "right" });
    
    ty += 16;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38); // destructive red
    doc.text("Balance Due:", totalsLabelX, ty);
    doc.text(`${RUPEE} ${(netPayable - bill.advanceAmount).toFixed(2)}`, totalsValueX, ty, { align: "right" });
  } else {
    ty += 24;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text("Amount Paid", totalsLabelX, ty);
    doc.setTextColor(35, 35, 35);
    doc.text(`${RUPEE} ${netPayable.toFixed(2)}`, totalsValueX, ty, { align: "right" });
    
    ty += 16;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74); // success green
    doc.text("Balance:", totalsLabelX, ty);
    doc.text(`${RUPEE} 0.00`, totalsValueX, ty, { align: "right" });
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

  // ===== Footer & Page Numbers =====
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  
  const finalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= finalPages; i++) {
    doc.setPage(i);
    doc.text(
      `Thank you for choosing ${pharmacyName} - get well soon!`,
      pageWidth / 2,
      pageHeight - 32,
      { align: "center" },
    );
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${finalPages}`,
      pageWidth / 2,
      pageHeight - 18,
      { align: "center" }
    );
    doc.setFontSize(9);
  }

  doc.save(`${clean(bill.number) || "bill"}.pdf`);
}
