import React from "react";
import { Building, ShieldCheck, Zap, Crown, Globe } from "lucide-react";
import { enterpriseConfig } from "./config";

/**
 * Enterprise Banner / Status Card component
 */
export function EnterpriseDashboardBanner() {
  return (
    <div className="rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/5 via-violet-500/5 to-transparent p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0 shadow-sm">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                {enterpriseConfig.name}
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                Active Enterprise Tier
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enterpriseConfig.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/60 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-border/60">
          <ShieldCheck className="h-4 w-4 text-purple-500 shrink-0" />
          <span>Category Locked (Enterprise Mode)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Enterprise Features Overview Card
 */
export function EnterpriseFeaturesList() {
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Active Enterprise Capabilities
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {enterpriseConfig.featureList.map((f) => (
          <div
            key={f.id}
            className="p-3 rounded-lg border border-border bg-card/50 flex items-start gap-2.5 hover:border-purple-500/30 transition-colors"
          >
            <Zap className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
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
