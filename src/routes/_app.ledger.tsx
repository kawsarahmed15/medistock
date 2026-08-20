import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Search, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { billsStore, purchasesStore, type Bill, type Purchase } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { TableSkeleton } from "@/components/loading-skeleton";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Range = "today" | "yesterday" | "7d" | "30d" | "custom" | "all";
type LedgerSearch = { range?: Range; from?: string; to?: string };

export const Route = createFileRoute("/_app/ledger")({
  validateSearch: (search: Record<string, unknown>): LedgerSearch => {
    const valid: Range[] = ["today", "yesterday", "7d", "30d", "custom", "all"];
    const r = search.range as string | undefined;
    return {
      range: valid.includes(r as Range) ? (r as Range) : undefined,
      from: typeof search.from === "string" ? search.from : undefined,
      to: typeof search.to === "string" ? search.to : undefined,
    };
  },
  component: LedgerPage,
});

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

function rangeBounds(range: Range, from?: string, to?: string): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  switch (range) {
    case "today":
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "custom": {
      const s = from ? new Date(from) : new Date(0);
      const e = to ? new Date(to) : new Date();
      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    case "all":
    default:
      return { start: new Date(0), end };
  }
  return { start, end };
}

type LedgerEntry = {
  id: string;
  date: string;
  type: "sale" | "purchase";
  number: string;
  partyName: string;
  paymentMethod: string;
  items: { name: string; qty: number }[];
  itemsSummary: string;
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
};

function LedgerPage() {
  const { session } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const range: Range = search.range ?? "30d";
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<Bill[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [filterType, setFilterType] = useState<"all" | "sale" | "purchase">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([billsStore.list(), purchasesStore.list()])
      .then(([b, p]) => {
        if (!cancelled) {
          setBills(b);
          setPurchases(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBills([]);
          setPurchases([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { start, end } = useMemo(
    () => rangeBounds(range, search.from, search.to),
    [range, search.from, search.to],
  );

  const ledgerEntries = useMemo(() => {
    const list: LedgerEntry[] = [];

    bills.forEach((b) => {
      list.push({
        id: b.id,
        date: b.createdAt,
        type: "sale",
        number: b.number,
        partyName: b.customerName || "Walk-in Customer",
        paymentMethod: b.paymentMethod,
        items: b.items.map((it) => ({ name: it.name, qty: it.qty })),
        itemsSummary: b.items.map((it) => `${it.name} (x${it.qty})`).join(", "),
        total: b.total,
        subtotal: b.subtotal,
        tax: b.tax,
        discount: b.discount || 0,
      });
    });

    purchases.forEach((p) => {
      list.push({
        id: p.id,
        date: p.createdAt,
        type: "purchase",
        number: p.number,
        partyName: p.supplierName || "Direct Supplier",
        paymentMethod: p.paymentMethod,
        items: p.items.map((it) => ({ name: it.name, qty: it.qty })),
        itemsSummary: p.items.map((it) => `${it.name} (x${it.qty})`).join(", "),
        total: p.total,
        subtotal: p.subtotal,
        tax: p.tax,
        discount: p.discount || 0,
      });
    });

    let filtered = list.filter((e) => {
      const time = new Date(e.date).getTime();
      return time >= start.getTime() && time <= end.getTime();
    });

    if (filterType !== "all") {
      filtered = filtered.filter((e) => e.type === filterType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.number.toLowerCase().includes(q) ||
          e.partyName.toLowerCase().includes(q) ||
          e.itemsSummary.toLowerCase().includes(q),
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bills, purchases, start, end, filterType, searchQuery]);

  const stats = useMemo(() => {
    let salesTotal = 0;
    let purchasesTotal = 0;
    let salesCount = 0;
    let purchasesCount = 0;

    ledgerEntries.forEach((e) => {
      if (e.type === "sale") {
        salesTotal += e.total;
        salesCount++;
      } else {
        purchasesTotal += e.total;
        purchasesCount++;
      }
    });

    return {
      salesTotal,
      purchasesTotal,
      salesCount,
      purchasesCount,
      netFlow: salesTotal - purchasesTotal,
    };
  }, [ledgerEntries]);

  const handleRangeChange = (r: Range) => {
    if (r === "custom") {
      navigate({ search: { range: r, from: search.from || "", to: search.to || "" } });
    } else {
      navigate({ search: { range: r } });
    }
  };

  const handleCustomDateChange = (field: "from" | "to", val: string) => {
    navigate({
      search: {
        ...search,
        range: "custom",
        [field]: val || undefined,
      },
    });
  };

  const handleDownloadPdf = async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 20;
    const right = pageWidth - 20;

    const pharmacyName = session?.pharmacyName || "MediStock Pharmacy";
    const pharmacyPhone = session?.pharmacyPhone || "";
    const pharmacyAddress = session?.pharmacyAddress || "";
    const gstNumber = session?.gstNumber || "";
    const drugLicNo = session?.drugLicNo || "";
    const billColor = session?.billColor || "#1a9890";

    const hexToRgb = (hex: string): [number, number, number] => {
      const cleanHex = hex.replace("#", "");
      const num = parseInt(cleanHex, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    };

    const primaryRgb = hexToRgb(billColor);

    // 1. Header Logo & Details
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
    doc.text(pharmacyName.toUpperCase(), headerLeftX, currentY + 16);

    doc.setTextColor(110, 110, 110);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let addrLines = pharmacyAddress ? doc.splitTextToSize(pharmacyAddress, 220) : [];
    if (addrLines.length > 0) {
      doc.text(addrLines, headerLeftX, currentY + 30);
    }

    let headerBottomY = currentY + 30 + addrLines.length * 12;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");

    if (pharmacyPhone) {
      doc.text(`Phone: ${pharmacyPhone}`, headerLeftX, headerBottomY);
      headerBottomY += 12;
    }
    if (gstNumber) {
      doc.text(`GSTIN: ${gstNumber.toUpperCase()}`, headerLeftX, headerBottomY);
      headerBottomY += 12;
    }
    if (drugLicNo) {
      doc.text(`D.L.No.: ${drugLicNo.toUpperCase()}`, headerLeftX, headerBottomY);
      headerBottomY += 12;
    }

    // Right Side Header
    let rightY = currentY;
    doc.setTextColor(...primaryRgb);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LEDGER REPORT", right, rightY + 12, { align: "right" });

    rightY += 30;
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.setFont("helvetica", "normal");
    doc.text("Period:", right - 220, rightY);
    doc.setTextColor(35, 35, 35);
    doc.setFont("helvetica", "bold");
    doc.text(
      `${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`,
      right,
      rightY,
      { align: "right" }
    );

    rightY += 14;
    doc.setTextColor(110, 110, 110);
    doc.setFont("helvetica", "normal");
    doc.text("Generated:", right - 220, rightY);
    doc.setTextColor(35, 35, 35);
    doc.text(
      `${new Date().toLocaleDateString("en-IN")} ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`,
      right,
      rightY,
      { align: "right" }
    );

    let y = Math.max(headerBottomY - 12, rightY) + 12;
    doc.setDrawColor(...primaryRgb);
    doc.setLineWidth(1.5);
    doc.line(left, y, right, y);

    // 2. Stats box (styled like customer details box in bill pdf)
    y += 16;
    const statsBoxTop = y;
    const statsBoxHeight = 55;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.roundedRect(left, statsBoxTop, pageWidth - left * 2, statsBoxHeight, 6, 6, "FD");

    // Divider lines in stats box
    const colWidth = (pageWidth - left * 2) / 3;
    doc.line(left + colWidth, statsBoxTop, left + colWidth, statsBoxTop + statsBoxHeight);
    doc.line(left + colWidth * 2, statsBoxTop, left + colWidth * 2, statsBoxTop + statsBoxHeight);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("TOTAL SALES (+)", left + 15, statsBoxTop + 18);
    doc.text("TOTAL PURCHASES (-)", left + colWidth + 15, statsBoxTop + 18);
    doc.text("NET CASH FLOW", left + colWidth * 2 + 15, statsBoxTop + 18);

    doc.setFontSize(14);
    doc.setTextColor(22, 163, 74); // Green for sales
    doc.text(formatMoney(stats.salesTotal), left + 15, statsBoxTop + 40);
    doc.setTextColor(225, 29, 72); // Red for purchases
    doc.text(formatMoney(stats.purchasesTotal), left + colWidth + 15, statsBoxTop + 40);

    const isNetPositive = stats.netFlow >= 0;
    doc.setTextColor(isNetPositive ? 22 : 225, isNetPositive ? 163 : 29, isNetPositive ? 74 : 72);
    doc.text(formatMoney(stats.netFlow), left + colWidth * 2 + 15, statsBoxTop + 40);

    y += statsBoxHeight + 16;

    // 3. Transactions Table
    autoTable(doc, {
      startY: y,
      head: [
        ["Date", "Ref #", "Type", "Party Name", "Items Summary", "Debit (Out)", "Credit (In)"],
      ],
      body: ledgerEntries.map((e) => [
        new Date(e.date).toLocaleDateString("en-IN"),
        e.number,
        e.type === "sale" ? "Sale" : "Purchase",
        e.partyName,
        e.items.map((it) => `${it.name} (x${it.qty})`).join("\n"),
        e.type === "purchase" ? e.total.toFixed(2) : "—",
        e.type === "sale" ? e.total.toFixed(2) : "—",
      ]),
      styles: {
        fontSize: 7.5,
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
        0: { cellWidth: 55, halign: "center" },
        1: { cellWidth: 55, halign: "center" },
        2: { cellWidth: 45, halign: "center" },
        3: { cellWidth: 95, halign: "left" },
        4: { halign: "left" },
        5: { halign: "right", cellWidth: 60, textColor: [225, 29, 72] },
        6: { halign: "right", cellWidth: 60, textColor: primaryRgb, fontStyle: "bold" },
      },
      margin: { left, right: 20 },
      theme: "grid",
    });

    doc.save(`ledger_report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track all inward purchase invoices and outward sale entries.
          </p>
        </div>
        <Button onClick={handleDownloadPdf} disabled={ledgerEntries.length === 0} className="shadow-soft bg-primary hover:bg-primary/90 text-primary-foreground">
          <Download className="w-4 h-4 mr-2" /> Download PDF Ledger
        </Button>
      </div>

      <Card className="shadow-soft border">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Range</Label>
            <div className="flex flex-wrap gap-1.5">
              {(["today", "yesterday", "7d", "30d", "all", "custom"] as Range[]).map((r) => (
                <Button
                  key={r}
                  variant={range === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleRangeChange(r)}
                  className="capitalize"
                >
                  {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : r}
                </Button>
              ))}
            </div>
          </div>

          {range === "custom" && (
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="from-date" className="text-xs">From</Label>
                <Input
                  id="from-date"
                  type="date"
                  value={search.from || ""}
                  onChange={(e) => handleCustomDateChange("from", e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="to-date" className="text-xs">To</Label>
                <Input
                  id="to-date"
                  type="date"
                  value={search.to || ""}
                  onChange={(e) => handleCustomDateChange("to", e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-soft border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total Sales (+)</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatMoney(stats.salesTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered across {stats.salesCount} sale bills
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total Purchases (-)</CardTitle>
            <TrendingDown className="h-5 w-5 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{formatMoney(stats.purchasesTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered across {stats.purchasesCount} purchase orders
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft border bg-slate-50/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Net Ledger Flow</CardTitle>
            <Wallet className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.netFlow >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
              {formatMoney(stats.netFlow)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {stats.netFlow >= 0 ? "Surplus Cash Flow" : "Deficit / Net Investment"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft border">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
            <div className="flex bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
              {(["all", "sale", "purchase"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all uppercase tracking-wider ${
                    filterType === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t === "all" ? "All Entries" : t === "sale" ? "Sales" : "Purchases"}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ref #, party or item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : ledgerEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No ledger transactions found matching the filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ref #</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Party Name</TableHead>
                    <TableHead className="max-w-xs">Items Summary</TableHead>
                    <TableHead className="text-right">Out (Debit)</TableHead>
                    <TableHead className="text-right">In (Credit)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEntries.map((e) => (
                    <TableRow key={e.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">
                        {new Date(e.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.number}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                          e.type === "sale" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {e.type === "sale" ? "Sale" : "Purchase"}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">{e.partyName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={e.itemsSummary}>
                        {e.itemsSummary}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-rose-600">
                        {e.type === "purchase" ? formatMoney(e.total) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-emerald-600">
                        {e.type === "sale" ? formatMoney(e.total) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
