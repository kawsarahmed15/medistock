const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/routes/_app.inventory.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  'import { TableSkeleton } from "@/components/loading-skeleton";',
  'import { TableSkeleton } from "@/components/loading-skeleton";\nimport { calculateSmallestUnits, formatStock } from "@/lib/inventory-utils";'
);

// 2. Replace FormState and parsePack
const formStateRegex = /type FormState = \{[\s\S]*?function parsePack\([^)]*\) \{[\s\S]*?return \{ stockType: "other", stockPacks: packStr, stockUnits: "" \};\n\}/;
const newFormState = `type FormState = {
  name: string;
  category: string;
  manufacturer: string;
  batch: string;
  sku: string;
  expiry: string;
  taxPercent: string;
  prescription: boolean;

  medicineType: string;
  tabletsPerStrip: string;
  stripsPerBox: string;

  purchaseQuantity: string;
  purchaseUnit: string;
  purchasePrice: string;

  mrpPerTablet: string;
  mrpPerStrip: string;
  mrpPerBox: string;

  pricePerTablet: string;
  pricePerStrip: string;
  pricePerBox: string;
};

const empty: FormState = {
  name: "",
  category: "",
  manufacturer: "",
  batch: "",
  sku: "",
  expiry: "",
  taxPercent: "12",
  prescription: false,
  medicineType: "Tablet",
  tabletsPerStrip: "10",
  stripsPerBox: "10",
  purchaseQuantity: "1",
  purchaseUnit: "Box",
  purchasePrice: "",
  mrpPerTablet: "",
  mrpPerStrip: "",
  mrpPerBox: "",
  pricePerTablet: "",
  pricePerStrip: "",
  pricePerBox: "",
};
`;
content = content.replace(formStateRegex, newFormState);

// 3. Replace startEdit
const startEditRegex = /const startEdit = \(p: Product\) => \{[\s\S]*?setOpen\(true\);\n  \};/;
const newStartEdit = `const startEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category: p.category,
      manufacturer: p.manufacturer ?? "",
      batch: p.batch ?? "",
      sku: p.sku ?? "",
      expiry: p.expiry ? (p.expiry.split("-").length >= 2 ? \`\${p.expiry.split("-")[1]}/\${p.expiry.split("-")[0].substring(2)}\` : p.expiry) : "",
      taxPercent: String(p.taxPercent ?? 0),
      prescription: !!p.prescription,

      medicineType: p.medicineType || "Tablet",
      tabletsPerStrip: String(p.tabletsPerStrip || 10),
      stripsPerBox: String(p.stripsPerBox || 10),

      purchaseQuantity: "1",
      purchaseUnit: p.medicineType === "Tablet" || p.medicineType === "Capsule" ? "Box" : "Unit",
      purchasePrice: p.costPrice ? String(p.costPrice * calculateSmallestUnits(1, p.medicineType === "Tablet" || p.medicineType === "Capsule" ? "Box" : "Unit", p.medicineType || "Tablet", Number(p.tabletsPerStrip || 10), Number(p.stripsPerBox || 10))) : "",

      mrpPerTablet: p.mrpPerTablet ? String(p.mrpPerTablet) : p.mrp ? String(p.mrp) : "",
      mrpPerStrip: p.mrpPerStrip ? String(p.mrpPerStrip) : "",
      mrpPerBox: p.mrpPerBox ? String(p.mrpPerBox) : "",

      pricePerTablet: p.price ? String(p.price) : "",
      pricePerStrip: "",
      pricePerBox: "",
    });
    setOpen(true);
  };`;
content = content.replace(startEditRegex, newStartEdit);

// 4. Replace submit
const submitRegex = /const submit = async \(e: FormEvent\) => \{[\s\S]*?const payload = \{[\s\S]*?\};[\s\S]*?toast\.error\("Please fill name, buying price, selling price, stock and expiry\."\);\n      return;\n    \}[\s\S]*?catch \(err\) \{[\s\S]*?\}\n  \};/;
const newSubmit = `const submit = async (e: FormEvent) => {
    e.preventDefault();
    
    const tps = Number(form.tabletsPerStrip) || 10;
    const spb = Number(form.stripsPerBox) || 10;
    
    // Calculate base quantities
    const addedStock = calculateSmallestUnits(Number(form.purchaseQuantity) || 0, form.purchaseUnit, form.medicineType, tps, spb);
    let finalStock = editing ? editing.stock + addedStock : addedStock;

    // Price calculation
    let costPerUnit = 0;
    if (addedStock > 0 && Number(form.purchasePrice)) {
      costPerUnit = Number(form.purchasePrice) / addedStock;
    }

    let pricePerUnit = Number(form.pricePerTablet) || 0;
    let mrpPerUnit = Number(form.mrpPerTablet) || 0;

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || "General",
      manufacturer: form.manufacturer.trim() || undefined,
      batch: form.batch.trim() || undefined,
      sku: form.sku.trim() || undefined,
      taxPercent: Number(form.taxPercent) || 0,
      prescription: form.prescription,
      expiry: (() => {
        if (!form.expiry) return "";
        const parts = form.expiry.split("/");
        if (parts.length === 2) {
          const month = parseInt(parts[0], 10);
          const year = 2000 + parseInt(parts[1], 10);
          const lastDay = new Date(year, month, 0).getDate();
          return \`\${year}-\${month.toString().padStart(2, "0")}-\${lastDay.toString().padStart(2, "0")}\`;
        }
        return form.expiry;
      })(),

      medicineType: form.medicineType,
      tabletsPerStrip: form.medicineType === "Tablet" || form.medicineType === "Capsule" ? tps : undefined,
      stripsPerBox: form.medicineType === "Tablet" || form.medicineType === "Capsule" ? spb : undefined,

      mrpPerTablet: Number(form.mrpPerTablet) || undefined,
      mrpPerStrip: Number(form.mrpPerStrip) || undefined,
      mrpPerBox: Number(form.mrpPerBox) || undefined,

      stock: finalStock,
      costPrice: costPerUnit || (editing ? editing.costPrice : 0),
      price: pricePerUnit,
      mrp: mrpPerUnit || undefined,
    };

    if (!payload.name || !payload.expiry || isNaN(payload.price)) {
      toast.error("Please fill required fields (Name, Price, Expiry).");
      return;
    }

    try {
      if (editing) {
        await productsStore.update(editing.id, payload);
        toast.success("Product updated");
      } else {
        await productsStore.add(payload);
        toast.success("Product added");
      }
      saveRecent("recentCategories", payload.category, recentCategories, setRecentCategories, 4);
      if (payload.manufacturer) saveRecent("recentManufacturers", payload.manufacturer, recentManufacturers, setRecentManufacturers, 8);
      if (payload.sku) saveRecent("recentHsns", payload.sku, recentHsns, setRecentHsns, 4);

      refresh();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message || "Failed to save product");
    }
  };`;
content = content.replace(submitRegex, newSubmit);

// 5. Replace Form JSX
const formJsxRegex = /<form onSubmit=\{submit\} className="grid grid-cols-2 gap-4">[\s\S]*?<\/form>/;
const newFormJsx = `<form onSubmit={submit} className="flex flex-col gap-6">
  {/* Basic Information */}
  <div className="space-y-4">
    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Basic Information</h3>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Name" className="col-span-2">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Category">
        <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Antibiotic" />
      </Field>
      <Field label="Manufacturer">
        <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
      </Field>
      <Field label="Batch">
        <Input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} />
      </Field>
      <Field label="Expiry (MM/YY)">
        <Input value={form.expiry} onChange={(e) => {
          let val = e.target.value.replace(/[^\\d/]/g, "");
          if (val.length === 2 && form.expiry.length !== 3 && !val.includes("/")) val += "/";
          setForm({ ...form, expiry: val });
        }} required />
      </Field>
      <Field label="HSN Code">
        <div className="flex gap-2">
          <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <Button type="button" variant="outline" size="icon" onClick={(e) => { e.preventDefault(); setScannerOpen(true); }}><ScanLine className="h-4 w-4" /></Button>
        </div>
      </Field>
      <Field label="Tax %">
        <Input type="number" value={form.taxPercent} onChange={(e) => setForm({ ...form, taxPercent: e.target.value })} />
      </Field>
      <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="text-sm font-medium">Prescription required</div>
          <div className="text-xs text-muted-foreground">Mark this product as Rx-only.</div>
        </div>
        <Switch checked={form.prescription} onCheckedChange={(v) => setForm({ ...form, prescription: v })} />
      </div>
    </div>
  </div>

  {/* Packaging */}
  <div className="space-y-4 pt-2 border-t border-border/50">
    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Packaging</h3>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Medicine Type">
        <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.medicineType} onChange={(e) => setForm({ ...form, medicineType: e.target.value })}>
          {["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment", "Drops", "Other"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      {(form.medicineType === "Tablet" || form.medicineType === "Capsule") && (
        <>
          <Field label="Tablets/Capsules Per Strip">
            <Input type="number" value={form.tabletsPerStrip} onChange={(e) => setForm({ ...form, tabletsPerStrip: e.target.value })} required />
          </Field>
          <Field label="Strips Per Box">
            <Input type="number" value={form.stripsPerBox} onChange={(e) => setForm({ ...form, stripsPerBox: e.target.value })} required />
          </Field>
        </>
      )}
    </div>
  </div>

  {/* Purchase */}
  <div className="space-y-4 pt-2 border-t border-border/50">
    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Purchase (Adding Stock)</h3>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Purchase Quantity">
        <Input type="number" value={form.purchaseQuantity} onChange={(e) => setForm({ ...form, purchaseQuantity: e.target.value })} />
      </Field>
      <Field label="Purchase Unit">
        <select className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.purchaseUnit} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })}>
          {form.medicineType === "Tablet" || form.medicineType === "Capsule" ? (
            <>
              <option value="Box">Box</option>
              <option value="Strip">Strip</option>
              <option value="Tablet">Tablet/Capsule</option>
            </>
          ) : (
            <option value="Unit">Unit / Bottle / Tube</option>
          )}
        </select>
      </Field>
      <Field label="Total Purchase Price">
        <Input type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
      </Field>
    </div>
  </div>

  {/* Pricing */}
  <div className="space-y-4 pt-2 border-t border-border/50">
    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider">Selling Price & MRP</h3>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Price (Smallest Unit)">
        <Input type="number" step="0.01" value={form.pricePerTablet} onChange={(e) => {
          const v = e.target.value;
          const tps = Number(form.tabletsPerStrip) || 10;
          const spb = Number(form.stripsPerBox) || 10;
          setForm({
            ...form, 
            pricePerTablet: v, 
            pricePerStrip: v ? String(Number(v) * tps) : "",
            pricePerBox: v ? String(Number(v) * tps * spb) : ""
          });
        }} required />
      </Field>
      <Field label="MRP (Smallest Unit)">
        <Input type="number" step="0.01" value={form.mrpPerTablet} onChange={(e) => {
          const v = e.target.value;
          const tps = Number(form.tabletsPerStrip) || 10;
          const spb = Number(form.stripsPerBox) || 10;
          setForm({
            ...form, 
            mrpPerTablet: v, 
            mrpPerStrip: v ? String(Number(v) * tps) : "",
            mrpPerBox: v ? String(Number(v) * tps * spb) : ""
          });
        }} />
      </Field>
      {(form.medicineType === "Tablet" || form.medicineType === "Capsule") && (
        <>
          <Field label="Price Per Strip">
            <Input type="number" step="0.01" value={form.pricePerStrip} onChange={(e) => {
              const v = e.target.value;
              const tps = Number(form.tabletsPerStrip) || 10;
              const spb = Number(form.stripsPerBox) || 10;
              setForm({
                ...form, 
                pricePerStrip: v, 
                pricePerTablet: v ? String(Number(v) / tps) : "",
                pricePerBox: v ? String(Number(v) * spb) : ""
              });
            }} />
          </Field>
          <Field label="MRP Per Strip">
            <Input type="number" step="0.01" value={form.mrpPerStrip} onChange={(e) => {
              const v = e.target.value;
              const tps = Number(form.tabletsPerStrip) || 10;
              const spb = Number(form.stripsPerBox) || 10;
              setForm({
                ...form, 
                mrpPerStrip: v, 
                mrpPerTablet: v ? String(Number(v) / tps) : "",
                mrpPerBox: v ? String(Number(v) * spb) : ""
              });
            }} />
          </Field>
          <Field label="Price Per Box">
            <Input type="number" step="0.01" value={form.pricePerBox} onChange={(e) => {
              const v = e.target.value;
              const tps = Number(form.tabletsPerStrip) || 10;
              const spb = Number(form.stripsPerBox) || 10;
              setForm({
                ...form, 
                pricePerBox: v, 
                pricePerStrip: v ? String(Number(v) / spb) : "",
                pricePerTablet: v ? String(Number(v) / (tps * spb)) : ""
              });
            }} />
          </Field>
          <Field label="MRP Per Box">
            <Input type="number" step="0.01" value={form.mrpPerBox} onChange={(e) => {
              const v = e.target.value;
              const tps = Number(form.tabletsPerStrip) || 10;
              const spb = Number(form.stripsPerBox) || 10;
              setForm({
                ...form, 
                mrpPerBox: v, 
                mrpPerStrip: v ? String(Number(v) / spb) : "",
                mrpPerTablet: v ? String(Number(v) / (tps * spb)) : ""
              });
            }} />
          </Field>
        </>
      )}
    </div>
  </div>

  <DialogFooter className="mt-4">
    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    <Button type="submit" className="shadow-soft">{editing ? "Save changes" : "Add product"}</Button>
  </DialogFooter>
</form>`;
content = content.replace(formJsxRegex, newFormJsx);

// 6. Fix table columns stock
content = content.replace(
  /\{p\.stock\}/g,
  `{formatStock(p.stock, p.medicineType || "Tablet", Number(p.tabletsPerStrip || 10), Number(p.stripsPerBox || 10))}`
);

fs.writeFileSync(filePath, content);
console.log('Updated _app.inventory.tsx');
