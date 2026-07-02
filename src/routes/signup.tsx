import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Pill, Building2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

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
  const [role, setRole] = useState<"retailer" | "wholesaler">("retailer");
  const [loading, setLoading] = useState(false);

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
            <div className="space-y-4">
              <Label>Business Type</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole("retailer")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${role === "retailer" ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/50"}`}
                >
                  <Store
                    className={`w-6 h-6 mb-2 ${role === "retailer" ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${role === "retailer" ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    Retailer
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("wholesaler")}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${role === "wholesaler" ? "border-primary bg-primary/5 shadow-soft" : "border-border hover:border-primary/50"}`}
                >
                  <Building2
                    className={`w-6 h-6 mb-2 ${role === "wholesaler" ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${role === "wholesaler" ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    Wholesaler
                  </span>
                </button>
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
