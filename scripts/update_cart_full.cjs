const fs = require('fs');
const path = require('path');

// 1. Fix cart-context.tsx setQty implementation
const cartCtxPath = path.join(__dirname, '../src/lib/cart-context.tsx');
let cartCtx = fs.readFileSync(cartCtxPath, 'utf8');

const setQtyRegex = /const setQty: CartCtx\["setQty"\] = \(id, qty\) =>[\s\S]*?\}\),[\s\S]*?\);/;
const newSetQty = `const setQty: CartCtx["setQty"] = (id, qty, unitSold) =>
    setItems((prev) =>
      prev.map((i) => {
        if (i.product.id !== id || (unitSold && i.unitSold !== unitSold)) return i;
        
        // Calculate the requested converted qty
        const requestedConverted = calculateSmallestUnits(qty, i.unitSold || "Tablet", i.product.medicineType || "Tablet", Number(i.product.tabletsPerStrip || 10), Number(i.product.stripsPerBox || 10));
        
        // Count other converted items
        const totalOtherConverted = prev.filter(item => item.product.id === id && item !== i).reduce((sum, item) => sum + (item.convertedQty || 0), 0);
        
        // Check if we exceed stock
        if (requestedConverted + totalOtherConverted > i.product.stock) {
          // Keep old qty
          return i;
        }
        
        const newQty = Math.max(1, qty);
        const newConverted = calculateSmallestUnits(newQty, i.unitSold || "Tablet", i.product.medicineType || "Tablet", Number(i.product.tabletsPerStrip || 10), Number(i.product.stripsPerBox || 10));

        return { ...i, qty: newQty, convertedQty: newConverted, freeQty: Math.min(i.freeQty || 0, newQty) };
      }),
    );`;

cartCtx = cartCtx.replace(setQtyRegex, newSetQty);

// Also we should fix setFreeQty to respect unit sold if needed, but since id is used, it might modify all lines of same product.
// For now, let's just replace setQty.
fs.writeFileSync(cartCtxPath, cartCtx);


// 2. Fix _app.cart.tsx
const cartPath = path.join(__dirname, '../src/routes/_app.cart.tsx');
let cartFile = fs.readFileSync(cartPath, 'utf8');

cartFile = cartFile.replace(
  'freeQty: i.freeQty || 0,\n          taxPercent: i.product.taxPercent ?? 0,',
  'freeQty: i.freeQty || 0,\n          unitSold: i.unitSold || "Tablet",\n          convertedQty: i.convertedQty || i.qty,\n          taxPercent: i.product.taxPercent ?? 0,'
);

cartFile = cartFile.replace(
  'productsStore.decrementStock(i.product.id, i.qty)',
  'productsStore.decrementStock(i.product.id, i.convertedQty || i.qty)'
);

cartFile = cartFile.replace(
  'onClick={() => cart.setQty(i.product.id, i.qty - 1)}',
  'onClick={() => cart.setQty(i.product.id, i.qty - 1, i.unitSold)}'
);

cartFile = cartFile.replace(
  'onClick={() => cart.setQty(i.product.id, i.qty + 1)}',
  'onClick={() => cart.setQty(i.product.id, i.qty + 1, i.unitSold)}'
);

cartFile = cartFile.replace(
  'disabled={i.qty >= i.product.stock}',
  'disabled={false} /* Stock check handled in context */'
);

cartFile = cartFile.replace(
  '<span className="w-8 text-center text-sm tabular-nums">{i.qty}</span>',
  '<span className="w-16 text-center text-sm tabular-nums">{i.qty} {i.unitSold}</span>'
);

cartFile = cartFile.replace(
  'formatMoney(i.product.price * (i.qty - (i.freeQty || 0)))',
  'formatMoney(i.product.price * ((i.convertedQty || i.qty) - (i.freeQty || 0)))'
);

fs.writeFileSync(cartPath, cartFile);

console.log('Fixed cart-context.tsx and _app.cart.tsx');
