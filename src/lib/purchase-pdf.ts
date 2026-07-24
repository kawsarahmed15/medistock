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

export async function downloadPurchasePdf(
  purchase: Purchase,
  meta?: any,
  settings?: {
    pharmacyName?: string;
    pharmacyPhone?: string;
    pharmacyAddress?: string;
    gstNumber?: string;
    drugLicNo?: string;
    billColor?: string;
  }
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 20;
  const right = pageWidth - 20;

  const pharmacyName = settings?.pharmacyName || "MediStock Pharmacy";
  const pharmacyPhone = settings?.pharmacyPhone || "";
  const pharmacyAddress = settings?.pharmacyAddress || "";
  const gstNumber = settings?.gstNumber || "";
  const drugLicNo = settings?.drugLicNo || "";
  const billColor = settings?.billColor || "#1a9890";

  const hexToRgb = (hex: string): [number, number, number] => {
    const cleanHex = hex.replace("#", "");
    const num = parseInt(cleanHex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const primaryRgb = hexToRgb(billColor);

  // 1. Header
  let currentY = 40;

  const iconSize = 46;
  doc.setFillColor(...primaryRgb);
  doc.roundedRect(left, currentY, iconSize, iconSize, 6, 6, "F");

  // Draw the Pill logo as PNG via SVG
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`;
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
    img.src = "data:image/svg+xml;base64," + btoa(svgStr);
  });

  doc.addImage(pillBase64, "PNG", left + 8, currentY + 8, 30, 30);

  let headerLeftX = left + iconSize + 12;

  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(clean(pharmacyName).toUpperCase(), headerLeftX, currentY + 28);

  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let addrLines = pharmacyAddress ? doc.splitTextToSize(clean(pharmacyAddress), 220) : [];
  if (addrLines.length > 0) {
    doc.text(addrLines, headerLeftX, currentY + 42);
  }

  let headerBottomY = currentY + 42 + addrLines.length * 12;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  if (pharmacyPhone) {
    doc.text(`Phone: ${clean(pharmacyPhone)}`, headerLeftX, headerBottomY);
    headerBottomY += 12;
  }
  if (gstNumber) {
    doc.text(`GSTIN: ${clean(gstNumber.toUpperCase())}`, headerLeftX, headerBottomY);
    headerBottomY += 12;
  }
  if (drugLicNo) {
    doc.text(`D.L.No.: ${clean(drugLicNo.toUpperCase())}`, headerLeftX, headerBottomY);
    headerBottomY += 12;
  }

  // Right Side Header
  let rightY = currentY;
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("PURCHASE VOUCHER", right, rightY + 12, { align: "right" });

  rightY += 30;
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.text("Voucher No:", right - 160, rightY);
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.text(clean(purchase.number), right, rightY, { align: "right" });

  rightY += 12;
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.text("Invoice No:", right - 160, rightY);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "bold");
  doc.text(clean(purchase.supplierInvoice || "—"), right, rightY, { align: "right" });

  rightY += 12;
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.text("Date:", right - 160, rightY);
  doc.setTextColor(35, 35, 35);
  doc.text(new Date(purchase.createdAt).toLocaleDateString("en-IN"), right, rightY, {
    align: "right",
  });

  rightY += 12;
  doc.setTextColor(110, 110, 110);
  doc.text("Time:", right - 160, rightY);
  doc.setTextColor(35, 35, 35);
  doc.text(
    new Date(purchase.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    right,
    rightY,
    { align: "right" }
  );

  let y = Math.max(headerBottomY - 12, rightY) + 10;
  doc.setDrawColor(...primaryRgb);
  doc.setLineWidth(1.5);
  doc.line(left, y, right, y);

  // 2. Supplier Details Box
  y += 16;
  const custBoxTop = y;
  const supplierAddress = meta?.supplierAddress || "";
  let suppAddrLines = supplierAddress ? doc.splitTextToSize(clean(supplierAddress), pageWidth / 2 - 75) : [];
  
  const leftColHeight = 65 + suppAddrLines.length * 12;
  const logisticsHeight = 90; 
  
  const boxHeight = Math.max(leftColHeight, logisticsHeight);
  const custBoxBottom = custBoxTop + boxHeight + 10;

  // Draw background box
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(left, custBoxTop, pageWidth - left * 2, custBoxBottom - custBoxTop, 6, 6, "FD");
  doc.line(pageWidth / 2, custBoxTop, pageWidth / 2, custBoxBottom);

  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("SUPPLIER DETAILS", left + 12, custBoxTop + 14);

  const rightColX = pageWidth / 2 + 12;
  doc.text("INWARD LOGISTICS", rightColX, custBoxTop + 14);

  let cy = custBoxTop + 28;
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(11);
  doc.text(clean(purchase.supplierName).toUpperCase(), left + 12, cy);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let leftY = cy + 12;
  if (purchase.supplierPhone) {
    doc.setTextColor(110, 110, 110);
    doc.text(`PHONE: `, left + 12, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(purchase.supplierPhone), left + 65, leftY);
    leftY += 12;
  }
  if (meta?.supplierGst) {
    doc.setTextColor(110, 110, 110);
    doc.text(`GSTIN: `, left + 12, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(meta.supplierGst.toUpperCase()), left + 65, leftY);
    leftY += 12;
  }
  if (meta?.supplierDl) {
    doc.setTextColor(110, 110, 110);
    doc.text(`D.L.NO.: `, left + 12, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(meta.supplierDl.toUpperCase()), left + 65, leftY);
    leftY += 12;
  }
  if (suppAddrLines.length > 0) {
    doc.setTextColor(110, 110, 110);
    doc.text(`ADDRESS: `, left + 12, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(suppAddrLines, left + 65, leftY);
  }

  // Right column logistics text
  let rightSideYVal = cy;
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(`Payment Mode: `, rightColX, rightSideYVal);
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.text(purchase.paymentMethod.toUpperCase(), rightColX + 75, rightSideYVal);
  doc.setFont("helvetica", "normal");
  rightSideYVal += 14;

  if (meta?.transportName) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Transport: `, rightColX, rightSideYVal);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(meta.transportName.toUpperCase()), rightColX + 75, rightSideYVal);
    rightSideYVal += 12;
  }
  if (meta?.lrNumber) {
    doc.setTextColor(110, 110, 110);
    doc.text(`LR Number: `, rightColX, rightSideYVal);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(meta.lrNumber.toUpperCase()), rightColX + 75, rightSideYVal);
    rightSideYVal += 12;
  }
  if (purchase.paymentMethod === "credit" && meta?.dueDate) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Due Date: `, rightColX, rightSideYVal);
    doc.setTextColor(220, 38, 38); // Red
    doc.setFont("helvetica", "bold");
    doc.text(clean(meta.dueDate), rightColX + 75, rightSideYVal);
    doc.setFont("helvetica", "normal");
    rightSideYVal += 12;
  }
  
  y = custBoxBottom;

  // 3. Items Table
  autoTable(doc, {
    startY: y + 16,
    head: [
      ["#", "Medicine Name", "Pack", "Batch", "Exp.", "HSN", "Qty", "MRP", "GST", "Rate", "Amount"],
    ],
    body: purchase.items.map((it, idx) => {
      const line = it.costPrice * it.qty;
      const tax = (line * it.taxPercent) / 100;
      let nameStr = clean(it.name);

      return [
        String(idx + 1),
        nameStr,
        clean(it.pack ? it.pack.replace(/[*x]/gi, "X") : "-"),
        clean(String(it.batch || "-").toUpperCase()),
        it.expiry
          ? (() => {
              if (it.expiry.includes("-")) {
                const parts = it.expiry.split("-");
                if (parts.length >= 2) {
                  return `${parts[1]}/${parts[0].slice(-2)}`;
                }
              }
              return it.expiry;
            })()
          : "-",
        clean(it.hsn || "-"),
        String(it.qty) + (it.freeQty ? `+${it.freeQty}` : ""),
        it.mrp != null ? it.mrp.toFixed(2) : "-",
        `${it.taxPercent}%`,
        it.costPrice.toFixed(2),
        (line + tax).toFixed(2),
      ];
    }),
    styles: {
      fontSize: 7.5,
      cellPadding: 4,
      lineColor: [220, 220, 220],
      lineWidth: 0.5,
      textColor: [40, 40, 40],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [100, 116, 139],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 16, halign: "center" },
      1: { halign: "left" },
      2: { halign: "center", cellWidth: "wrap" },
      3: { halign: "center", cellWidth: "wrap" },
      4: { halign: "center", cellWidth: "wrap" },
      5: { halign: "center", cellWidth: "wrap" },
      6: { halign: "right", cellWidth: 26 },
      7: { halign: "right", cellWidth: 36 },
      8: { halign: "center", cellWidth: 28 },
      9: { halign: "right", cellWidth: 38 },
      10: { halign: "right", cellWidth: 46, fontStyle: "bold", textColor: primaryRgb },
    },
    margin: { left, right: 20 },
    theme: "grid",
  });

  const tableEndY = (doc as any).lastAutoTable?.finalY ?? 200;
  y = tableEndY + 20;

  // 4. Totals & Footer Info Area
  const netPayable = purchase.total;
  const roundOff = purchase.total - (purchase.subtotal + purchase.tax - (purchase.discount || 0));
  const cgst = purchase.tax / 2;
  const sgst = purchase.tax / 2;
  const totalQty = purchase.items.reduce((acc, item) => acc + item.qty, 0);
  const totalFree = purchase.items.reduce((acc, item) => acc + (item.freeQty || 0), 0);

  const leftWidth = (pageWidth - 80) * 0.55;
  let leftSideY = y;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(left, leftSideY, leftWidth, 50, 6, 6, "FD");

  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Total Items:", left + 12, leftSideY + 20);
  doc.setTextColor(35, 35, 35);
  doc.text(String(purchase.items.length), left + 75, leftSideY + 20);

  doc.setTextColor(110, 110, 110);
  doc.text("Total Qty:", left + 12, leftSideY + 36);
  doc.setTextColor(35, 35, 35);
  let qtyText = String(totalQty);
  doc.text(qtyText, left + 70, leftSideY + 36);
  if (totalFree > 0) {
    doc.setTextColor(...primaryRgb);
    doc.text(` (+${totalFree} Free)`, left + 70 + doc.getTextWidth(qtyText), leftSideY + 36);
  }

  leftSideY += 60;

  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setGState(new doc.GState({ opacity: 0.05 }));
  doc.roundedRect(left, leftSideY, leftWidth, 36, 6, 6, "F");
  doc.setGState(new doc.GState({ opacity: 1 }));
  doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.setGState(new doc.GState({ opacity: 0.1 }));
  doc.roundedRect(left, leftSideY, leftWidth, 36, 6, 6, "S");
  doc.setGState(new doc.GState({ opacity: 1 }));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...primaryRgb);
  doc.text("AMOUNT IN WORDS:", left + 10, leftSideY + 14);
  doc.setFontSize(9);
  doc.setTextColor(35, 35, 35);
  doc.text(numberToWords(netPayable), left + 10, leftSideY + 28);

  if (meta?.remarks) {
    leftSideY += 46;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(35, 35, 35);
    doc.text("REMARKS:", left, leftSideY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    const splitRemarks = doc.splitTextToSize(clean(meta.remarks), leftWidth - 10);
    doc.text(splitRemarks, left + 6, leftSideY + 22);
  }

  const rightWidth = (pageWidth - 80) * 0.4;
  const rightBoxLeft = right - rightWidth;
  const totalsValueX = right - 12;

  let rightSideY = y;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(rightBoxLeft, rightSideY, rightWidth, 150, 6, 6, "FD");

  let ty = rightSideY + 16;
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Gross Amount", rightBoxLeft + 12, ty);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "bold");
  doc.text((purchase.subtotal + (purchase.discount || 0)).toFixed(2), totalsValueX, ty, { align: "right" });

  if ((purchase.discount || 0) > 0) {
    ty += 16;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 163, 74); // green
    doc.text("Discount", rightBoxLeft + 12, ty);
    doc.setFont("helvetica", "bold");
    doc.text(`-${(purchase.discount || 0).toFixed(2)}`, totalsValueX, ty, { align: "right" });
  }

  ty += 16;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text("Taxable Amount", rightBoxLeft + 12, ty);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "bold");
  doc.text(purchase.subtotal.toFixed(2), totalsValueX, ty, { align: "right" });

  ty += 16;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text("CGST", rightBoxLeft + 12, ty);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "bold");
  doc.text(cgst.toFixed(2), totalsValueX, ty, { align: "right" });

  ty += 16;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text("SGST", rightBoxLeft + 12, ty);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "bold");
  doc.text(sgst.toFixed(2), totalsValueX, ty, { align: "right" });

  ty += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(rightBoxLeft + 12, ty, totalsValueX, ty);

  if (roundOff !== 0) {
    ty += 12;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text("Round Off", rightBoxLeft + 12, ty);
    doc.text(`${roundOff > 0 ? "+" : ""}${roundOff.toFixed(2)}`, totalsValueX, ty, {
      align: "right",
    });
    doc.setFontSize(9);
  }

  ty += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primaryRgb);
  doc.text("GRAND TOTAL", rightBoxLeft + 12, ty);
  doc.text(`Rs. ${netPayable.toFixed(2)}`, totalsValueX, ty, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(`Voucher generated dynamically by MediStock ERP`, pageWidth / 2, pageHeight - 30, { align: "center" });

  doc.save(`Voucher_${purchase.number}.pdf`);
}
