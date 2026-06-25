import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center animate-fade-in">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-smooth hover:bg-primary/90 shadow-soft"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MediStock — Pharma Inventory & Billing" },
      {
        name: "description",
        content:
          "Modern pharmacy inventory management with cart-based selling and automatic bill generation.",
      },
      { property: "og:title", content: "MediStock — Pharma Inventory & Billing" },
      { name: "twitter:title", content: "MediStock — Pharma Inventory & Billing" },
      { name: "description", content: "PharmaFlow Billing manages pharmaceutical inventory and generates bills for sales." },
      { property: "og:description", content: "PharmaFlow Billing manages pharmaceutical inventory and generates bills for sales." },
      { name: "twitter:description", content: "PharmaFlow Billing manages pharmaceutical inventory and generates bills for sales." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/840841f5-23dd-4f7f-9ce9-411135c4119f/id-preview-4107455b--0d42f69c-e64c-47b3-9998-0b7c4309c7e2.lovable.app-1776455478215.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/840841f5-23dd-4f7f-9ce9-411135c4119f/id-preview-4107455b--0d42f69c-e64c-47b3-9998-0b7c4309c7e2.lovable.app-1776455478215.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
