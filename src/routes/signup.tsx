import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Pill, Building2, Store, Building, Lock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { getAllBusinessModules, type BusinessCategory } from "@/features";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { signup, session, ready } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<BusinessCategory>("retailer");
  const [loading, setLoading] = useState(false);

  const modules = getAllBusinessModules();
  const activeModule = modules.find((m) => m.category === role) || modules[0];

  useEffect(() => {
    if (ready && session) navigate({ to: "/dashboard" });
  }, [ready, session, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signup(name, email, password, pharmacyName, role);
      toast.success("Account created — you're signed in");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Image/Branding */}
      <div className="hidden lg:flex w-1/2 bg-primary/5 relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/20"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1000&q=80')] bg-cover bg-center opacity-10 mix-blend-luminosity"></div>
        <div className="relative z-10 max-w-lg p-12 text-center animate-fade-in">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl mx-auto flex items-center justify-center mb-8 shadow-glow">
            <Pill className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-6 tracking-tight">
            Join the modern era of pharma management.
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage your stock, automate your billing, and scale your business effortlessly.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-scale-in">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Create an account</h2>
            <p className="text-muted-foreground">Sign up to get started with MediStock</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">Select Business Category</Label>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Permanent Selection
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {modules.map((m) => {
                  const Icon = m.icon;
                  const isSelected = role === m.category;
                  return (
                    <button
                      key={m.category}
                      type="button"
                      onClick={() => setRole(m.category)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all text-center relative",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-soft ring-1 ring-primary/20"
                          : "border-border hover:border-primary/40 bg-card/40"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                      <Icon
                        className={cn(
                          "w-5 h-5 mb-1.5",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-semibold leading-tight",
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {m.shortTitle}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic summary of selected category */}
              <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-xs space-y-1.5 animate-fade-in">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>{activeModule.name}</span>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", activeModule.badgeClass)}>
                    {activeModule.badgeLabel}
                  </span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {activeModule.signupPitch}
                </p>
                <div className="pt-1 border-t border-border/60 text-[10px] text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                  <span>Category cannot be changed after account creation to protect ledger & tax records.</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pharmacyName">Business Name</Label>
                <Input
                  id="pharmacyName"
                  required
                  placeholder="e.g. Care Pharmacy"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="h-12"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-md shadow-glow transition-smooth"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary hover:underline">
                Sign in here
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
