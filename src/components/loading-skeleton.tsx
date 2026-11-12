import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="-m-2 sm:-m-3 h-[calc(100vh-44px)] flex flex-col justify-between overflow-hidden bg-gradient-soft select-none animate-fade-in">
      {/* ── Main Content Area ── */}
      <main className="flex-1 overflow-hidden px-4 sm:px-6 py-3 flex flex-col lg:flex-row gap-5 items-stretch min-h-0">
        {/* Left Section: Menu Cards Grid (58-60% width) */}
        <section className="w-full lg:w-[58%] xl:w-[60%] flex flex-col justify-between overflow-y-auto no-scrollbar pr-1">
          <div className="space-y-3.5">
            {/* Billing */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                Billing
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-h-[58px] rounded-xl p-2.5 sm:p-3 border border-neutral-300/70 dark:border-neutral-800 bg-card/75 backdrop-blur-xs flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                      <div className="min-w-0 space-y-1.5">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                    <Skeleton className="w-6 h-6 rounded shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Books & Accounts */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                Books & Accounts
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-h-[58px] rounded-xl p-2.5 sm:p-3 border border-neutral-300/70 dark:border-neutral-800 bg-card/75 backdrop-blur-xs flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                      <div className="min-w-0 space-y-1.5">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                    <Skeleton className="w-6 h-6 rounded shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Registers & Reports */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                Registers & Reports
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-h-[58px] rounded-xl p-2.5 sm:p-3 border border-neutral-300/70 dark:border-neutral-800 bg-card/75 backdrop-blur-xs flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                      <div className="min-w-0 space-y-1.5">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                    <Skeleton className="w-6 h-6 rounded shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* System & Admin */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                System & Admin
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-h-[58px] rounded-xl p-2.5 sm:p-3 border border-neutral-300/70 dark:border-neutral-800 bg-card/75 backdrop-blur-xs flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                      <div className="min-w-0 space-y-1.5">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                    <Skeleton className="w-6 h-6 rounded shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Item Description bar */}
          <div className="mt-3 py-2 px-3.5 rounded-xl bg-card/80 backdrop-blur-xs border border-border/80 shadow-soft flex items-center gap-2 shrink-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-60" />
          </div>
        </section>

        {/* Right Section: Today & Needs Attention panels (40-42% width) */}
        <section className="hidden lg:flex w-[42%] xl:w-[40%] min-w-[340px] flex-col gap-3 justify-between overflow-y-auto no-scrollbar">
          {/* ── Today Card ── */}
          <div className="rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xs shadow-soft p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex items-center gap-1">
                <Skeleton className="h-6 w-6 rounded-lg" />
                <Skeleton className="h-6 w-6 rounded-lg" />
              </div>
            </div>

            <div className="pt-3 space-y-3">
              <div>
                <Skeleton className="h-3 w-20 mb-1" />
                <Skeleton className="h-8 w-44" />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-xs">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Needs Attention Card ── */}
          <div className="rounded-2xl border border-border/80 bg-card/75 backdrop-blur-xs shadow-soft p-4 flex flex-col justify-between flex-1">
            <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-14" />
            </div>

            <div className="py-2 space-y-2 flex-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl border border-border/60 bg-muted/30 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-2.5 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-14 rounded-lg shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Bottom Shortcut Footer Bar ── */}
      <footer className="h-7.5 bg-card/85 backdrop-blur-md border-t border-border/80 px-4 flex items-center justify-between text-[11px] shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 w-48" />
        </div>
        <Skeleton className="h-3.5 w-36" />
      </footer>
    </div>
  );
}

export const MainMenuSkeleton = DashboardSkeleton;

export function ReportsOverviewSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="shadow-soft border-border/60">
            <CardContent className="p-3.5 space-y-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-soft">
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent className="h-60">
          <Skeleton className="h-full w-full rounded-lg" />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-10 w-64" />
      </div>
      <Card className="shadow-soft overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex gap-4 border-b pb-4">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4 py-2">
              {Array.from({ length: cols }).map((_, j) => (
                <Skeleton key={j} className="h-8 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function BillDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="shadow-soft p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20" />
          </Card>
        ))}
      </div>

      <Card className="shadow-soft p-8 space-y-8">
        <div className="flex justify-between items-start border-b pb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-24 ml-auto" />
            <Skeleton className="h-3 w-32 ml-auto" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="sm:text-right space-y-3">
            <Skeleton className="h-3 w-20 sm:ml-auto" />
            <Skeleton className="h-5 w-32 sm:ml-auto" />
            <Skeleton className="h-3 w-16 sm:ml-auto" />
            <Skeleton className="h-5 w-24 sm:ml-auto" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>

        <div className="sm:ml-auto w-full sm:w-64 space-y-3 pt-4 border-t">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex justify-between pt-2 border-t">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function SellSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="shadow-soft p-4 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-9 w-24" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
