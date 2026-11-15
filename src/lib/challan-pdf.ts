import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SaleChallan } from "@/lib/storage";

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

  const val = Math.floor(Math.abs(num));
  if (val === 0) return "Zero Rupees Only";

  const isNegative = num < 0;
  const n = ("000000000" + val).slice(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return "";

  let str = "";
  str +=
    n[1] !== "00" ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "Crore " : "";
  str +=
    n[2] !== "00" ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "Lakh " : "";
  str +=
    n[3] !== "00"
      ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "Thousand "
      : "";
  str +=
    n[4] !== "0"
      ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "Hundred "
      : "";
  str +=
    n[5] !== "00"
      ? (str !== "" ? "and " : "") +
        (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any]) +
        "Rupees "
      : "Rupees ";
  return (isNegative ? "Minus " : "") + str.trim() + " Only";
}

const RUPEE = "Rs. ";

function clean(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u20B9/g, RUPEE)
    .replace(/[^\x20-\x7E]/g, "");
}

function formatDate(dStr?: string): string {
  if (!dStr) return "";
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    const day = String(d.getDate()).padStart(2, "0");
    const mon = String(d.getMonth() + 1).padStart(2, "0");
    const yr = d.getFullYear();
    return `${day}/${mon}/${yr}`;
  } catch {
    return dStr;
  }
}

export async function downloadChallanPdf(
  challan: SaleChallan,
  settings?: {
    pharmacyName?: string;
    pharmacyPhone?: string;
    pharmacyAddress?: string;
    gstNumber?: string;
    drugLicNo?: string;
    billColor?: string;
    signature?: string;
    print?: boolean;
  }
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 24;
  const right = pageWidth - 24;

  const pharmacyName = settings?.pharmacyName || challan.pharmacy?.name || "MediStock Pharmacy";
  const pharmacyPhone = settings?.pharmacyPhone || challan.pharmacy?.phone || "";
  const pharmacyAddress = settings?.pharmacyAddress || challan.pharmacy?.address || "";
  const gstNumber = settings?.gstNumber || challan.pharmacy?.gstin || "";
  const drugLicNo = settings?.drugLicNo || challan.pharmacy?.drugLicNo || "";
  const billColor = settings?.billColor || challan.pharmacy?.billColor || "#059669";
  const signature = settings?.signature || challan.pharmacy?.signature || "";

  const hexToRgb = (hex: string): [number, number, number] => {
    const cleanHex = hex.replace("#", "");
    const num = parseInt(cleanHex, 16);
    if (isNaN(num)) return [5, 150, 105];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const primaryRgb = hexToRgb(billColor);

  // 1. Top Prominent Notice Bar
  doc.setFillColor(245, 158, 11); // Amber badge banner
  doc.rect(left, 16, right - left, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    "SALE CHALLAN  –  NOT A TAX INVOICE  (TEMPORARY DELIVERY DOCUMENT)",
    pageWidth / 2,
    31,
    { align: "center" }
  );

  let currentY = 50;

  // 2. Pharmacy Logo & Company Info
  const iconSize = 44;
  doc.setFillColor(...primaryRgb);
  doc.roundedRect(left, currentY, iconSize, iconSize, 6, 6, "F");

  // Pill icon
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`;
  try {
    const pillBase64 = await new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve("");
      img.src = "data:image/svg+xml;base64," + btoa(svgStr);
    });
    if (pillBase64) {
      doc.addImage(pillBase64, "PNG", left + 7, currentY + 7, 30, 30);
    }
  } catch {
    // skip logo if image error
  }

  const headerLeftX = left + iconSize + 12;

  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(clean(pharmacyName).toUpperCase(), headerLeftX, currentY + 16);

  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const addrLines = pharmacyAddress ? doc.splitTextToSize(clean(pharmacyAddress), 240) : [];
  if (addrLines.length > 0) {
    doc.text(addrLines, headerLeftX, currentY + 28);
  }

  let phY = currentY + 28 + addrLines.length * 11;
  const contactParts: string[] = [];
  if (pharmacyPhone) contactParts.push(`Phone: ${clean(pharmacyPhone)}`);
  if (gstNumber) contactParts.push(`GSTIN: ${clean(gstNumber)}`);
  if (drugLicNo) contactParts.push(`D.L. No: ${clean(drugLicNo)}`);

  if (contactParts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(contactParts.join("  |  "), headerLeftX, phY);
  }

  // Right Top Box: Challan Details
  const challanBoxX = right - 190;
  const challanBoxWidth = 190;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(challanBoxX, currentY, challanBoxWidth, 68, 6, 6, "FD");

  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SALE CHALLAN", challanBoxX + 10, currentY + 16);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Challan No:", challanBoxX + 10, currentY + 32);
  doc.setFont("helvetica", "normal");
  doc.text(clean(challan.challanNumber), challanBoxX + 80, currentY + 32);

  doc.setFont("helvetica", "bold");
  doc.text("Date:", challanBoxX + 10, currentY + 46);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(challan.challanDate), challanBoxX + 80, currentY + 46);

  doc.setFont("helvetica", "bold");
  doc.text("Status:", challanBoxX + 10, currentY + 60);
  doc.setFont("helvetica", "bold");
  const st = (challan.status || "issued").toUpperCase().replace("_", " ");
  if (st === "ISSUED") doc.setTextColor(16, 185, 129);
  else if (st === "BILLED") doc.setTextColor(59, 130, 246);
  else if (st === "PARTIALLY BILLED") doc.setTextColor(245, 158, 11);
  else if (st === "CANCELLED") doc.setTextColor(239, 68, 68);
  else doc.setTextColor(100, 100, 100);
  doc.text(st, challanBoxX + 80, currentY + 60);

  currentY += 80;

  // 3. Customer Dispatch Details Section
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(left, currentY, right - left, 54, 4, 4, "FD");

  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("CONSIGNEE / CUSTOMER DISPATCH DETAILS", left + 10, currentY + 13);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8.5);

  // Left column: Customer Name & Mobile
  doc.setFont("helvetica", "bold");
  doc.text("Customer:", left + 10, currentY + 27);
  doc.setFont("helvetica", "normal");
  doc.text(clean(challan.customerName || "Counter Customer"), left + 65, currentY + 27);

  doc.setFont("helvetica", "bold");
  doc.text("Mobile:", left + 10, currentY + 42);
  doc.setFont("helvetica", "normal");
  doc.text(clean(challan.customerPhone || "—"), left + 65, currentY + 42);

  // Middle/Right column: Address & GSTIN
  doc.setFont("helvetica", "bold");
  doc.text("Address:", left + 240, currentY + 27);
  doc.setFont("helvetica", "normal");
  const custAddr = clean(challan.customerAddress || "—");
  const custAddrLines = doc.splitTextToSize(custAddr, 260);
  doc.text(custAddrLines, left + 290, currentY + 27);

  doc.setFont("helvetica", "bold");
  doc.text("GSTIN:", left + 240, currentY + 42);
  doc.setFont("helvetica", "normal");
  doc.text(clean(challan.customerGstin || "—"), left + 290, currentY + 42);

  currentY += 64;

  // 4. Products & Batches Table
  const tableHeaders = [
    [
      { content: "#", styles: { halign: "center" } },
      { content: "Product Description", styles: { halign: "left" } },
      { content: "Batch", styles: { halign: "left" } },
      { content: "Expiry", styles: { halign: "center" } },
      { content: "Qty", styles: { halign: "right" } },
      { content: "Free", styles: { halign: "right" } },
      { content: "MRP", styles: { halign: "right" } },
      { content: "Rate", styles: { halign: "right" } },
      { content: "Disc %", styles: { halign: "right" } },
      { content: "GST %", styles: { halign: "right" } },
      { content: "Total", styles: { halign: "right" } },
    ],
  ];

  const tableRows = challan.items.map((it, idx) => {
    let expDisplay = "";
    if (it.expiryDate) {
      const expDate = new Date(it.expiryDate);
      if (!isNaN(expDate.getTime())) {
        const mm = String(expDate.getMonth() + 1).padStart(2, "0");
        const yy = String(expDate.getFullYear()).slice(-2);
        expDisplay = `${mm}/${yy}`;
      } else {
        expDisplay = String(it.expiryDate).slice(0, 7);
      }
    }

    const mrpStr = it.mrp != null ? Number(it.mrp).toFixed(2) : "—";
    const rateStr = Number(it.rate || 0).toFixed(2);
    const discStr = Number(it.discountPercent || 0) > 0 ? `${Number(it.discountPercent)}%` : "0%";
    const gstStr = Number(it.taxPercent || 0) > 0 ? `${Number(it.taxPercent)}%` : "0%";
    const amtStr = Number(it.amount || 0).toFixed(2);

    return [
      String(idx + 1),
      clean(it.productName) + (it.pack ? ` (${clean(it.pack)})` : ""),
      clean(it.batchNo || "—"),
      expDisplay || "—",
      String(it.qty),
      String(it.freeQty || 0),
      mrpStr,
      rateStr,
      discStr,
      gstStr,
      amtStr,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: tableHeaders as any,
    body: tableRows,
    margin: { left, right: pageWidth - right },
    theme: "striped",
    headStyles: {
      fillColor: primaryRgb,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      cellPadding: 4.5,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: 160 },
      2: { cellWidth: 55 },
      3: { cellWidth: 42, halign: "center" },
      4: { cellWidth: 34, halign: "right", fontStyle: "bold" },
      5: { cellWidth: 30, halign: "right" },
      6: { cellWidth: 44, halign: "right" },
      7: { cellWidth: 44, halign: "right" },
      8: { cellWidth: 35, halign: "right" },
      9: { cellWidth: 35, halign: "right" },
      10: { cellWidth: 48, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 12;

  // 5. Total Calculation Summary Box
  const summaryBoxWidth = 210;
  const summaryBoxX = right - summaryBoxWidth;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryBoxX, finalY, summaryBoxWidth, 74, 4, 4, "FD");

  doc.setTextColor(70, 70, 70);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");

  doc.text("Subtotal (Taxable):", summaryBoxX + 10, finalY + 16);
  doc.text(`${RUPEE}${Number(challan.subtotal || 0).toFixed(2)}`, right - 10, finalY + 16, { align: "right" });

  doc.text("Discount:", summaryBoxX + 10, finalY + 30);
  doc.text(`- ${RUPEE}${Number(challan.discount || 0).toFixed(2)}`, right - 10, finalY + 30, { align: "right" });

  doc.text("GST Amount:", summaryBoxX + 10, finalY + 44);
  doc.text(`+ ${RUPEE}${Number(challan.tax || 0).toFixed(2)}`, right - 10, finalY + 44, { align: "right" });

  doc.setDrawColor(...primaryRgb);
  doc.line(summaryBoxX + 10, finalY + 52, right - 10, finalY + 52);

  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("Grand Total:", summaryBoxX + 10, finalY + 66);
  doc.text(`${RUPEE}${Number(challan.total || 0).toFixed(2)}`, right - 10, finalY + 66, { align: "right" });

  // 6. Left side: Amount in Words & Mandatory Declaration
  const leftBoxWidth = summaryBoxX - left - 16;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("Amount in Words:", left, finalY + 14);
  doc.setFont("helvetica", "normal");
  doc.text(numberToWords(Number(challan.total || 0)), left + 85, finalY + 14);

  // Terms / Delivery Declaration
  doc.setFillColor(254, 243, 199); // Soft amber background
  doc.setDrawColor(251, 191, 36);
  doc.roundedRect(left, finalY + 24, leftBoxWidth, 50, 4, 4, "FD");

  doc.setTextColor(146, 64, 14); // Amber 800
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("IMPORTANT DELIVERY NOTICE & DECLARATION:", left + 8, finalY + 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("1. This is a temporary Delivery Challan for dispatch of goods, NOT a Tax Invoice.", left + 8, finalY + 47);
  doc.text("2. Inventory items are reserved. Actual tax invoice will be generated upon final confirmation.", left + 8, finalY + 57);
  doc.text("3. Goods received in good condition. Claims, if any, must be reported within 24 hours.", left + 8, finalY + 67);

  // 7. Signature Section
  const signY = finalY + 95;

  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([2, 2], 0);

  // Receiver's signature
  doc.line(left, signY + 30, left + 140, signY + 30);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Receiver's Signature", left, signY + 42);

  // Authorized Signatory
  doc.line(right - 160, signY + 30, right, signY + 30);
  doc.text(`For ${clean(pharmacyName)}`, right - 160, signY + 42);
  doc.setFont("helvetica", "bold");
  doc.text("Authorized Signatory", right - 160, signY + 54);

  // Digital Signature Image if available
  if (signature) {
    try {
      doc.addImage(signature, "PNG", right - 150, signY - 5, 80, 32);
    } catch {
      // ignore
    }
  }

  // 8. Bottom Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Sale Challan: ${challan.challanNumber} | Generated on ${new Date().toLocaleString()} | Powered by MediStock ERP`,
    pageWidth / 2,
    pageHeight - 16,
    { align: "center" }
  );

  // Save or Print
  if (settings?.print) {
    doc.autoPrint();
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl, "_blank");
  } else {
    doc.save(`Sale_Challan_${challan.challanNumber}.pdf`);
  }
}

export async function printChallanPdf(challan: SaleChallan, settings?: any) {
  return downloadChallanPdf(challan, { ...settings, print: true });
}
