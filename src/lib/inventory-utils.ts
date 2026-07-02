export function calculateSmallestUnits(
  qty: number,
  unit: "Box" | "Strip" | "Tablet" | string,
  medicineType: string,
  tabletsPerStrip: number,
  stripsPerBox: number
): number {
  const isTabCap = medicineType === "Tablet" || medicineType === "Capsule";
  if (!isTabCap) return qty; // For Syrups, Creams, etc., 1 Unit = 1

  const tps = tabletsPerStrip || 10;
  const spb = stripsPerBox || 10;

  if (unit === "Box") return qty * spb * tps;
  if (unit === "Strip") return qty * tps;
  return qty; // Tablet
}

export function formatStock(
  stock: number,
  medicineType: string,
  tabletsPerStrip: number,
  stripsPerBox: number
): string {
  const isTabCap = medicineType === "Tablet" || medicineType === "Capsule";
  if (!isTabCap) return `${stock} Units`;

  const tps = tabletsPerStrip || 10;
  const spb = stripsPerBox || 10;
  const tabletsPerBox = tps * spb;

  let remaining = stock;
  const boxes = Math.floor(remaining / tabletsPerBox);
  remaining %= tabletsPerBox;

  const strips = Math.floor(remaining / tps);
  const tablets = remaining % tps;

  const parts = [];
  if (boxes > 0) parts.push(`${boxes} Box${boxes > 1 ? "es" : ""}`);
  if (strips > 0) parts.push(`${strips} Strip${strips > 1 ? "s" : ""}`);
  if (tablets > 0 || parts.length === 0) parts.push(`${tablets} Tab${tablets > 1 ? "s" : ""}`);

  return parts.join(" ");
}
