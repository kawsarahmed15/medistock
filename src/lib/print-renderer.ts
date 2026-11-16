import {
  ALL_PRINT_COLUMNS,
  PrinterSettings,
  PrintCustomization,
  PrintColumnKey,
  PaperPreset,
} from "./printer-settings";

function escapeHtml(str: string | number | undefined | null): string {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
    n[1] !== "00"
      ? (a[Number(n[1])] || b[Number(n[1][0])] + " " + a[Number(n[1][1])]) + "Crore "
      : "";
  str +=
    n[2] !== "00"
      ? (a[Number(n[2])] || b[Number(n[2][0])] + " " + a[Number(n[2][1])]) + "Lakh "
      : "";
  str +=
    n[3] !== "00"
      ? (a[Number(n[3])] || b[Number(n[3][0])] + " " + a[Number(n[3][1])]) + "Thousand "
      : "";
  str +=
    n[4] !== "0"
      ? (a[Number(n[4])] || b[Number(n[4][0])] + " " + a[Number(n[4][1])]) + "Hundred "
      : "";
  str +=
    n[5] !== "00"
      ? (str !== "" ? "and " : "") +
        (a[Number(n[5])] || b[Number(n[5][0])] + " " + a[Number(n[5][1])]) +
        "Rupees "
      : "Rupees ";

  const paise = Math.round((Math.abs(num) - val) * 100);
  let paiseStr = "";
  if (paise > 0) {
    paiseStr =
      " and " +
      (a[paise] || b[Math.floor(paise / 10)] + " " + a[paise % 10]).trim() +
      " Paise";
  }

  return (isNegative ? "Minus " : "") + str.trim() + paiseStr + " Only";
}

export function renderBillHtml(
  bill: any,
  settings: PrinterSettings,
  options?: { isSample?: boolean; watermark?: string; copies?: number },
): string {
  const cust = settings.customization;
  const color = cust.primaryColor || "#0a5c55";
  const font = cust.fontFamily || "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  const density = cust.fontSize || "regular";
  const paperPreset = cust.paperPreset || settings.paperPreset || "HALF_A4_SINGLE";
  const templateId = cust.templateId || "tmpl-ref-2-modern-ledger";

  const fontSizeBase =
    density === "compact" ? "11px" : density === "comfortable" ? "13px" : "12px";

  // Filter columns
  const activeColumns = ALL_PRINT_COLUMNS.filter((col) => {
    if (col.required) return true;
    return cust.columns ? cust.columns[col.key] !== false : true;
  });
  const totalWeight = activeColumns.reduce((sum, col) => sum + col.weight, 0);
  const columnWidths = activeColumns.map(
    (col) => ((col.weight / totalWeight) * 100).toFixed(1) + "%",
  );

  // Common bill fields
  const invoiceNo = bill.number || "INV-0001";
  const invoiceDate = bill.createdAt
    ? new Date(bill.createdAt).toLocaleDateString("en-IN")
    : new Date().toLocaleDateString("en-IN");
  const invoiceTime = bill.createdAt
    ? new Date(bill.createdAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const pharmacyName = bill.pharmacyName || "MediStock Pharmacy & Healthcare";
  const pharmacyAddress = bill.pharmacyAddress || "";
  const pharmacyPhone = bill.pharmacyPhone || "";
  const pharmacyGstNumber = bill.pharmacyGstNumber || "";
  const pharmacyDrugLicNo = bill.pharmacyDrugLicNo || "";

  const customerName = bill.customerName || "M/S MEDILAND";
  const customerPhone = bill.customerPhone || "";
  const customerAddress = bill.customerAddress || "";
  const customerGstin = bill.customerGstin || "";
  const customerDrugLicNo = bill.customerDrugLicNo || "";
  const transport = (bill as any).transport || cust.transportText || "Direct / By Hand";
  const paymentMethod = (bill.paymentMethod || "credit").toUpperCase();

  const items = Array.isArray(bill.items) ? bill.items : [];
  const subtotal = Number(bill.subtotal || 0);
  const discount = Number(bill.discount || 0);
  const tax = Number(bill.tax || 0);
  const total = Number(bill.total || 0);
  const advanceAmount = Number(bill.advanceAmount || 0);
  const balanceDue = Math.max(0, total - advanceAmount);
  const cgst = tax / 2;
  const sgst = tax / 2;
  const grossAmount = subtotal + discount;

  const totalQty = items.reduce((s: number, it: any) => s + (Number(it.qty) || 0), 0);
  const totalFree = items.reduce((s: number, it: any) => s + (Number(it.freeQty) || 0), 0);

  const amountInWords = numberToWords(total);

  // Calibration and margins
  const mTop = settings.marginsMm.top ?? 5;
  const mBottom = settings.marginsMm.bottom ?? 5;
  const mLeft = settings.marginsMm.left ?? 5;
  const mRight = settings.marginsMm.right ?? 5;
  const xOffset = settings.calibrationMm.xOffset ?? 0;
  const yOffset = settings.calibrationMm.yOffset ?? 0;

  // Page geometry styling based on preset
  let pageSizeCss = "size: 210mm 148mm; margin: 0;";
  let containerDimensions = "width: 210mm; min-height: 148mm;";

  if (paperPreset === "A4_PORTRAIT" || templateId === "tmpl-original-a4") {
    pageSizeCss = "size: 210mm 297mm; margin: 0;";
    containerDimensions = "width: 210mm; min-height: 297mm;";
  } else if (paperPreset === "THERMAL_80MM" || templateId === "tmpl-thermal-80mm") {
    pageSizeCss = "size: 80mm auto; margin: 0;";
    containerDimensions = "width: 78mm; min-height: auto; font-family: 'Courier New', monospace;";
  } else if (paperPreset === "A4_DUAL_COPY") {
    pageSizeCss = "size: 210mm 297mm; margin: 0;";
    containerDimensions = "width: 210mm; min-height: 297mm;";
  }

  // QR Code generator helper (SVG)
  const qrSvg = cust.showQrCode
    ? `<div style="display: inline-flex; align-items: center; justify-content: center; background: #fff; padding: 2px; border: 1px solid #cbd5e1; border-radius: 4px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/><path d="M12 7v10"/><path d="M7 12h10"/>
        </svg>
      </div>`
    : "";

  // Render Items Table Rows
  const renderItemRow = (it: any, idx: number) => {
    const isReturned = (Number(it.qty) || 0) < 0 || it.isReturnItem;
    const expDate = it.expiry
      ? (() => {
          try {
            const d = new Date(it.expiry);
            return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
          } catch {
            return String(it.expiry);
          }
        })()
      : "-";

    const unitPrice = Number(it.price || it.unitRate || 0);
    const itemQty = Number(it.qty || 0);
    const lineAmount = unitPrice * itemQty;
    const itemMrp = it.mrp != null ? Number(it.mrp).toFixed(2) : "-";
    const itemTax = it.taxPercent != null ? `${it.taxPercent}%` : "12%";
    const itemDisc = it.discountPct ? `${it.discountPct}%` : "0%";

    return `
      <tr style="border-bottom: 0.15mm solid #e2e8f0; ${isReturned ? "background-color: #fffbeb;" : ""}">
        ${activeColumns
          .map((col, cIdx) => {
            let content = "";
            switch (col.key) {
              case "srNo":
                content = `${idx + 1}`;
                break;
              case "productName":
                content = `<strong>${escapeHtml(it.name || it.productName)}</strong>${
                  isReturned
                    ? ` <span style="font-size: 8px; color: #b45309; border: 1px solid #fde68a; padding: 1px 3px; border-radius: 2px;">RETURN</span>`
                    : ""
                }`;
                break;
              case "pack":
                content = escapeHtml(it.pack || "-");
                break;
              case "batch":
                content = `<span style="font-family: monospace; font-size: 9px; text-transform: uppercase;">${escapeHtml(it.batch || "-")}</span>`;
                break;
              case "expiry":
                content = `<span style="font-family: monospace; font-size: 9px;">${expDate}</span>`;
                break;
              case "hsn":
                content = `<span style="font-family: monospace; font-size: 9px;">${escapeHtml(it.sku || it.hsn || "-")}</span>`;
                break;
              case "qty":
                content = `<strong>${itemQty}</strong>`;
                break;
              case "freeQty":
                content = `${it.freeQty || 0}`;
                break;
              case "mrp":
                content = `<span style="font-family: monospace;">${itemMrp}</span>`;
                break;
              case "unitRate":
                content = `<span style="font-family: monospace;">${unitPrice.toFixed(2)}</span>`;
                break;
              case "discountPct":
                content = itemDisc;
                break;
              case "gstPct":
                content = itemTax;
                break;
              case "netAmount":
                content = `<strong style="font-family: monospace; color: ${color};">${lineAmount.toFixed(2)}</strong>`;
                break;
            }
            return `<td style="padding: 3px 4px; text-align: ${col.align}; font-size: ${
              density === "compact" ? "9px" : "10px"
            }; vertical-align: top; border-left: ${
              cIdx === 0 ? "0" : "0.15mm solid #f1f5f9"
            };">${content}</td>`;
          })
          .join("")}
      </tr>
    `;
  };

  // Build Bill Template Inner Content
  const buildSingleBillContent = (copyLabel?: string) => {
    // 1. THERMAL 80MM
    if (paperPreset === "THERMAL_80MM" || templateId === "tmpl-thermal-80mm") {
      return `
        <div style="width: 100%; font-size: 10px; line-height: 1.3; color: #000; font-family: 'Courier New', monospace;">
          <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;">
            <div style="font-size: 14px; font-weight: bold;">${escapeHtml(pharmacyName)}</div>
            ${pharmacyAddress ? `<div style="font-size: 9px;">${escapeHtml(pharmacyAddress)}</div>` : ""}
            ${pharmacyPhone ? `<div>Tel: ${escapeHtml(pharmacyPhone)}</div>` : ""}
            ${pharmacyGstNumber ? `<div>GSTIN: ${escapeHtml(pharmacyGstNumber)}</div>` : ""}
            ${pharmacyDrugLicNo ? `<div>DL: ${escapeHtml(pharmacyDrugLicNo)}</div>` : ""}
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 4px;">
            <div><strong>Inv:</strong> ${escapeHtml(invoiceNo)}</div>
            <div>${invoiceDate} ${invoiceTime}</div>
          </div>
          <div style="font-size: 8.5px; margin-bottom: 5px; border-bottom: 1px dashed #000; padding-bottom: 3px; line-height: 1.35;">
            <div style="font-weight: bold; font-size: 8px; text-transform: uppercase;">CUSTOMER DETAILS</div>
            <div style="font-weight: bold; font-size: 10px; text-transform: uppercase;">${escapeHtml(customerName)}</div>
            ${customerPhone ? `<div>PHONE: ${escapeHtml(customerPhone)}</div>` : ""}
            ${customerDrugLicNo ? `<div>D.L.NO.: ${escapeHtml(customerDrugLicNo.toUpperCase())}</div>` : ""}
            ${customerGstin ? `<div>GSTIN: ${escapeHtml(customerGstin.toUpperCase())}</div>` : ""}
            ${customerAddress ? `<div>ADDRESS: ${escapeHtml(customerAddress)}</div>` : ""}
            <div style="border-top: 1px dotted #000; margin-top: 3px; padding-top: 2px;">
              <div style="font-weight: bold; font-size: 8px; text-transform: uppercase;">DISPATCH &amp; PAYMENT</div>
              <div>Transport: ${escapeHtml(transport)}</div>
              <div>Payment Mode: <span style="text-transform: uppercase;">${escapeHtml(paymentMethod)}</span></div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 5px;">
            <thead>
              <tr style="border-bottom: 1px solid #000; text-align: left;">
                <th style="padding: 2px 0;">Item</th>
                <th style="text-align: right; padding: 2px 0;">Qty</th>
                <th style="text-align: right; padding: 2px 0;">Rate</th>
                <th style="text-align: right; padding: 2px 0;">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (it: any) => `
                <tr>
                  <td style="padding: 2px 0;">${escapeHtml(it.name || it.productName)}</td>
                  <td style="text-align: right; padding: 2px 0;">${it.qty}</td>
                  <td style="text-align: right; padding: 2px 0;">${Number(it.price || it.unitRate || 0).toFixed(2)}</td>
                  <td style="text-align: right; padding: 2px 0; font-weight: bold;">${(Number(it.price || 0) * Number(it.qty || 0)).toFixed(2)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          <div style="border-top: 1px dashed #000; padding-top: 4px; font-size: 10px; margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
            ${discount > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Discount:</span><span>-₹${discount.toFixed(2)}</span></div>` : ""}
            <div style="display: flex; justify-content: space-between;"><span>GST:</span><span>₹${tax.toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; border-top: 1px solid #000; padding-top: 2px; margin-top: 2px;">
              <span>TOTAL:</span><span>₹${total.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; margin-top: 2px;">
              <span>Mode: ${paymentMethod}</span>
              <span>Paid: ₹${total.toFixed(2)}</span>
            </div>
          </div>

          <div style="text-align: center; font-size: 8px; border-top: 1px dashed #000; padding-top: 4px;">
            <div>${escapeHtml(cust.footerGreeting || "Get well soon! Thank you for your visit.")}</div>
          </div>
        </div>
      `;
    }

    // 2. ORIGINAL CLASSIC A4 TEMPLATE
    if (templateId === "tmpl-original-a4") {
      return `
        <div style="width: 100%; border: 1.5px solid ${color}; border-radius: 8px; padding: 18px; box-sizing: border-box; background: #fff; position: relative;">
          ${copyLabel ? `<div style="position: absolute; right: 15px; top: 8px; font-size: 10px; font-weight: bold; color: #64748b; letter-spacing: 0.1em; text-transform: uppercase;">[ ${copyLabel} ]</div>` : ""}
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${color}; padding-bottom: 12px; margin-bottom: 12px;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <div style="width: 48px; height: 48px; border-radius: 8px; background: ${color}; display: flex; align-items: center; justify-content: center; color: white;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
              </div>
              <div>
                <h1 style="font-size: 18px; font-weight: 800; color: ${color}; text-transform: uppercase; margin: 0; line-height: 1.1;">${escapeHtml(pharmacyName)}</h1>
                ${pharmacyAddress ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${escapeHtml(pharmacyAddress)}</div>` : ""}
                <div style="font-size: 10px; font-family: monospace; color: #64748b; margin-top: 2px;">
                  ${pharmacyPhone ? `Phone: ${escapeHtml(pharmacyPhone)} ` : ""}
                  ${pharmacyGstNumber ? `· GSTIN: ${escapeHtml(pharmacyGstNumber.toUpperCase())} ` : ""}
                  ${pharmacyDrugLicNo ? `· D.L.: ${escapeHtml(pharmacyDrugLicNo.toUpperCase())}` : ""}
                </div>
              </div>
            </div>
            <div style="text-align: right; font-size: 11px;">
              <div style="font-size: 16px; font-weight: bold; color: ${color}; letter-spacing: 0.05em; text-transform: uppercase;">TAX INVOICE</div>
              <div style="margin-top: 2px;"><strong>Inv No:</strong> <span style="font-family: monospace; font-weight: bold; color: ${color};">${escapeHtml(invoiceNo)}</span></div>
              <div><strong>Date:</strong> ${invoiceDate}</div>
              <div><strong>Time:</strong> ${invoiceTime}</div>
              <div><strong>Cashier:</strong> ${escapeHtml(bill.cashier || "Admin")}</div>
            </div>
          </div>

          <!-- Customer & Dispatch -->
          <div style="display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 11px; line-height: 1.4;">
            <div style="flex: 1;">
              <div style="font-size: 9px; font-weight: bold; color: ${color}; text-transform: uppercase; margin-bottom: 2px;">CUSTOMER DETAILS</div>
              <div style="font-size: 14px; font-weight: bold; text-transform: uppercase;">${escapeHtml(customerName)}</div>
              ${customerPhone ? `<div><strong>PHONE:</strong> <span style="font-family: monospace;">${escapeHtml(customerPhone)}</span></div>` : ""}
              ${customerDrugLicNo ? `<div><strong>D.L.NO.:</strong> <span style="font-family: monospace; font-weight: bold;">${escapeHtml(customerDrugLicNo.toUpperCase())}</span></div>` : ""}
              ${customerGstin ? `<div><strong>GSTIN:</strong> <span style="font-family: monospace; font-weight: bold;">${escapeHtml(customerGstin.toUpperCase())}</span></div>` : ""}
              ${customerAddress ? `<div><strong>ADDRESS:</strong> ${escapeHtml(customerAddress)}</div>` : ""}
            </div>
            <div style="width: 220px; border-left: 1px solid #e2e8f0; padding-left: 14px;">
              <div style="font-size: 9px; font-weight: bold; color: ${color}; text-transform: uppercase; margin-bottom: 2px;">DISPATCH &amp; PAYMENT</div>
              <div><strong>Transport:</strong> <span>${escapeHtml(transport)}</span></div>
              <div><strong>Payment Mode:</strong> <strong style="text-transform: uppercase; color: ${color};">${escapeHtml(paymentMethod)}</strong></div>
              <div><strong>Status:</strong> <strong style="color: #059669; text-transform: uppercase;">${escapeHtml(bill.status || "COMPLETED")}</strong></div>
              ${bill.customerNotes ? `<div style="font-style: italic; color: #64748b; margin-top: 3px; font-size: 10px;">${escapeHtml(bill.customerNotes)}</div>` : ""}
            </div>
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px;">
            <colgroup>${columnWidths.map((w) => `<col style="width: ${w};">`).join("")}</colgroup>
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                ${activeColumns.map((col, idx) => `<th style="padding: 6px 4px; text-align: ${col.align}; font-size: 9px; font-weight: bold; color: #334155; text-transform: uppercase; border-left: ${idx === 0 ? "0" : "1px solid #e2e8f0"};">${col.header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${items.map((it: any, idx: number) => renderItemRow(it, idx)).join("")}
            </tbody>
          </table>

          <!-- Footer Summary -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px;">
            <div style="flex: 1;">
              <div style="display: flex; gap: 10px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 8px;">
                ${qrSvg}
                <div style="font-size: 11px;">
                  <div><strong>Total Items:</strong> ${items.length}</div>
                  <div><strong>Net Qty:</strong> ${totalQty} ${totalFree > 0 ? `(+${totalFree} Free)` : ""}</div>
                </div>
              </div>
              <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 6px; padding: 6px 10px; font-size: 11px; margin-bottom: 8px;">
                <div style="font-size: 9px; font-weight: bold; color: ${color}; text-transform: uppercase;">AMOUNT IN WORDS</div>
                <div style="font-weight: bold; text-transform: capitalize;">${escapeHtml(amountInWords)}</div>
              </div>
              <div style="font-size: 9px; color: #64748b;">
                <strong>Terms & Conditions:</strong>
                <div>${escapeHtml(cust.termsText || "Goods once sold will not be taken back without valid bill.")}</div>
              </div>
            </div>

            <div style="width: 240px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-size: 11px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span>Gross Amount:</span><span style="font-family: monospace;">₹${grossAmount.toFixed(2)}</span></div>
              ${discount > 0 ? `<div style="display: flex; justify-content: space-between; color: #059669; margin-bottom: 3px;"><span>Discount:</span><span style="font-family: monospace;">-₹${discount.toFixed(2)}</span></div>` : ""}
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span>Taxable Amount:</span><span style="font-family: monospace;">₹${subtotal.toFixed(2)}</span></div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span>CGST:</span><span style="font-family: monospace;">₹${cgst.toFixed(2)}</span></div>
              <div style="display: flex; justify-content: space-between; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; margin-bottom: 4px;"><span>SGST:</span><span style="font-family: monospace;">₹${sgst.toFixed(2)}</span></div>
              <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; color: ${color};">
                <span>NET PAYABLE:</span><span style="font-family: monospace;">₹${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <!-- Signatures -->
          <div style="display: flex; justify-content: space-between; margin-top: 35px; padding-top: 10px; font-size: 11px;">
            <div style="border-top: 1px solid #94a3b8; width: 140px; text-align: center; padding-top: 4px; color: #64748b;">Customer Signature</div>
            <div style="text-align: center;">
              <div style="font-weight: bold; color: ${color}; font-size: 11px; margin-bottom: 25px;">For ${escapeHtml(pharmacyName)}</div>
              <div style="border-top: 1px solid #94a3b8; width: 160px; padding-top: 4px; color: #64748b;">${escapeHtml(cust.authorisedTitle || "Authorized Signatory")}</div>
            </div>
          </div>

          <div style="text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 5px;">
            ${escapeHtml(cust.footerGreeting || "Thank you for your visit! Wishing you good health.")}
          </div>
        </div>
      `;
    }

    // 3. SIDEBAR LEDGER TEMPLATE
    if (templateId === "tmpl-ref-3-sidebar-ledger") {
      return `
        <div style="width: 100%; height: 100%; display: flex; border: 1.5px solid #0f172a; border-radius: 4px; background: #fff; box-sizing: border-box; overflow: hidden; position: relative;">
          ${copyLabel ? `<div style="position: absolute; right: 8px; top: 4px; font-size: 9px; font-weight: bold; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase;">[ ${copyLabel} ]</div>` : ""}
          <!-- Left Sidebar -->
          <div style="width: 28%; background: #f8fafc; border-right: 1.5px solid #0f172a; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
            <div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; line-height: 1.1; margin-bottom: 4px;">${escapeHtml(pharmacyName)}</div>
              <p style="font-size: 9px; color: #475569; line-height: 1.3; margin-bottom: 6px;">${escapeHtml(pharmacyAddress)}</p>
              <div style="font-size: 9px; font-family: monospace; color: #334155; line-height: 1.4;">
                ${pharmacyPhone ? `<div>Ph: ${escapeHtml(pharmacyPhone)}</div>` : ""}
                ${pharmacyGstNumber ? `<div>GSTIN: ${escapeHtml(pharmacyGstNumber)}</div>` : ""}
                ${pharmacyDrugLicNo ? `<div>DL: ${escapeHtml(pharmacyDrugLicNo)}</div>` : ""}
              </div>
            </div>

            <div style="margin: 10px 0; text-align: center;">
              ${qrSvg}
              <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Scan to Verify</div>
            </div>

            <div style="font-size: 8.5px; border-top: 1.5px solid #0f172a; padding-top: 5px; line-height: 1.3;">
              <div style="font-weight: 900; color: #0f172a; font-size: 8px; text-transform: uppercase; margin-bottom: 2px;">CUSTOMER DETAILS</div>
              <div style="font-weight: 800; font-size: 10px; text-transform: uppercase; color: #0f172a;">${escapeHtml(customerName)}</div>
              ${customerPhone ? `<div><b>PHONE:</b> ${escapeHtml(customerPhone)}</div>` : ""}
              ${customerDrugLicNo ? `<div><b>D.L.NO.:</b> ${escapeHtml(customerDrugLicNo.toUpperCase())}</div>` : ""}
              ${customerGstin ? `<div><b>GSTIN:</b> ${escapeHtml(customerGstin.toUpperCase())}</div>` : ""}
              ${customerAddress ? `<div><b>ADDRESS:</b> ${escapeHtml(customerAddress)}</div>` : ""}
              <div style="border-top: 1px dashed #cbd5e1; margin-top: 4px; padding-top: 4px;">
                <div style="font-weight: 900; color: #0f172a; font-size: 8px; text-transform: uppercase; margin-bottom: 2px;">DISPATCH &amp; PAYMENT</div>
                <div><b>Transport:</b> ${escapeHtml(transport)}</div>
                <div><b>Payment Mode:</b> <span style="text-transform: uppercase; font-weight: 800;">${escapeHtml(paymentMethod)}</span></div>
              </div>
            </div>
          </div>

          <!-- Right Content Area -->
          <div style="flex: 1; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
            <div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #0f172a; padding-bottom: 4px; margin-bottom: 6px;">
                <span style="font-size: 13px; font-weight: bold; color: #0f172a; letter-spacing: 0.05em;">TAX INVOICE</span>
                <span style="font-size: 10px; font-family: monospace;"><b>${escapeHtml(invoiceNo)}</b> · ${invoiceDate}</span>
              </div>

              <!-- Table -->
              <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                <colgroup>${columnWidths.map((w) => `<col style="width: ${w};">`).join("")}</colgroup>
                <thead>
                  <tr style="border-bottom: 1.5px solid #0f172a; background: #f1f5f9;">
                    ${activeColumns.map((col) => `<th style="padding: 4px 2px; text-align: ${col.align}; font-size: 8.5px; font-weight: bold; color: #0f172a;">${col.header}</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${items.map((it: any, idx: number) => renderItemRow(it, idx)).join("")}
                </tbody>
              </table>
            </div>

            <!-- Bottom Totals -->
            <div style="border-top: 1.5px solid #0f172a; padding-top: 6px; margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="font-size: 9px; color: #475569; max-width: 60%;">
                  <div><b>Words:</b> ${escapeHtml(amountInWords)}</div>
                  <div style="margin-top: 2px;">${escapeHtml(cust.termsText || "Goods once sold cannot be returned.")}</div>
                </div>
                <div style="text-align: right; min-width: 140px;">
                  <div style="font-size: 9px; color: #475569;">Subtotal: ₹${subtotal.toFixed(2)} | GST: ₹${tax.toFixed(2)}</div>
                  <div style="font-size: 15px; font-weight: 800; border: 2px double #0f172a; padding: 2px 6px; margin-top: 3px; display: inline-block;">
                    TOTAL: ₹${total.toFixed(2)}
                  </div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 9px; color: #64748b;">
                <div>Thank you!</div>
                <div style="text-align: right;">For <b>${escapeHtml(pharmacyName)}</b> [${escapeHtml(cust.authorisedTitle || "Signatory")}]</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 4. CLASSIC PHARMACY BOX TEMPLATE
    if (templateId === "tmpl-ref-1-classic-box") {
      return `
        <div style="width: 100%; height: 100%; border: 2px solid #000; padding: 6px 8px; box-sizing: border-box; background: #fff; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
          ${copyLabel ? `<div style="position: absolute; right: 10px; top: 4px; font-size: 9px; font-weight: bold; color: #000; letter-spacing: 0.05em; text-transform: uppercase;">[ ${copyLabel} ]</div>` : ""}
          <div>
            <!-- Box Header -->
            <div style="text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 4px; margin-bottom: 4px;">
              <div style="font-size: 16px; font-weight: 900; text-transform: uppercase; color: #000; letter-spacing: 0.03em;">${escapeHtml(pharmacyName)}</div>
              <div style="font-size: 9.5px; color: #111;">${escapeHtml(pharmacyAddress)}</div>
              <div style="font-size: 9px; font-family: monospace; font-weight: bold; margin-top: 1px;">
                ${pharmacyPhone ? `PH: ${escapeHtml(pharmacyPhone)} ` : ""}
                ${pharmacyDrugLicNo ? `· DL: ${escapeHtml(pharmacyDrugLicNo)} ` : ""}
                ${pharmacyGstNumber ? `· GSTIN: ${escapeHtml(pharmacyGstNumber)}` : ""}
              </div>
            </div>

            <!-- Subheader Bar -->
            <div style="display: flex; justify-content: space-between; background: #bcd0e3; border: 1px solid #000; padding: 3px 6px; font-size: 9.5px; font-weight: bold; margin-bottom: 4px;">
              <div>CASH / CREDIT MEMO: <span style="font-family: monospace;">${escapeHtml(invoiceNo)}</span></div>
              <div>DATE: ${invoiceDate}</div>
              <div>PAYMENT: ${paymentMethod}</div>
            </div>

            <!-- Customer Details & Dispatch / Payment Box -->
            <div style="display: grid; grid-template-columns: 1.4fr 1fr; border-bottom: 1.5px solid #000; padding: 4px 6px; margin-bottom: 4px; font-size: 9px; line-height: 1.35; background: #fff;">
              <div>
                <div style="font-size: 8px; font-weight: 900; text-transform: uppercase; color: #000; letter-spacing: 0.05em;">CUSTOMER DETAILS</div>
                <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #000;">${escapeHtml(customerName)}</div>
                ${customerPhone ? `<div><b>PHONE:</b> ${escapeHtml(customerPhone)}</div>` : ""}
                ${customerDrugLicNo ? `<div><b>D.L.NO.:</b> ${escapeHtml(customerDrugLicNo.toUpperCase())}</div>` : ""}
                ${customerGstin ? `<div><b>GSTIN:</b> ${escapeHtml(customerGstin.toUpperCase())}</div>` : ""}
                ${customerAddress ? `<div><b>ADDRESS:</b> ${escapeHtml(customerAddress)}</div>` : ""}
              </div>
              <div style="border-left: 1.5px solid #000; padding-left: 8px;">
                <div style="font-size: 8px; font-weight: 900; text-transform: uppercase; color: #000; letter-spacing: 0.05em;">DISPATCH &amp; PAYMENT</div>
                <div><b>Transport:</b> ${escapeHtml(transport)}</div>
                <div><b>Payment Mode:</b> <span style="text-transform: uppercase; font-weight: 900;">${escapeHtml(paymentMethod)}</span></div>
                ${bill.customerNotes ? `<div style="font-style: italic; font-size: 8px; margin-top: 2px;">${escapeHtml(bill.customerNotes)}</div>` : ""}
              </div>
            </div>

            <!-- Table -->
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 9.5px;">
              <colgroup>${columnWidths.map((w) => `<col style="width: ${w};">`).join("")}</colgroup>
              <thead>
                <tr style="background: #e2e8f0; border-bottom: 1px solid #000;">
                  ${activeColumns.map((col, idx) => `<th style="padding: 3px 2px; text-align: ${col.align}; font-size: 8.5px; font-weight: 900; border-left: ${idx === 0 ? "0" : "1px solid #000"};">${col.header}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${items.map((it: any, idx: number) => renderItemRow(it, idx)).join("")}
              </tbody>
            </table>
          </div>

          <!-- Bottom Footer -->
          <div style="border-top: 1.5px solid #000; padding-top: 4px; margin-top: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9.5px;">
              <div style="max-width: 60%;">
                <div><b>Rupees:</b> ${escapeHtml(amountInWords)}</div>
                <div style="font-size: 8.5px; color: #333; margin-top: 1px;">${escapeHtml(cust.termsText || "Goods once sold will not be taken back without valid bill.")}</div>
              </div>
              <div style="text-align: right;">
                <div>Gross: ₹${grossAmount.toFixed(2)} | GST: ₹${tax.toFixed(2)}</div>
                <div style="font-size: 14px; font-weight: 900; border: 1.5px solid #000; padding: 2px 6px; margin-top: 2px; display: inline-block;">
                  NET: ₹${total.toFixed(2)}
                </div>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 12px; font-size: 9px;">
              <div style="border-top: 1px solid #000; width: 100px; text-align: center; padding-top: 2px;">Receiver's Sign</div>
              <div style="border-top: 1px solid #000; width: 130px; text-align: center; padding-top: 2px;">For ${escapeHtml(pharmacyName)}</div>
            </div>
          </div>
        </div>
      `;
    }

    // 5. DARK HEADER TEMPLATE
    if (templateId === "tmpl-ref-05-dark-header") {
      return `
        <div style="width: 100%; height: 100%; border: 1px solid #18232d; border-radius: 4px; background: #fff; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
          ${copyLabel ? `<div style="position: absolute; right: 10px; top: 6px; font-size: 9px; font-weight: bold; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase; z-index: 2;">[ ${copyLabel} ]</div>` : ""}
          <div>
            <!-- Dark Top Bar -->
            <div style="background: #18232d; color: #fff; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 16px; font-weight: 800; letter-spacing: 0.04em;">${escapeHtml(pharmacyName)}</div>
                <div style="font-size: 9.5px; opacity: 0.85;">${escapeHtml(pharmacyAddress)} · Ph: ${escapeHtml(pharmacyPhone)}</div>
              </div>
              <div style="text-align: right; font-size: 10px;">
                <div style="font-size: 13px; font-weight: bold; color: #38bdf8; letter-spacing: 0.08em;">TAX INVOICE</div>
                <div style="font-family: monospace;"><b>${escapeHtml(invoiceNo)}</b> | ${invoiceDate}</div>
              </div>
            </div>

            <!-- Customer Details & Dispatch / Payment Bar -->
            <div style="display: grid; grid-template-columns: 1.4fr 1fr; background: #f8fafc; border-bottom: 1.5px solid #18232d; padding: 6px 12px; font-size: 9px; line-height: 1.35;">
              <div>
                <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #18232d; letter-spacing: 0.05em;">CUSTOMER DETAILS</div>
                <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${escapeHtml(customerName)}</div>
                ${customerPhone ? `<div><b>PHONE:</b> ${escapeHtml(customerPhone)}</div>` : ""}
                ${customerDrugLicNo ? `<div><b>D.L.NO.:</b> ${escapeHtml(customerDrugLicNo.toUpperCase())}</div>` : ""}
                ${customerGstin ? `<div><b>GSTIN:</b> ${escapeHtml(customerGstin.toUpperCase())}</div>` : ""}
                ${customerAddress ? `<div><b>ADDRESS:</b> ${escapeHtml(customerAddress)}</div>` : ""}
              </div>
              <div style="border-left: 1px solid #cbd5e1; padding-left: 10px;">
                <div style="font-size: 8px; font-weight: 800; text-transform: uppercase; color: #18232d; letter-spacing: 0.05em;">DISPATCH &amp; PAYMENT</div>
                <div><b>Transport:</b> ${escapeHtml(transport)}</div>
                <div><b>Payment Mode:</b> <span style="text-transform: uppercase; font-weight: 800; color: #0284c7;">${escapeHtml(paymentMethod)}</span></div>
                ${bill.customerNotes ? `<div style="font-style: italic; color: #64748b; font-size: 8px; margin-top: 2px;">${escapeHtml(bill.customerNotes)}</div>` : ""}
              </div>
            </div>

            <!-- Table -->
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; padding: 0 4px;">
              <colgroup>${columnWidths.map((w) => `<col style="width: ${w};">`).join("")}</colgroup>
              <thead>
                <tr style="background: #e2e8f0; border-bottom: 1.5px solid #18232d;">
                  ${activeColumns.map((col) => `<th style="padding: 4px; text-align: ${col.align}; font-size: 8.5px; font-weight: bold; color: #18232d;">${col.header}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${items.map((it: any, idx: number) => renderItemRow(it, idx)).join("")}
              </tbody>
            </table>
          </div>

          <!-- Bottom Footer -->
          <div style="border-top: 1.5px solid #18232d; padding: 8px 12px; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 9px; color: #475569; max-width: 60%;">
                <div><b>Rupees:</b> ${escapeHtml(amountInWords)}</div>
                <div style="margin-top: 2px;">${escapeHtml(cust.termsText || "Goods once sold are not refundable.")}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 9px; color: #64748b;">Subtotal: ₹${subtotal.toFixed(2)} | GST: ₹${tax.toFixed(2)}</div>
                <div style="background: #18232d; color: #fff; font-size: 14px; font-weight: bold; padding: 3px 10px; border-radius: 3px; display: inline-block; margin-top: 3px;">
                  GRAND TOTAL: ₹${total.toFixed(2)}
                </div>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 9px; color: #64748b;">
              <div>${escapeHtml(cust.footerGreeting || "Wishing you good health!")}</div>
              <div>Authorized Signatory for <b>${escapeHtml(pharmacyName)}</b></div>
            </div>
          </div>
        </div>
      `;
    }

    // 6. DEFAULT: MODERN LEDGER (and other modern variants)
    return `
      <div style="width: 100%; height: 100%; border: 0.35mm solid #cbd5e1; border-radius: 4px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; background: #fff; position: relative;">
        ${copyLabel ? `<div style="position: absolute; right: 12px; top: 4px; font-size: 9px; font-weight: bold; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase;">[ ${copyLabel} ]</div>` : ""}
        <div>
          <!-- Top Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 6px; border-bottom: 0.6mm solid ${color};">
            <div>
              <div style="font-size: 16px; font-weight: 800; letter-spacing: 0.02em; color: ${color}; line-height: 1.1; margin-bottom: 2px;">
                ${escapeHtml(pharmacyName)}
              </div>
              <p style="font-size: 9.5px; line-height: 1.3; color: #1e293b; margin: 0;">${escapeHtml(pharmacyAddress)}</p>
              <p style="font-size: 9px; line-height: 1.3; color: #475569; margin: 1px 0 0;">
                ${cust.showStorePhone && pharmacyPhone ? `Phone: <strong>${escapeHtml(pharmacyPhone)}</strong> ` : ""}
                ${cust.showStoreDl && pharmacyDrugLicNo ? `· DL: <strong>${escapeHtml(pharmacyDrugLicNo)}</strong> ` : ""}
                ${cust.showStoreGstin && pharmacyGstNumber ? `· GSTIN: <strong>${escapeHtml(pharmacyGstNumber)}</strong>` : ""}
              </p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.08em; line-height: 1; margin-bottom: 4px; color: ${color};">
                GST INVOICE
              </div>
              <div style="display: grid; grid-template-columns: auto auto; gap: 1px 6px; justify-content: end; font-size: 9.5px; line-height: 1.3;">
                <span style="color: #64748b; text-align: right;">Inv No.</span>
                <span style="font-weight: 700; font-family: monospace; text-align: left; color: ${color};">${escapeHtml(invoiceNo)}</span>
                <span style="color: #64748b; text-align: right;">Date</span>
                <span style="font-weight: 600; text-align: left;">${invoiceDate} ${invoiceTime}</span>
                <span style="color: #64748b; text-align: right;">Payment</span>
                <span style="font-weight: 600; text-align: left; text-transform: uppercase;">${paymentMethod}</span>
              </div>
            </div>
          </div>

          <!-- Wholesaler Customer Details & Dispatch / Payment Block -->
          ${
            (cust.showCustomerDetails ?? cust.showPatientDoctor ?? true)
              ? `
            <div style="display: grid; grid-template-columns: 1.35fr 1fr; background: #f8fafc; border: 0.25mm solid #cbd5e1; margin-top: 5px; padding: 5px 8px; gap: 4px 12px; border-radius: 3px; font-size: 9.5px; line-height: 1.35;">
              <div>
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${color}; margin-bottom: 1px;">CUSTOMER DETAILS</div>
                <div style="font-weight: 800; font-size: 11px; color: #0f172a; text-transform: uppercase;">${escapeHtml(customerName)}</div>
                ${customerPhone ? `<div><span style="color: #64748b; font-size: 8.5px; font-weight: 700;">PHONE:</span> <span style="font-family: monospace; font-weight: 600;">${escapeHtml(customerPhone)}</span></div>` : ""}
                ${customerDrugLicNo ? `<div><span style="color: #64748b; font-size: 8.5px; font-weight: 700;">D.L.NO.:</span> <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${escapeHtml(customerDrugLicNo.toUpperCase())}</span></div>` : ""}
                ${customerGstin ? `<div><span style="color: #64748b; font-size: 8.5px; font-weight: 700;">GSTIN:</span> <span style="font-family: monospace; font-weight: 600;">${escapeHtml(customerGstin.toUpperCase())}</span></div>` : ""}
                ${customerAddress ? `<div><span style="color: #64748b; font-size: 8.5px; font-weight: 700;">ADDRESS:</span> <span>${escapeHtml(customerAddress)}</span></div>` : ""}
              </div>
              <div style="border-left: 0.2mm solid #cbd5e1; padding-left: 8px;">
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: ${color}; margin-bottom: 1px;">DISPATCH &amp; PAYMENT</div>
                <div><span style="color: #64748b; font-size: 8.5px; font-weight: 700;">Transport:</span> <span>${escapeHtml(transport)}</span></div>
                <div><span style="color: #64748b; font-size: 8.5px; font-weight: 700;">Payment Mode:</span> <strong style="text-transform: uppercase; color: ${color};">${escapeHtml(paymentMethod)}</strong></div>
                ${bill.customerNotes ? `<div style="font-style: italic; color: #64748b; font-size: 8.5px; margin-top: 2px;">${escapeHtml(bill.customerNotes)}</div>` : ""}
              </div>
            </div>
          `
              : ""
          }

          <!-- Items Table -->
          <div style="margin-top: 6px;">
            <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
              <colgroup>${columnWidths.map((w) => `<col style="width: ${w};">`).join("")}</colgroup>
              <thead>
                <tr>
                  ${activeColumns
                    .map(
                      (col, cIdx) => `
                    <th style="font-size: 8.5px; font-weight: 700; letter-spacing: 0.04em; color: ${color}; text-align: ${col.align}; padding: 3px 4px; border-bottom: 0.35mm solid #1e293b; border-left: ${
                      cIdx === 0 ? "0" : "0.18mm solid #cbd5e1"
                    }; white-space: nowrap;">
                      ${col.header}
                    </th>
                  `,
                    )
                    .join("")}
                </tr>
              </thead>
              <tbody>
                ${items.map((it: any, idx: number) => renderItemRow(it, idx)).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Foot Section -->
        <div style="display: flex; border-top: 0.35mm solid #1e293b; padding-top: 6px; margin-top: 8px; gap: 10px;">
          <!-- Left: Terms & Greeting -->
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 8px; letter-spacing: 0.06em; text-transform: uppercase; color: ${color}; font-weight: bold; margin-bottom: 1px;">
                Terms &amp; Conditions
              </div>
              <p style="font-size: 8.5px; line-height: 1.3; color: #475569; margin: 0;">
                ${escapeHtml(cust.termsText || "Goods once sold will not be taken back without valid bill. Cash not refundable.")}
              </p>
            </div>
            <div style="font-size: 9px; color: #1e293b; margin-top: 4px;">
              <b>Remark:</b> ${escapeHtml(cust.footerGreeting || "Wishing you good health!")}
            </div>
          </div>

          <!-- Middle: QR & Sign -->
          <div style="width: 110px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
            ${qrSvg}
            <div style="font-size: 8.5px; color: #64748b; text-align: center; border-top: 0.2mm solid #1e293b; width: 100%; padding-top: 2px; margin-top: 4px;">
              ${escapeHtml(cust.authorisedTitle || "Authorized Signatory")}
            </div>
          </div>

          <!-- Right: Totals -->
          <div style="width: 160px; flex-shrink: 0; display: flex; flex-direction: column; justify-content: flex-end;">
            <div style="font-size: 9.5px; line-height: 1.4; border-bottom: 0.15mm solid #d5dbe0; padding-bottom: 2px;">
              <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span style="font-family: monospace;">₹${subtotal.toFixed(2)}</span></div>
              ${discount > 0 ? `<div style="display: flex; justify-content: space-between; color: #059669;"><span>Discount:</span><span style="font-family: monospace;">-₹${discount.toFixed(2)}</span></div>` : ""}
              <div style="display: flex; justify-content: space-between;"><span>SGST (6%):</span><span style="font-family: monospace;">₹${sgst.toFixed(2)}</span></div>
              <div style="display: flex; justify-content: space-between;"><span>CGST (6%):</span><span style="font-family: monospace;">₹${cgst.toFixed(2)}</span></div>
            </div>
            <div style="font-size: 8px; color: #64748b; text-align: right; margin: 2px 0;">
              ${escapeHtml(amountInWords)}
            </div>
            <div style="background: ${color}; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; border-radius: 3px; font-weight: bold; margin-top: 2px;">
              <span style="font-size: 9px; letter-spacing: 0.05em;">GRAND TOTAL</span>
              <span style="font-size: 13px; font-family: monospace;">₹ ${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // Multiple copies rendering for A4_DUAL_COPY
  let bodyContent = "";
  if (paperPreset === "A4_DUAL_COPY") {
    bodyContent = `
      <div class="page-container" style="width: 210mm; min-height: 297mm; box-sizing: border-box; padding: ${mTop}mm ${mRight}mm ${mBottom}mm ${mLeft}mm; display: flex; flex-direction: column; gap: 8mm; justify-content: flex-start; transform: translate(${xOffset}mm, ${yOffset}mm);">
        <div style="height: 138mm; overflow: hidden; display: flex; flex-direction: column;">
          ${buildSingleBillContent("ORIGINAL - CUSTOMER COPY")}
        </div>
        <div style="border-top: 1px dashed #94a3b8; margin: 2px 0;"></div>
        <div style="height: 138mm; overflow: hidden; display: flex; flex-direction: column;">
          ${buildSingleBillContent("DUPLICATE - STORE COPY")}
        </div>
      </div>
    `;
  } else {
    bodyContent = `
      <div class="page-container" style="${containerDimensions} box-sizing: border-box; padding: ${mTop}mm ${mRight}mm ${mBottom}mm ${mLeft}mm; transform: translate(${xOffset}mm, ${yOffset}mm);">
        ${buildSingleBillContent("ORIGINAL")}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice #${escapeHtml(invoiceNo)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page {
      ${pageSizeCss}
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      background: #f8fafc;
      font-family: ${font};
      font-size: ${fontSizeBase};
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      margin: 0;
      padding: 0;
    }
    @media print {
      html, body {
        background: #ffffff;
      }
      .page-container {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

export function printBillDocument(bill: any, settings: PrinterSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const html = renderBillHtml(bill, settings);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        throw new Error("Unable to access print frame document.");
      }

      doc.open();
      doc.write(html);
      doc.close();

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
              resolve();
            }, 1000);
          } catch (e) {
            document.body.removeChild(iframe);
            reject(e);
          }
        }, 250);
      };
    } catch (err) {
      reject(err);
    }
  });
}

export function printCalibrationSheet(settings: PrinterSettings): Promise<void> {
  const mTop = settings.marginsMm.top;
  const mLeft = settings.marginsMm.left;
  const mRight = settings.marginsMm.right;
  const mBottom = settings.marginsMm.bottom;
  const xOffset = settings.calibrationMm.xOffset;
  const yOffset = settings.calibrationMm.yOffset;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Printer Calibration Sheet</title>
  <style>
    @page { size: 210mm 297mm; margin: 0; }
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .grid-container {
      width: 210mm;
      height: 297mm;
      box-sizing: border-box;
      position: relative;
      border: 1px solid #000;
      padding: ${mTop}mm ${mRight}mm ${mBottom}mm ${mLeft}mm;
      transform: translate(${xOffset}mm, ${yOffset}mm);
    }
    .crosshair {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40mm;
      height: 40mm;
      transform: translate(-50%, -50%);
      border: 1px solid #2563eb;
    }
  </style>
</head>
<body>
  <div class="grid-container">
    <div style="font-size: 14px; font-weight: bold; text-align: center; margin-top: 10mm;">
      MEDISTOCK HARDWARE PRINTER CALIBRATION SHEET (A4)
    </div>
    <div style="font-size: 10px; text-align: center; margin-top: 4mm; color: #475569;">
      Current Margins: Top=${mTop}mm, Bottom=${mBottom}mm, Left=${mLeft}mm, Right=${mRight}mm | Offsets: X=${xOffset}mm, Y=${yOffset}mm
    </div>
    <div class="crosshair">
      <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #2563eb;"></div>
      <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: #2563eb;"></div>
    </div>
    <div style="position: absolute; bottom: 15mm; left: 20mm; font-size: 9px; color: #64748b;">
      Align edge of physical sheet with printed borders. Adjust X/Y offsets in Settings > Printer if shifted.
    </div>
  </div>
</body>
</html>`;

  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) throw new Error("Frame error");
      doc.open();
      doc.write(html);
      doc.close();

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              document.body.removeChild(iframe);
              resolve();
            }, 1000);
          } catch (e) {
            document.body.removeChild(iframe);
            reject(e);
          }
        }, 250);
      };
    } catch (e) {
      reject(e);
    }
  });
}
