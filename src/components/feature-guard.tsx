import React from "react";
import { useBusiness } from "@/lib/business-context";
import type { FeatureKey } from "@/lib/features";

export interface FeatureGuardProps {
  feature: FeatureKey | FeatureKey[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children if the business workspace has the specified feature(s) enabled.
 */
export function FeatureGuard({
  feature,
  fallback = null,
  children,
}: FeatureGuardProps) {
  const { isFeatureEnabled } = useBusiness();

  if (!isFeatureEnabled(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
