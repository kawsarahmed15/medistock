import React from "react";
import { useBusiness } from "@/lib/business-context";
import type { Permission } from "@/lib/permissions";

export interface PermissionGuardProps {
  permission: Permission | Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children if the user has the required permission(s).
 */
export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { can } = useBusiness();

  if (!can(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
