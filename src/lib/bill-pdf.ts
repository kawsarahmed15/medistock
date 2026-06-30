import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Bill } from "@/lib/storage";
import QRCode from "qrcode";

function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const val = Math.floor(num);
  if (val === 0) return 'Zero Rupees Only';
  
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

  const pharmacyName = settings?.pharmacyName || "MediStock Pharmacy";
  const pharmacyAddress = settings?.pharmacyAddress || "123 Health Ave, Medical District, City";
  const gstNumber = settings?.gstNumber || "";
  const drugLicNo = settings?.drugLicNo || "";
  const billColor = settings?.billColor || "#1a9890";
  const signature = settings?.signature || "";

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
  
  // 1. Header
  let currentY = 40;
  
  const iconSize = 46;
  doc.setFillColor(...primaryRgb);
  doc.roundedRect(left, currentY, iconSize, iconSize, 6, 6, "F");
  
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(4);
  doc.roundedRect(left + 12, currentY + 12, 22, 22, 11, 11, "S");
  doc.setLineWidth(2);
  doc.line(left + 14, currentY + 32, left + 32, currentY + 14);

  let headerLeftX = left + iconSize + 12;
  
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(clean(pharmacyName).toUpperCase(), headerLeftX, currentY + 16);
  
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let addrLines = doc.splitTextToSize(clean(pharmacyAddress), 220);
  doc.text(addrLines, headerLeftX, currentY + 30);
  
  let headerBottomY = currentY + 30 + (addrLines.length * 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  let gstDlText = "";
  if (gstNumber) gstDlText += `GSTIN: ${clean(gstNumber.toUpperCase())}   `;
  if (drugLicNo) gstDlText += `DL No: ${clean(drugLicNo.toUpperCase())}`;
  if (gstDlText) {
    doc.text(gstDlText, headerLeftX, headerBottomY);
  }

  // Right Side Header
  let rightY = currentY;
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TAX INVOICE", right, rightY + 12, { align: "right" });
  
  rightY += 30;
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.text("Inv No:", right - 60, rightY);
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.text(clean(bill.number), right, rightY, { align: "right" });
  
  rightY += 12;
  doc.setTextColor(110, 110, 110);
  doc.setFont("helvetica", "normal");
  doc.text("Date:", right - 60, rightY);
  doc.setTextColor(35, 35, 35);
  doc.text(new Date(bill.createdAt).toLocaleDateString('en-IN'), right, rightY, { align: "right" });
  
  rightY += 12;
  doc.setTextColor(110, 110, 110);
  doc.text("Time:", right - 60, rightY);
  doc.setTextColor(35, 35, 35);
  doc.text(new Date(bill.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), right, rightY, { align: "right" });
  
  rightY += 12;
  doc.setTextColor(110, 110, 110);
  doc.text("Cashier:", right - 60, rightY);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "bold");
  doc.text(clean(bill.cashier) || "Admin", right, rightY, { align: "right" });
  
  let y = Math.max(headerBottomY, rightY) + 16;
  doc.setDrawColor(...primaryRgb);
  doc.setLineWidth(1.5);
  doc.line(left, y, right, y);

  // 2. Customer Details Box
  y += 16;
  const custBoxTop = y;
  
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("CUSTOMER DETAILS", left + 12, y + 14);
  doc.text("PRESCRIPTION INFO", left + (pageWidth/2) - 10, y + 14);

  let cy = y + 28;
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(11);
  doc.text((clean(bill.customerName) || "Walk-in customer").toUpperCase(), left + 12, cy);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Doctor: ", left + (pageWidth/2) - 10, cy);
  doc.setTextColor(35, 35, 35);
  doc.text(bill.customerNotes ? "See Notes" : "N/A", left + (pageWidth/2) + 25, cy);

  let leftY = cy + 14;
  if (bill.customerPhone) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Phone: `, left + 12, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(bill.customerPhone), left + 45, leftY);
    leftY += 14;
  }
  
  if (bill.customerAddress) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Address: `, left + 12, leftY);
    doc.setTextColor(35, 35, 35);
    const custAddrLines = doc.splitTextToSize(clean(bill.customerAddress), (pageWidth/2) - 60);
    doc.text(custAddrLines, left + 55, leftY);
    leftY += custAddrLines.length * 12;
  }

  if (bill.customerDrugLicNo) {
    doc.setTextColor(110, 110, 110);
    doc.text(`DL: `, left + 12, leftY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(35, 35, 35);
    doc.text(clean(bill.customerDrugLicNo.toUpperCase()), left + 30, leftY);
    doc.setFont("helvetica", "normal");
    leftY += 14;
  }

  rightY = cy + 14;
  doc.setTextColor(110, 110, 110);
  doc.text(`Payment Mode: `, left + (pageWidth/2) - 10, rightY);
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.text(bill.paymentMethod.toUpperCase(), left + (pageWidth/2) + 60, rightY);
  doc.setFont("helvetica", "normal");
  rightY += 14;

  if (bill.customerNotes) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(110, 110, 110);
    const splitNotes = doc.splitTextToSize(clean(bill.customerNotes), (pageWidth/2) - 30);
    doc.text(splitNotes, left + (pageWidth/2) - 10, rightY);
    rightY += splitNotes.length * 12;
    doc.setFont("helvetica", "normal");
  }

  let custBoxBottom = Math.max(leftY, rightY) + 8;
  
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.setFillColor(248, 250, 252); 
  doc.roundedRect(left, custBoxTop, pageWidth - (left * 2), custBoxBottom - custBoxTop, 6, 6, "FD");
  doc.line(pageWidth/2 - 20, custBoxTop, pageWidth/2 - 20, custBoxBottom);
  
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("CUSTOMER DETAILS", left + 12, custBoxTop + 14);
  doc.text("PRESCRIPTION INFO", left + (pageWidth/2) - 10, custBoxTop + 14);

  cy = custBoxTop + 28;
  doc.setTextColor(35, 35, 35);
  doc.setFontSize(11);
  doc.text((clean(bill.customerName) || "Walk-in customer").toUpperCase(), left + 12, cy);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Doctor: ", left + (pageWidth/2) - 10, cy);
  doc.setTextColor(35, 35, 35);
  doc.text(bill.customerNotes ? "See Notes" : "N/A", left + (pageWidth/2) + 25, cy);

  leftY = cy + 14;
  if (bill.customerPhone) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Phone: `, left + 12, leftY);
    doc.setTextColor(35, 35, 35);
    doc.text(clean(bill.customerPhone), left + 45, leftY);
    leftY += 14;
  }
  
  if (bill.customerAddress) {
    doc.setTextColor(110, 110, 110);
    doc.text(`Address: `, left + 12, leftY);
    doc.setTextColor(35, 35, 35);
    const custAddrLines = doc.splitTextToSize(clean(bill.customerAddress), (pageWidth/2) - 60);
    doc.text(custAddrLines, left + 55, leftY);
    leftY += custAddrLines.length * 12;
  }

  if (bill.customerDrugLicNo) {
    doc.setTextColor(110, 110, 110);
    doc.text(`DL: `, left + 12, leftY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(35, 35, 35);
    doc.text(clean(bill.customerDrugLicNo.toUpperCase()), left + 30, leftY);
    doc.setFont("helvetica", "normal");
  }

  rightY = cy + 14;
  doc.setTextColor(110, 110, 110);
  doc.text(`Payment Mode: `, left + (pageWidth/2) - 10, rightY);
  doc.setTextColor(...primaryRgb);
  doc.setFont("helvetica", "bold");
  doc.text(bill.paymentMethod.toUpperCase(), left + (pageWidth/2) + 60, rightY);
  doc.setFont("helvetica", "normal");
  rightY += 14;

  if (bill.customerNotes) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(110, 110, 110);
    const splitNotes = doc.splitTextToSize(clean(bill.customerNotes), (pageWidth/2) - 30);
    doc.text(splitNotes, left + (pageWidth/2) - 10, rightY);
  }

  y = custBoxBottom;

  // 3. Items Table
  autoTable(doc, {
    startY: y + 16,
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
          const yr = String(d.getFullYear()).slice(-2);
          return `${m}/${yr}`;
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
      fontSize: 8,
      cellPadding: 5,
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

  const tableEndY = (doc as any).lastAutoTable?.finalY ?? 200;
  y = tableEndY + 20;

  // 4. Totals & Footer Info Area
  const netPayable = Math.round(bill.total);
  const roundOff = netPayable - bill.total;
  const cgst = bill.tax / 2;
  const sgst = bill.tax / 2;
  const totalQty = bill.items.reduce((acc, item) => acc + item.qty, 0);
  const totalFree = bill.items.reduce((acc, item) => acc + (item.freeQty || 0), 0);

  const leftWidth = (pageWidth - 80) * 0.55;
  let leftSideY = y;
  
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(left, leftSideY, leftWidth, 50, 6, 6, "FD");
  
  try {
    const qrDataUrl = await QRCode.toDataURL(bill.number, { margin: 1, width: 40 });
    doc.addImage(qrDataUrl, "PNG", left + 6, leftSideY + 5, 40, 40);
  } catch(e) {}
  
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Total Items:", left + 56, leftSideY + 20);
  doc.setTextColor(35, 35, 35);
  doc.text(String(bill.items.length), left + 110, leftSideY + 20);
  
  doc.setTextColor(110, 110, 110);
  doc.text("Total Qty:", left + 56, leftSideY + 36);
  doc.setTextColor(35, 35, 35);
  let qtyText = String(totalQty);
  doc.text(qtyText, left + 105, leftSideY + 36);
  if (totalFree > 0) {
    doc.setTextColor(...primaryRgb);
    doc.text(` (+${totalFree} Free)`, left + 105 + doc.getTextWidth(qtyText), leftSideY + 36);
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
  
  leftSideY += 46;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(35, 35, 35);
  doc.text("TERMS & CONDITIONS:", left, leftSideY + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text("• Goods once sold will not be taken back or exchanged.", left + 6, leftSideY + 22);
  doc.text("• Please consult your doctor before using the medicines.", left + 6, leftSideY + 34);
  doc.text("• Keep medicines out of reach of children.", left + 6, leftSideY + 46);

  const rightWidth = (pageWidth - 80) * 0.40;
  const rightBoxLeft = right - rightWidth;
  const totalsLabelX = right - 70;
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
  doc.text((bill.subtotal + (bill.discount || 0)).toFixed(2), totalsValueX, ty, { align: "right" });
  
  if ((bill.discount || 0) > 0) {
    ty += 16;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 163, 74); // green
    doc.text("Discount", rightBoxLeft + 12, ty);
    doc.setFont("helvetica", "bold");
    doc.text(`-${(bill.discount || 0).toFixed(2)}`, totalsValueX, ty, { align: "right" });
  }

  ty += 16;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text("Taxable Amount", rightBoxLeft + 12, ty);
  doc.setTextColor(35, 35, 35);
  doc.setFont("helvetica", "bold");
  doc.text(bill.subtotal.toFixed(2), totalsValueX, ty, { align: "right" });

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
    doc.text(`${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}`, totalsValueX, ty, { align: "right" });
    doc.setFontSize(9);
  }

  ty += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...primaryRgb);
  doc.text("NET PAYABLE", rightBoxLeft + 12, ty);
  doc.text(`Rs. ${netPayable.toFixed(2)}`, totalsValueX, ty, { align: "right" });
  
  ty += 8;
  doc.setDrawColor(220, 220, 220);
  doc.line(rightBoxLeft + 12, ty, totalsValueX, ty);

  ty += 14;
  if (bill.paymentMethod === "credit") {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text("Advance Paid", rightBoxLeft + 12, ty);
    doc.setTextColor(35, 35, 35);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${bill.advanceAmount.toFixed(2)}`, totalsValueX, ty, { align: "right" });
    
    ty += 14;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text("Balance Due", rightBoxLeft + 12, ty);
    doc.text(`Rs. ${(netPayable - bill.advanceAmount).toFixed(2)}`, totalsValueX, ty, { align: "right" });
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 110, 110);
    doc.text("Amount Paid", rightBoxLeft + 12, ty);
    doc.setTextColor(35, 35, 35);
    doc.setFont("helvetica", "bold");
    doc.text(`Rs. ${netPayable.toFixed(2)}`, totalsValueX, ty, { align: "right" });
    
    ty += 14;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text("Balance", rightBoxLeft + 12, ty);
    doc.text(`Rs. 0.00`, totalsValueX, ty, { align: "right" });
  }

  // 5. Signatures (Placed at bottom of last page)
  let sigY = Math.max(leftSideY + 50, rightSideY + 160) + 40;
  
  const footerSpace = 100;
  if (sigY > pageHeight - footerSpace) {
    doc.addPage();
    sigY = 50;
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  
  // Left: Customer Sig
  doc.line(left, sigY, left + 120, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text("Customer Signature", left + 15, sigY + 12);
  
  // Right: Authorized Sig
  doc.line(right - 140, sigY, right, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...primaryRgb);
  doc.text(`FOR ${clean(pharmacyName).toUpperCase()}`, right - 70, sigY - 10, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text("Authorized Signatory", right - 70, sigY + 12, { align: "center" });

  if (signature) {
    try {
      doc.addImage(signature, "PNG", right - 120, sigY - 55, 100, 45);
    } catch (err) {}
  }

  // 6. Absolute Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    doc.setDrawColor(230, 230, 230);
    doc.line(left, pageHeight - 40, right, pageHeight - 40);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text("THANK YOU FOR YOUR BUSINESS. GET WELL SOON!", pageWidth / 2, pageHeight - 24, { align: "center" });
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${totalPages}`, right, pageHeight - 24, { align: "right" });
  }

  doc.save(`${clean(bill.number) || "bill"}.pdf`);
}
