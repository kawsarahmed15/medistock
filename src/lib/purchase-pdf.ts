import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Purchase } from "@/lib/storage";

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

const RUPEE = "Rs.";

function clean(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u20B9/g, RUPEE)
    .replace(/[^\x20-\x7E]/g, "");
}

export async function downloadPurchasePdf(purchase: Purchase, meta?: any) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 20;
  const right = pageWidth - 20;

  let currentY = 40;

  // Primary Color: Sleek Navy
  const primaryRgb: [number, number, number] = [26, 82, 118];
  
  // Header Box
  doc.setFillColor(...primaryRgb);
  doc.roundedRect(left, currentY, 46, 46, 6, 6, "F");

  // Simple Pill Icon on PDF
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("+", left + 16, currentY + 30);

  // Voucher Title
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PURCHASE INWARD RECORD", left + 58, currentY + 18);

  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Voucher generated upon supplier invoice intake.", left + 58, currentY + 32);

  // Purchase info (Top Right)
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Voucher No: ${purchase.number}`, right - 180, currentY + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Invoice No: ${purchase.supplierInvoice || "N/A"}`, right - 180, currentY + 26);
  doc.text(`Date: ${new Date(purchase.createdAt).toLocaleDateString("en-IN")}`, right - 180, currentY + 38);

  currentY += 60;
  doc.setDrawColor(220, 220, 220);
  doc.line(left, currentY, right, currentY);

  // Supplier & Logistics Info Section
  currentY += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...primaryRgb);
  doc.text("SUPPLIER / DISTRIBUTOR", left, currentY);
  doc.text("INWARD LOGISTICS", right - 220, currentY);

  currentY += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(clean(purchase.supplierName).toUpperCase(), left, currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (purchase.supplierPhone) {
    doc.text(`Phone: ${purchase.supplierPhone}`, left, currentY + 14);
  }
  if (meta?.supplierGst) {
    doc.text(`GSTIN: ${meta.supplierGst.toUpperCase()}`, left, currentY + 26);
  }
  if (meta?.supplierDl) {
    doc.text(`Drug Lic: ${meta.supplierDl.toUpperCase()}`, left, currentY + 38);
  }
  if (meta?.supplierAddress) {
    let addrLines = doc.splitTextToSize(clean(meta.supplierAddress), 220);
    doc.text(addrLines, left, currentY + 50);
  }

  // Logistics details
  let logisticsY = currentY;
  doc.setTextColor(100, 100, 100);
  doc.text(`Payment Method: ${clean(purchase.paymentMethod).toUpperCase()}`, right - 220, logisticsY);
  if (meta?.transportName) {
    doc.text(`Transport: ${meta.transportName.toUpperCase()}`, right - 220, logisticsY + 12);
  }
  if (meta?.lrNumber) {
    doc.text(`LR Number: ${meta.lrNumber.toUpperCase()}`, right - 220, logisticsY + 24);
  }
  if (purchase.paymentMethod === "credit" && meta?.dueDate) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 50, 50);
    doc.text(`Payment Due Date: ${meta.dueDate}`, right - 220, logisticsY + 38);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
  }

  currentY += 80;

  // Table Items
  const headers = [["#", "Medicine Name", "Batch No.", "HSN Code", "Expiry", "Qty", "Free", "MRP", "Rate", "GST", "Amount"]];
  
  const body = purchase.items.map((it, idx) => {
    const lineAmount = it.costPrice * it.qty;
    const taxAmount = (lineAmount * it.taxPercent) / 100;
    return [
      idx + 1,
      clean(it.name),
      String(it.batch || "—").toUpperCase(),
      String(it.hsn || "—").toUpperCase(),
      it.expiry ? it.expiry.substring(0, 7) : "—",
      it.qty,
      it.freeQty || 0,
      `Rs.${(it.mrp || 0).toFixed(2)}`,
      `Rs.${it.costPrice.toFixed(2)}`,
      `${it.taxPercent}%`,
      `Rs.${(lineAmount + taxAmount).toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: headers,
    body: body,
    theme: "striped",
    headStyles: {
      fillColor: primaryRgb,
      textColor: [255, 255, 255],
      fontSize: 8,
      halign: "left"
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50]
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 150 },
      2: { cellWidth: 60 },
      3: { cellWidth: 50 },
      4: { cellWidth: 45 },
      5: { cellWidth: 30, halign: "right" },
      6: { cellWidth: 30, halign: "right" },
      7: { cellWidth: 50, halign: "right" },
      8: { cellWidth: 50, halign: "right" },
      9: { cellWidth: 30, halign: "center" },
      10: { cellWidth: 60, halign: "right" }
    },
    margin: { left: left, right: pageWidth - right }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 20;

  // Summary and Calculations
  const cgst = purchase.tax / 2;
  const sgst = purchase.tax / 2;

  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  
  // Left: Amount in Words / Remarks
  doc.setFont("helvetica", "bold");
  doc.text("Amount in Words:", left, finalY);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(numberToWords(purchase.total), 280), left, finalY + 12);

  if (meta?.remarks) {
    doc.setFont("helvetica", "bold");
    doc.text("Remarks:", left, finalY + 45);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(clean(meta.remarks), 280), left, finalY + 57);
  }

  // Right: Price Summary Box
  const summaryLeftX = right - 180;
  doc.text("Subtotal (Taxable):", summaryLeftX, finalY);
  doc.text(`Rs.${purchase.subtotal.toFixed(2)}`, right, finalY, { align: "right" });

  doc.text("CGST:", summaryLeftX, finalY + 12);
  doc.text(`Rs.${cgst.toFixed(2)}`, right, finalY + 12, { align: "right" });

  doc.text("SGST:", summaryLeftX, finalY + 24);
  doc.text(`Rs.${sgst.toFixed(2)}`, right, finalY + 24, { align: "right" });

  if (purchase.discount > 0) {
    doc.text("Discount:", summaryLeftX, finalY + 36);
    doc.text(`-Rs.${purchase.discount.toFixed(2)}`, right, finalY + 36, { align: "right" });
  }

  const offsetTotalY = purchase.discount > 0 ? 48 : 36;
  doc.setDrawColor(220, 220, 220);
  doc.line(summaryLeftX, finalY + offsetTotalY - 6, right, finalY + offsetTotalY - 6);

  doc.setFont("helvetica", "bold");
  doc.text("GRAND TOTAL:", summaryLeftX, finalY + offsetTotalY + 6);
  doc.text(`Rs.${purchase.total.toFixed(2)}`, right, finalY + offsetTotalY + 6, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(`Voucher generated dynamically by MediStock ERP`, pageWidth / 2, pageHeight - 30, { align: "center" });

  doc.save(`Voucher_${purchase.number}.pdf`);
}
