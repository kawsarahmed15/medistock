import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Package, X } from "lucide-react";
import { productsStore, type Product } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh product list when search opens (cloud fetch)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    productsStore
      .list()
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Global keyboard shortcut: "/" or Ctrl/Cmd+K to focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      if (
        (e.key === "/" && !inField) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
      ) {
        const cleanPath = window.location.pathname.toLowerCase().trim().replace(/\/$/, "");
        if (cleanPath === "/inventory") {
          return;
        }
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside to close
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.batch?.toLowerCase().includes(q) ||
          p.manufacturer?.toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [products, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const select = (p: Product) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    navigate({ to: "/inventory/$id", params: { id: p.id } as any });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[active];
      if (item) select(item);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div
        className={cn(
          "flex items-center gap-2 h-9 rounded-lg border bg-background/60 px-3 transition-smooth",
          open
            ? "border-primary/60 shadow-glow ring-2 ring-primary/20 scale-[1.01]"
            : "border-border hover:border-primary/40",
        )}
      >
        <Search
          className={cn(
            "h-4 w-4 shrink-0 transition-smooth",
            open ? "text-primary scale-110" : "text-muted-foreground",
          )}
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search Medicines"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground transition-smooth"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-lg border border-border bg-popover shadow-soft overflow-hidden animate-scale-in origin-top">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No medicines match "{query}"
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((p, i) => {
                const low = p.stock <= 10;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => select(p)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-smooth",
                        i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                      )}
                    >
                      <div className="h-8 w-8 rounded-md bg-gradient-primary flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.category}
                          {p.batch ? ` · Batch ${p.batch}` : ""}
                          {p.sku ? ` · ${p.sku}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold">₹{p.price}</div>
                        <div
                          className={cn(
                            "text-[10px]",
                            low ? "text-destructive font-medium" : "text-muted-foreground",
                          )}
                        >
                          {low ? `Low · ${p.stock}` : `Stock ${p.stock}`}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-border bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground flex items-center justify-between">
            <span>↑ ↓ navigate · ↵ open · esc close</span>
            <span>
              {results.length} result{results.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
