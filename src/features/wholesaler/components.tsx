import React from "react";
import { Building2, ShieldCheck, Zap, Truck, Layers } from "lucide-react";
import { wholesalerConfig } from "./config";

/**
 * Wholesaler Banner / Status Card component
 */
export function WholesalerDashboardBanner() {
  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-transparent p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 shadow-sm">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                {wholesalerConfig.name}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                Active Wholesaler Tier
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {wholesalerConfig.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/60 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-border/60">
          <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
          <span>Category Locked (Wholesale Mode)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Wholesaler Features Overview Card
 */
export function WholesalerFeaturesList() {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Active Wholesaler Capabilities
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {wholesalerConfig.featureList.map((f) => (
          <div
            key={f.id}
            className="p-3 rounded-lg border border-border bg-card/50 flex items-start gap-2.5 hover:border-blue-500/30 transition-colors"
          >
            <Zap className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
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
