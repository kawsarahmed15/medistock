/**
 * Pharmaceutical packaging and dual-unit (Strip & Pc) conversion utilities.
 */

export function isTabOrCap(stockType?: string, pack?: string, name?: string): boolean {
  if (stockType === "tab" || stockType === "cap") return true;
  if (stockType && stockType !== "other" && stockType !== "") return false;

  const packStr = String(pack || "").toUpperCase().trim();
  const nameStr = String(name || "").toUpperCase().trim();

  if (
    packStr.includes("X") ||
    packStr.includes("*") ||
    packStr.includes("CAP") ||
    packStr.includes("TAB") ||
    packStr.endsWith("'S") ||
    packStr.endsWith("S")
  ) {
    return true;
  }

  if (
    nameStr.includes(" TAB") ||
    nameStr.includes(" CAP") ||
    nameStr.includes("TABLET") ||
    nameStr.includes("CAPSULE")
  ) {
    return true;
  }

  return false;
}

/**
 * Parses pieces (tablets/capsules) per strip from a pack string or default.
 * E.g., "10X15" -> 15, "10X10" -> 10, "10'S" -> 10, "15" -> 15.
 */
export function getPiecesPerStrip(pack?: string, stockType?: string): number {
  const packStr = String(pack || "").toUpperCase().trim();
  if (!packStr) {
    return (stockType === "tab" || stockType === "cap") ? 10 : 1;
  }

  // Check if pack format has 'X' or '*' e.g. "10X15", "10X1X10", "20X10"
  if (packStr.includes("X") || packStr.includes("*")) {
    const parts = packStr.split(/[X*]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      const match = lastPart.match(/\d+/);
      if (match) {
        const val = parseInt(match[0], 10);
        if (val > 0) return val;
      }
    }
  }

  // Format like "10'S", "10S", "10TAB"
  const sMatch = packStr.match(/^(\d+)\s*('?S|TAB|CAP)?$/i);
  if (sMatch) {
    const val = parseInt(sMatch[1], 10);
    if (val > 0) return val;
  }

  // Pure digits
  const num = parseInt(packStr, 10);
  if (!isNaN(num) && num > 0) {
    return num;
  }

  return (stockType === "tab" || stockType === "cap") ? 10 : 1;
}

/**
 * Splits a total quantity (in strips) into full strips and loose pieces.
 */
export function splitQtyToStripAndPc(
  totalStripsQty: number,
  piecesPerStrip: number
): { strips: number; pcs: number; totalPieces: number } {
  const pps = Math.max(1, piecesPerStrip || 1);
  const totalPieces = Math.round(Number(totalStripsQty || 0) * pps);
  const strips = Math.floor(totalPieces / pps);
  const pcs = totalPieces % pps;
  return { strips, pcs, totalPieces };
}

/**
 * Combines strips and loose pieces into a single decimal strip quantity.
 */
export function combineStripAndPcToQty(
  strips: number,
  pcs: number,
  piecesPerStrip: number
): number {
  const pps = Math.max(1, piecesPerStrip || 1);
  const totalPcs = (Math.max(0, strips) * pps) + Math.max(0, pcs);
  return Number((totalPcs / pps).toFixed(4));
}

/**
 * Formats a quantity into a human-readable Strip and Pc display string.
 */
export function formatStripPcDisplay(
  totalStripsQty: number,
  piecesPerStrip: number,
  stockType?: string,
  pack?: string,
  name?: string
): string {
  const isTabletOrCapsule = isTabOrCap(stockType, pack, name);
  if (!isTabletOrCapsule || piecesPerStrip <= 1) {
    const qtyNum = Number(totalStripsQty || 0);
    return `${qtyNum} ${qtyNum === 1 ? "Pc" : "Pcs"}`;
  }

  const { strips, pcs } = splitQtyToStripAndPc(totalStripsQty, piecesPerStrip);
  if (strips > 0 && pcs > 0) {
    return `${strips} ${strips === 1 ? "Strip" : "Strips"}, ${pcs} ${pcs === 1 ? "Pc" : "Pcs"}`;
  }
  if (strips > 0) {
    return `${strips} ${strips === 1 ? "Strip" : "Strips"}`;
  }
  if (pcs > 0) {
    return `${pcs} ${pcs === 1 ? "Pc" : "Pcs"}`;
  }
  return "0 Strips";
}

/**
 * Calculates line price for a given number of strips and loose pcs.
 */
export function calculateLinePrice(
  strips: number,
  pcs: number,
  stripPrice: number,
  piecesPerStrip: number
): number {
  const pps = Math.max(1, piecesPerStrip || 1);
  const unitPcPrice = (stripPrice || 0) / pps;
  const raw = (Math.max(0, strips) * (stripPrice || 0)) + (Math.max(0, pcs) * unitPcPrice);
  return Number(raw.toFixed(2));
}

/**
 * Returns the unit price per piece (tablet/capsule).
 */
export function getPerPcPrice(stripPrice: number, piecesPerStrip: number): number {
  const pps = Math.max(1, piecesPerStrip || 1);
  return Number(((stripPrice || 0) / pps).toFixed(2));
}
