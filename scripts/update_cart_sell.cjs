const fs = require('fs');
const path = require('path');

// 1. Update cart-context.tsx
const cartCtxPath = path.join(__dirname, '../src/lib/cart-context.tsx');
let cartCtx = fs.readFileSync(cartCtxPath, 'utf8');

cartCtx = cartCtx.replace(
  'import type { PaymentMethod, Product } from "./storage";',
  'import type { PaymentMethod, Product } from "./storage";\nimport { calculateSmallestUnits } from "./inventory-utils";'
);

cartCtx = cartCtx.replace(
  'export type CartItem = { product: Product; qty: number; freeQty?: number };',
  'export type CartItem = { product: Product; qty: number; freeQty?: number; unitSold?: string; convertedQty?: number };'
);

cartCtx = cartCtx.replace(
  /add: \(product: Product, qty\?: number\) => \{ isFirst: boolean \};/g,
  'add: (product: Product, qty?: number, unitSold?: string) => { isFirst: boolean };'
);
cartCtx = cartCtx.replace(
  /setQty: \(productId: string, qty: number\) => void;/g,
  'setQty: (productId: string, qty: number, unitSold?: string) => void;'
);

const addRegex = /const add: CartCtx\["add"\] = \(product, qty = 1\) => \{[\s\S]*?return \{ isFirst \};\n  \};/;
const newAdd = `const add: CartCtx["add"] = (product, qty = 1, unitSold = "Tablet") => {
    const isFirst = items.length === 0;
    const unit = product.medicineType === "Tablet" || product.medicineType === "Capsule" ? unitSold : "Unit";
    const convertedQty = calculateSmallestUnits(qty, unit, product.medicineType || "Tablet", Number(product.tabletsPerStrip || 10), Number(product.stripsPerBox || 10));
    
    setItems((prev) => {
      // Find if we already have this product with the SAME unitSold.
      // If we do, increment. If not, add as new line item.
      const existingIdx = prev.findIndex((i) => i.product.id === product.id && (i.unitSold || "Tablet") === unit);
      if (existingIdx >= 0) {
        const i = prev[existingIdx];
        const newQty = i.qty + qty;
        const newConverted = calculateSmallestUnits(newQty, unit, product.medicineType || "Tablet", Number(product.tabletsPerStrip || 10), Number(product.stripsPerBox || 10));
        
        // We only allow if total converted doesn't exceed stock (very rough check, as there could be multiple lines of same product, but good enough for now)
        const totalOtherConverted = prev.filter((_, idx) => idx !== existingIdx && _.product.id === product.id).reduce((sum, item) => sum + (item.convertedQty || 0), 0);
        
        if (newConverted + totalOtherConverted > product.stock) {
            // Cannot add
            return prev;
        }

        const newItems = [...prev];
        newItems[existingIdx] = { ...i, qty: newQty, convertedQty: newConverted };
        return newItems;
      }
      
      const totalOtherConverted = prev.filter(i => i.product.id === product.id).reduce((sum, item) => sum + (item.convertedQty || 0), 0);
      if (convertedQty + totalOtherConverted > product.stock) {
          return prev;
      }

      return [...prev, { product, qty, unitSold: unit, convertedQty }];
    });
    return { isFirst };
  };`;
cartCtx = cartCtx.replace(addRegex, newAdd);

// Need to update subtotal and tax to use convertedQty instead of qty
cartCtx = cartCtx.replace(
  'const subtotal = items.reduce((s, i) => s + (i.qty - (i.freeQty || 0)) * i.product.price, 0);',
  'const subtotal = items.reduce((s, i) => s + ((i.convertedQty || i.qty) - (i.freeQty || 0)) * i.product.price, 0);'
);
cartCtx = cartCtx.replace(
  's + ((i.qty - (i.freeQty || 0)) * i.product.price * (i.product.taxPercent ?? 0)) / 100',
  's + (((i.convertedQty || i.qty) - (i.freeQty || 0)) * i.product.price * (i.product.taxPercent ?? 0)) / 100'
);

fs.writeFileSync(cartCtxPath, cartCtx);

// 2. Update _app.sell.tsx
const sellPath = path.join(__dirname, '../src/routes/_app.sell.tsx');
let sellCtx = fs.readFileSync(sellPath, 'utf8');

sellCtx = sellCtx.replace(
  'const [qtyValue, setQtyValue] = useState(1);',
  'const [qtyValue, setQtyValue] = useState(1);\n  const [unitSold, setUnitSold] = useState("Tablet");\n  const { calculateSmallestUnits } = require("@/lib/inventory-utils");'
);

sellCtx = sellCtx.replace(
  'const openQtyPicker = (p: Product) => {\n    setQtyProduct(p);\n    setQtyValue(1);\n  };',
  'const openQtyPicker = (p: Product) => {\n    setQtyProduct(p);\n    setQtyValue(1);\n    setUnitSold(p.medicineType === "Tablet" || p.medicineType === "Capsule" ? "Tablet" : "Unit");\n  };'
);

sellCtx = sellCtx.replace(
  'const { isFirst } = cart.add(qtyProduct, qtyValue);',
  'const { isFirst } = cart.add(qtyProduct, qtyValue, unitSold);'
);

// We need maxQty to be calculated based on unitSold
sellCtx = sellCtx.replace(
  /const maxQty = qtyProduct[\s\S]*?\? qtyProduct\.stock - \(cart\.items\.find\(\(i\) => i\.product\.id === qtyProduct\.id\)\?\.qty \?\? 0\)[\s\S]*?: 1;/,
  `const maxQty = qtyProduct ? (() => {
    const totalOtherConverted = cart.items.filter(i => i.product.id === qtyProduct.id).reduce((sum, item) => sum + (item.convertedQty || 0), 0);
    const availableConverted = qtyProduct.stock - totalOtherConverted;
    const isTabCap = qtyProduct.medicineType === "Tablet" || qtyProduct.medicineType === "Capsule";
    const tps = Number(qtyProduct.tabletsPerStrip) || 10;
    const spb = Number(qtyProduct.stripsPerBox) || 10;
    if (unitSold === "Box") return Math.floor(availableConverted / (tps * spb));
    if (unitSold === "Strip") return Math.floor(availableConverted / tps);
    return availableConverted;
  })() : 1;`
);

// We need to inject the import for `calculateSmallestUnits`
sellCtx = sellCtx.replace(
  'import { SellSkeleton } from "@/components/loading-skeleton";',
  'import { SellSkeleton } from "@/components/loading-skeleton";\nimport { calculateSmallestUnits, formatStock } from "@/lib/inventory-utils";'
);

// Replace formatMoney(qtyProduct.price * qtyValue)
sellCtx = sellCtx.replace(
  /formatMoney\(qtyProduct\.price \* qtyValue\)/g,
  'formatMoney(qtyProduct.price * calculateSmallestUnits(qtyValue, unitSold, qtyProduct.medicineType || "Tablet", Number(qtyProduct.tabletsPerStrip || 10), Number(qtyProduct.stripsPerBox || 10)))'
);

// In qty picker, add unit selection
const qtyPickerRegex = /<div className="flex items-center justify-center gap-4">/;
const newQtyPicker = `<div className="flex flex-col items-center gap-4">
              {(qtyProduct.medicineType === "Tablet" || qtyProduct.medicineType === "Capsule") && (
                <div className="flex gap-2">
                  <select className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" value={unitSold} onChange={(e) => setUnitSold(e.target.value)}>
                    <option value="Tablet">Tablet</option>
                    <option value="Strip">Strip</option>
                    <option value="Box">Box</option>
                  </select>
                </div>
              )}
              <div className="flex items-center justify-center gap-4">`;
sellCtx = sellCtx.replace(qtyPickerRegex, newQtyPicker);
// close the extra div
sellCtx = sellCtx.replace(
  /<Button\n                  variant="outline"\n                  size="icon"\n                  className="h-10 w-10"\n                  onClick=\{.*?\n                  disabled=\{qtyValue >= maxQty\}\n                >\n                  <Plus className="h-4 w-4" \/>\n                <\/Button>\n              <\/div>/,
  `$&
              </div>`
);

// Fix table column stock formatting
sellCtx = sellCtx.replace(
  /\{p\.stock\} in stock/g,
  `{formatStock(p.stock, p.medicineType || "Tablet", Number(p.tabletsPerStrip || 10), Number(p.stripsPerBox || 10))} in stock`
);

fs.writeFileSync(sellPath, sellCtx);

console.log('Updated cart and sell');
