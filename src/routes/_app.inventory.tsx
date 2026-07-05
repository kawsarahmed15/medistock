import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { Search, Calendar, AlertTriangle, AlertCircle, ShoppingCart, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { useCart } from "@/lib/cart-context";
import { toast } from "sonner";

type InventorySearch = {
  q?: string;
};

export const Route = createFileRoute("/_app/inventory")({
  validateSearch: (search: Record<string, unknown>): InventorySearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: InventoryPage,
});

type StockItem = {
  medicine_name: string;
  generic_name?: string;
  gst: number;
  barcode?: string;
  schedule?: string;
  batch_number: string;
  expiry_date: string;
  purchase_rate: number;
  mrp: number;
  sale_rate: number;
  rack?: string;
  supplier_id?: string;
  stock_qty: number;
  status: "Expired" | "Low Stock" | "Normal";
};

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);
}

function InventoryPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const cart = useCart();

  const fetchStocks = async (queryVal = "") => {
    setLoading(true);
    try {
      const data = await apiRequest("GET", `/api/marg/stocks?query=${encodeURIComponent(queryVal)}`);
      setStocks(data);
    } catch (err) {
      toast.error("Failed to load stocks");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks(search);
  }, [search]);

  // Expiry styling
  const getStatusBadge = (item: StockItem) => {
    const isExpired = new Date(item.expiry_date) < new Date();
    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
          <AlertCircle className="h-3 w-3" /> Expired
        </span>
      );
    }
    if (item.stock_qty < 10) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100">
          <AlertTriangle className="h-3 w-3" /> Low Stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
        Normal
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-24 text-slate-800">
      
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MARG Stock Master</h1>
          <p className="text-xs text-slate-400">
            Batch-wise stock tracking, expiry notifications, and advanced search filters.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/purchases/new">
            <Button className="bg-[#1A9890] hover:bg-[#157e77]" size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Purchase Entry (New Stock)
            </Button>
          </Link>
        </div>
      </div>

      {/* Advanced Filter Box */}
      <div className="relative bg-white p-2 rounded-xl border shadow-sm flex items-center gap-2">
        <Search className="h-5 w-5 text-slate-400 ml-2" />
        <input
          type="text"
          className="flex-1 outline-none text-sm placeholder:text-slate-400 bg-transparent py-2"
          placeholder="Search by Medicine, Batch, Salt, Barcode, Rack, or Supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Stock List Cards & Table */}
      <Card className="shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs select-none">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b sticky top-0">
              <tr>
                <th className="py-3 px-3">Medicine Name</th>
                <th className="py-3 px-3">Salt / Generic</th>
                <th className="py-3 px-3 w-28">Batch No</th>
                <th className="py-3 px-3 w-28">Expiry Date</th>
                <th className="py-3 px-3 w-24 text-right">MRP</th>
                <th className="py-3 px-3 w-24 text-right">P. Rate</th>
                <th className="py-3 px-3 w-24 text-right">S. Rate</th>
                <th className="py-3 px-3 w-28">Rack</th>
                <th className="py-3 px-3 w-24 text-right">Stock Qty</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    Loading stocks inventory...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    No matching stocks found.
                  </td>
                </tr>
              ) : (
                stocks.map((item, idx) => {
                  const isExpired = new Date(item.expiry_date) < new Date();
                  const isLow = item.stock_qty < 10;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isExpired
                          ? "bg-rose-50/20 text-rose-900"
                          : isLow
                            ? "bg-amber-50/10 text-amber-900"
                            : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {item.medicine_name}
                        {item.schedule && (
                          <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            {item.schedule}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-medium italic">
                        {item.generic_name || "N/A"}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                        {item.batch_number}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {new Date(item.expiry_date).toLocaleDateString().slice(3)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">
                        {formatMoney(item.mrp)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {formatMoney(item.purchase_rate)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                        {formatMoney(item.sale_rate)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-500">
                        {item.rack || "N/A"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                        {item.stock_qty}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {getStatusBadge(item)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
