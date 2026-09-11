import React from "react";
import { Store, ShieldCheck, Zap, Receipt, AlertCircle } from "lucide-react";
import { retailerConfig } from "./config";

/**
 * Retailer Banner / Status Card component
 */
export function RetailerDashboardBanner() {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                {retailerConfig.name}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Active Retail Tier
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {retailerConfig.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/60 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-border/60">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Category Locked (Retailer Mode)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Retailer Features Overview Card
 */
export function RetailerFeaturesList() {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Active Retailer Capabilities
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {retailerConfig.featureList.map((f) => (
          <div
            key={f.id}
            className="p-3 rounded-lg border border-border bg-card/50 flex items-start gap-2.5 hover:border-emerald-500/30 transition-colors"
          >
            <Zap className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                {f.title}
                {f.tag && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-normal">
                    {f.tag}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                {f.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
