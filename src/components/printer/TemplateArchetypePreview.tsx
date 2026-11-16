import React from "react";
import { cn } from "@/lib/utils";

interface ArchetypePreviewProps {
  archetype: string;
  color?: string;
  isSelected?: boolean;
}

export const TemplateArchetypePreview: React.FC<ArchetypePreviewProps> = ({
  archetype,
  color = "#0a5c55",
  isSelected = false,
}) => {
  return (
    <div
      className={cn(
        "w-full aspect-[210/148] rounded-md border bg-white p-2 flex flex-col justify-between overflow-hidden select-none transition-all duration-200 shadow-2xs",
        isSelected
          ? "ring-2 ring-offset-1 border-primary"
          : "border-slate-200 hover:border-slate-300",
      )}
      style={{ boxShadow: isSelected ? `0 0 0 2px ${color}` : undefined }}
    >
      {/* 0. ORIGINAL CLASSIC A4 */}
      {archetype === "original-a4" && (
        <div className="w-full h-full border border-slate-300 rounded p-1 flex flex-col justify-between">
          <div className="flex justify-between items-start border-b border-slate-300 pb-0.5">
            <div className="flex items-center gap-1">
              <div
                className="w-3.5 h-3.5 rounded-xs flex items-center justify-center text-[5px] text-white font-bold"
                style={{ background: color }}
              >
                +
              </div>
              <div>
                <div className="h-1.5 w-12 rounded-xs" style={{ background: color }} />
                <div className="h-1 w-8 bg-slate-200 rounded-xs mt-0.5" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-1 w-8 bg-slate-400 rounded-xs" />
              <div className="h-1 w-6 bg-slate-200 rounded-xs mt-0.5" />
            </div>
          </div>
          <div className="h-2 w-full bg-slate-50 border border-slate-200 rounded-xs my-0.5" />
          <div className="flex-1 flex flex-col justify-around py-0.5">
            <div className="h-1 w-full bg-slate-200 rounded-xs" />
            <div className="h-1 w-full bg-slate-100 rounded-xs" />
            <div className="h-1 w-full bg-slate-100 rounded-xs" />
          </div>
          <div className="border-t border-slate-300 pt-0.5 flex justify-between items-center">
            <div className="h-1 w-10 bg-slate-200 rounded-xs" />
            <div
              className="h-2 w-10 rounded-xs text-[5px] font-bold text-white flex items-center justify-center"
              style={{ background: color }}
            >
              ₹ TOTAL
            </div>
          </div>
        </div>
      )}

      {/* 1. MODERN LEDGER */}
      {archetype === "modern-ledger" && (
        <div className="w-full h-full flex flex-col justify-between">
          <div className="border-b pb-0.5 flex justify-between items-start" style={{ borderColor: color }}>
            <div>
              <div className="h-1.5 w-16 rounded-xs" style={{ background: color }} />
              <div className="h-1 w-10 bg-slate-200 rounded-xs mt-0.5" />
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="h-1.5 w-8 rounded-xs" style={{ background: color }} />
              <div className="h-1 w-6 bg-slate-300 rounded-xs mt-0.5" />
            </div>
          </div>
          <div className="h-2 w-full bg-emerald-50 border border-emerald-200 rounded-xs flex items-center px-1 justify-between my-0.5">
            <div className="h-1 w-10 bg-emerald-300 rounded-xs" />
            <div className="h-1 w-8 bg-emerald-300 rounded-xs" />
          </div>
          <div className="flex-1 flex flex-col justify-around py-0.5">
            <div className="h-1.5 w-full rounded-xs flex gap-1" style={{ background: `${color}18` }}>
              <div className="h-full w-3 bg-slate-300 rounded-xs" />
              <div className="h-full flex-1 bg-slate-300 rounded-xs" />
              <div className="h-full w-5 bg-slate-300 rounded-xs" />
            </div>
            <div className="h-1 w-full bg-slate-100 rounded-xs" />
            <div className="h-1 w-full bg-slate-100 rounded-xs" />
          </div>
          <div className="border-t border-slate-300 pt-0.5 flex justify-between items-end">
            <div className="h-1 w-12 bg-slate-200 rounded-xs" />
            <div
              className="h-2.5 w-12 rounded-xs flex items-center justify-center text-[5px] font-bold text-white"
              style={{ background: color }}
            >
              TOTAL
            </div>
          </div>
        </div>
      )}

      {/* 2. CLASSIC BOX */}
      {archetype === "classic-box" && (
        <div className="w-full h-full border border-black p-0.5 flex flex-col justify-between">
          <div className="border-b border-black pb-0.5 flex justify-between">
            <div className="h-1.5 w-14 bg-black rounded-xs" />
            <div className="h-1 w-10 bg-slate-400 rounded-xs" />
          </div>
          <div className="h-2 w-full bg-[#bcd0e3] border-y border-black my-0.5 flex items-center px-1">
            <div className="h-1 w-full bg-blue-400 rounded-xs" />
          </div>
          <div className="flex-1 flex flex-col justify-around">
            <div className="h-1 w-full border-b border-dashed border-slate-300" />
            <div className="h-1 w-full border-b border-dashed border-slate-300" />
            <div className="h-1 w-full border-b border-dashed border-slate-300" />
          </div>
          <div className="border-t border-black pt-0.5 flex justify-between items-center">
            <div className="h-1 w-8 bg-slate-300 rounded-xs" />
            <div className="h-2 w-10 border border-black flex items-center justify-center text-[5px] font-bold">
              ₹ NET
            </div>
          </div>
        </div>
      )}

      {/* 3. SIDEBAR LEDGER */}
      {archetype === "sidebar-ledger" && (
        <div className="w-full h-full flex gap-1">
          <div className="w-[30%] h-full bg-slate-100 border border-slate-400 p-0.5 flex flex-col justify-between">
            <div>
              <div className="h-1.5 w-8 bg-black rounded-xs mb-0.5" />
              <div className="h-1 w-full bg-slate-300 rounded-xs mb-0.5" />
              <div className="h-1 w-6 bg-slate-300 rounded-xs" />
            </div>
            <div className="w-3 h-3 bg-slate-300 border border-slate-400 self-center" />
          </div>
          <div className="flex-1 h-full flex flex-col justify-between">
            <div className="h-1.5 w-full bg-slate-200 border-b border-black" />
            <div className="flex-1 flex flex-col justify-around py-0.5">
              <div className="h-1 w-full border-b border-dotted border-slate-400" />
              <div className="h-1 w-full border-b border-dotted border-slate-400" />
            </div>
            <div className="border-t border-black pt-0.5 flex justify-end">
              <div className="h-2.5 w-10 border-2 border-double border-black flex items-center justify-center text-[5px] font-bold">
                TOTAL
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MINIMAL EXECUTIVE */}
      {archetype === "minimal-exec" && (
        <div className="w-full h-full flex flex-col justify-between">
          <div className="border-b border-slate-900 pb-0.5 flex justify-between">
            <div className="h-1.5 w-14 bg-slate-900 rounded-xs" />
            <div className="h-1 w-8 bg-slate-600 rounded-xs" />
          </div>
          <div className="grid grid-cols-2 gap-0.5 py-0.5 border-b border-slate-200">
            <div className="h-1 bg-slate-200 rounded-xs" />
            <div className="h-1 bg-slate-200 rounded-xs" />
          </div>
          <div className="flex-1 flex flex-col justify-around py-0.5">
            <div className="h-1 w-full bg-slate-100 rounded-xs" />
            <div className="h-1 w-full bg-slate-100 rounded-xs" />
          </div>
          <div className="border-t border-slate-900 pt-0.5 flex justify-between items-center">
            <div className="h-1 w-10 bg-slate-300 rounded-xs" />
            <div className="h-2 w-10 bg-slate-900 rounded-xs text-white text-[5px] font-bold flex items-center justify-center">
              ₹ GRAND
            </div>
          </div>
        </div>
      )}

      {/* 5. DARK HEADER */}
      {archetype === "dark-header" && (
        <div className="w-full h-full flex flex-col justify-between">
          <div className="w-full bg-slate-900 text-white p-0.5 rounded-xs flex justify-between items-center">
            <div className="h-1.5 w-12 bg-white rounded-xs" />
            <div className="h-1 w-6 bg-slate-400 rounded-xs" />
          </div>
          <div className="h-1.5 w-full bg-slate-100 border border-slate-200 my-0.5 rounded-xs" />
          <div className="flex-1 flex flex-col justify-around py-0.5">
            <div className="h-1 w-full bg-slate-100 rounded-xs" />
            <div className="h-1 w-full bg-slate-100 rounded-xs" />
          </div>
          <div className="border-t border-slate-900 pt-0.5 flex justify-between items-center">
            <div className="h-1 w-10 bg-slate-300 rounded-xs" />
            <div className="h-2.5 w-11 bg-slate-900 rounded-xs text-white text-[5px] font-bold flex items-center justify-center">
              ₹ TOTAL
            </div>
          </div>
        </div>
      )}

      {/* 6. MODERN GRID / HORIZONTAL / COMPACT / ETC */}
      {archetype !== "original-a4" &&
        archetype !== "modern-ledger" &&
        archetype !== "classic-box" &&
        archetype !== "sidebar-ledger" &&
        archetype !== "minimal-exec" &&
        archetype !== "dark-header" &&
        archetype !== "thermal-80mm" && (
          <div className="w-full h-full flex flex-col justify-between">
            <div className="flex justify-between items-center border-b pb-0.5" style={{ borderColor: color }}>
              <div className="h-1.5 w-12 rounded-xs" style={{ background: color }} />
              <div className="h-1 w-6 bg-slate-300 rounded-xs" />
            </div>
            <div className="flex-1 flex flex-col justify-around py-0.5">
              <div className="h-1 w-full bg-slate-100 rounded-xs" />
              <div className="h-1 w-full bg-slate-100 rounded-xs" />
            </div>
            <div className="border-t pt-0.5 flex justify-between items-center" style={{ borderColor: color }}>
              <div className="h-1 w-8 bg-slate-200 rounded-xs" />
              <div
                className="h-2 w-9 rounded-xs text-[5px] font-bold text-white flex items-center justify-center"
                style={{ background: color }}
              >
                ₹ NET
              </div>
            </div>
          </div>
        )}

      {/* 7. THERMAL 80MM */}
      {archetype === "thermal-80mm" && (
        <div className="w-16 mx-auto h-full border border-dashed border-slate-400 p-1 flex flex-col justify-between font-mono bg-amber-50/20">
          <div className="text-center">
            <div className="h-1 w-10 bg-slate-800 mx-auto rounded-xs mb-0.5" />
            <div className="h-0.5 w-8 bg-slate-300 mx-auto rounded-xs" />
          </div>
          <div className="border-t border-dashed border-slate-300 my-0.5" />
          <div className="flex-1 flex flex-col justify-around">
            <div className="h-0.5 w-full bg-slate-200 rounded-xs" />
            <div className="h-0.5 w-full bg-slate-200 rounded-xs" />
          </div>
          <div className="border-t border-dashed border-slate-400 pt-0.5 flex justify-between">
            <div className="h-1 w-4 bg-slate-400 rounded-xs" />
            <div className="h-1 w-5 bg-black rounded-xs" />
          </div>
        </div>
      )}
    </div>
  );
};
