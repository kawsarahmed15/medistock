import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Zap,
  BarChart3,
  Database,
  Quote,
  HeartPulse,
  Stethoscope,
  Activity,
  Check,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">
      {/* Background Aurora Effect */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-50 animate-pulse"
          style={{ animationDuration: "8s" }}
        ></div>
        <div
          className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-secondary/30 rounded-full blur-[150px] mix-blend-screen opacity-50 animate-pulse"
          style={{ animationDuration: "12s", animationDelay: "2s" }}
        ></div>
        <div
          className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-accent/20 rounded-full blur-[140px] mix-blend-screen opacity-50 animate-pulse"
          style={{ animationDuration: "10s", animationDelay: "4s" }}
        ></div>
      </div>

      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl transition-all">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent tracking-tight">
              MediStock
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a
              href="#features"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#about"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </a>
            <a
              href="#testimonials"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Testimonials
            </a>
            <a
              href="#pricing"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm font-medium hover:text-primary transition-colors hidden sm:block"
            >
              Log in
            </Link>
            <Link to="/signup">
              <Button className="rounded-full shadow-glow bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 transition-smooth">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 pt-20">
        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-32 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm mb-8 border border-primary/20 backdrop-blur-sm animate-fade-in">
            <Zap className="w-4 h-4" />
            <span>The #1 SaaS for Medical Inventory</span>
          </div>
          <h1
            className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 max-w-4xl mx-auto leading-tight animate-fade-in"
            style={{ animationDelay: "100ms" }}
          >
            Smart Pharmacy Management, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-primary">Simplified.</span>
          </h1>
          <p
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            Elevate your medical store with AI-driven inventory tracking, seamless billing, and
            real-time analytics. Built for modern healthcare professionals.
          </p>
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
            style={{ animationDelay: "300ms" }}
          >
            <Link to="/signup">
              <Button
                size="lg"
                className="rounded-full shadow-glow text-lg h-14 px-8 w-full sm:w-auto"
              >
                Get Started for Free <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="#pricing">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full bg-background/50 backdrop-blur-sm border-border/50 hover:bg-background/80 text-lg h-14 px-8 w-full sm:w-auto"
              >
                View Pricing
              </Button>
            </Link>
          </div>
        </section>

        {/* Dashboard Preview (Glassmorphism) */}
        <section className="container mx-auto px-6 pb-32">
          <div className="relative rounded-2xl md:rounded-[2rem] border border-white/10 bg-background/30 backdrop-blur-2xl shadow-2xl p-4 md:p-8 overflow-hidden animate-slide-in">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-secondary/5"></div>
            <img
              src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=2000&q=80"
              alt="Dashboard Preview"
              className="rounded-xl md:rounded-2xl border border-white/5 shadow-inner object-cover w-full h-[300px] md:h-[600px] opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-700"
            />
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 relative">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything you need to scale</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Our platform provides end-to-end solutions for pharmacies, clinics, and medical
                suppliers.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Database className="w-8 h-8 text-primary" />,
                  title: "Real-time Inventory",
                  desc: "Track medicines, check expiry dates, and get low-stock alerts automatically.",
                },
                {
                  icon: <Zap className="w-8 h-8 text-secondary" />,
                  title: "Lightning Fast Billing",
                  desc: "Cart-based checkout system with barcode scanning and instant invoice generation.",
                },
                {
                  icon: <BarChart3 className="w-8 h-8 text-accent" />,
                  title: "Advanced Analytics",
                  desc: "Understand your sales trends, top-selling medicines, and revenue growth.",
                },
                {
                  icon: <Shield className="w-8 h-8 text-primary" />,
                  title: "Secure & Compliant",
                  desc: "Bank-level security ensuring your patient data and financial records are safe.",
                },
                {
                  icon: <Activity className="w-8 h-8 text-secondary" />,
                  title: "AI Predictions",
                  desc: "Predict stock requirements based on seasonal diseases and historical data.",
                },
                {
                  icon: <Stethoscope className="w-8 h-8 text-accent" />,
                  title: "Multi-store Management",
                  desc: "Manage multiple pharmacy branches from a single unified dashboard.",
                },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="p-8 rounded-3xl border border-white/5 bg-background/40 backdrop-blur-lg hover:bg-background/60 transition-all duration-300 hover:shadow-glow hover:-translate-y-1"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About Us */}
        <section id="about" className="py-24 bg-primary/5 relative">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center gap-16">
              <div className="flex-1">
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                  Built by Healthcare Tech Veterans
                </h2>
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  We noticed that independent pharmacies and medical stores were struggling with
                  outdated, clunky software. MediStock was born out of a mission to bring modern,
                  sleek, and highly efficient tools to the medical retail space.
                </p>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  Our goal is simple: let you focus on patient care while we automate your
                  inventory, compliance, and billing.
                </p>
                <ul className="space-y-4">
                  {[
                    "99.9% Uptime Guarantee",
                    "24/7 Dedicated Support",
                    "Seamless Data Migration",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-foreground font-medium">
                      <CheckCircle2 className="text-primary w-5 h-5" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 w-full">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                  <img
                    src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1000&q=80"
                    alt="About Us"
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="py-24">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Trusted by over 2,000 pharmacies
              </h2>
              <p className="text-muted-foreground text-lg">Hear what our partners have to say.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  quote:
                    "MediStock completely transformed how we handle our inventory. We no longer worry about expired meds, and billing is blazing fast.",
                  author: "Dr. Sarah Jenkins",
                  role: "City Health Pharmacy",
                },
                {
                  quote:
                    "The interface is so beautiful and intuitive. My staff learned it in an hour. The AI predictions for seasonal drugs is a game-changer.",
                  author: "Mark T.",
                  role: "Owner, MedPlus Stores",
                },
                {
                  quote:
                    "Best SaaS investment we've made. The multi-store feature lets me track all 5 of my branches from my iPad at home.",
                  author: "Emily Chen",
                  role: "Director of Operations",
                },
              ].map((testi, i) => (
                <div
                  key={i}
                  className="p-8 rounded-3xl border border-white/10 bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-xl relative"
                >
                  <Quote className="absolute top-6 right-6 w-8 h-8 text-primary/20" />
                  <div className="flex gap-1 mb-6 text-yellow-500">
                    {[...Array(5)].map((_, j) => (
                      <StarIcon key={j} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-lg mb-8 leading-relaxed italic text-muted-foreground">
                    "{testi.quote}"
                  </p>
                  <div>
                    <h4 className="font-bold text-foreground">{testi.author}</h4>
                    <span className="text-sm text-primary">{testi.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 relative">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Simple, transparent pricing</h2>
              <div className="flex items-center justify-center gap-4">
                <span className={!isAnnual ? "font-bold" : "text-muted-foreground"}>Monthly</span>
                <button
                  onClick={() => setIsAnnual(!isAnnual)}
                  className="w-14 h-8 bg-primary/20 rounded-full relative transition-colors focus:outline-none"
                >
                  <div
                    className={`w-6 h-6 bg-primary rounded-full absolute top-1 transition-transform ${isAnnual ? "translate-x-7" : "translate-x-1"}`}
                  ></div>
                </button>
                <span className={isAnnual ? "font-bold" : "text-muted-foreground"}>
                  Annually <span className="text-green-500 text-sm ml-1">(Save up to 30%)</span>
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
              {/* Basic Plan */}
              <div className="p-8 rounded-3xl border border-white/5 bg-background/50 backdrop-blur-lg flex flex-col">
                <h3 className="text-2xl font-bold mb-2">Basic</h3>
                <p className="text-muted-foreground mb-6 h-12">
                  Perfect for single small pharmacies getting started.
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">${isAnnual ? "129" : "149"}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                {isAnnual ? (
                  <p className="text-sm text-green-500 font-medium mb-6">Billed $1,548 yearly</p>
                ) : (
                  <p className="text-sm text-primary font-medium mb-6">1 Month Free included</p>
                )}
                <ul className="space-y-4 mb-8 flex-1">
                  {["Up to 5,000 SKUs", "1 User Account", "Basic Billing", "Standard Support"].map(
                    (f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-primary" />{" "}
                        <span className="text-sm text-muted-foreground">{f}</span>
                      </li>
                    ),
                  )}
                </ul>
                <Link to="/signup" className="w-full">
                  <Button variant="outline" className="w-full rounded-full h-12">
                    Start Free Trial
                  </Button>
                </Link>
              </div>

              {/* Pro Plan */}
              <div className="p-8 rounded-3xl border-2 border-primary bg-primary/5 backdrop-blur-lg flex flex-col relative transform md:-translate-y-4 shadow-glow">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                  Most Popular
                </div>
                <h3 className="text-2xl font-bold mb-2">Pro</h3>
                <p className="text-muted-foreground mb-6 h-12">
                  For growing medical stores with high volume.
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">${isAnnual ? "239" : "299"}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                {isAnnual ? (
                  <p className="text-sm text-green-500 font-medium mb-6">
                    20% Off (Billed $2,868 yearly)
                  </p>
                ) : (
                  <p className="text-sm text-primary font-medium mb-6">1 Week Free Trial</p>
                )}
                <ul className="space-y-4 mb-8 flex-1">
                  {[
                    "Unlimited SKUs",
                    "Up to 5 User Accounts",
                    "Advanced Analytics",
                    "Batch & Expiry Tracking",
                    "Priority 24/7 Support",
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-primary" />{" "}
                      <span className="text-sm font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="w-full">
                  <Button className="w-full rounded-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-smooth">
                    Start 1 Week Free
                  </Button>
                </Link>
              </div>

              {/* Enterprise Plan */}
              <div className="p-8 rounded-3xl border border-white/5 bg-background/50 backdrop-blur-lg flex flex-col">
                <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                <p className="text-muted-foreground mb-6 h-12">
                  Multi-store chains requiring maximum control.
                </p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">${isAnnual ? "419" : "599"}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                {isAnnual ? (
                  <p className="text-sm text-green-500 font-medium mb-6">
                    30% Off (Billed $5,028 yearly)
                  </p>
                ) : (
                  <p className="text-sm text-primary font-medium mb-6">1 Week Free Trial</p>
                )}
                <ul className="space-y-4 mb-8 flex-1">
                  {[
                    "Everything in Pro",
                    "Multi-Store Management",
                    "Unlimited Users",
                    "Custom API Access",
                    "Dedicated Account Manager",
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-primary" />{" "}
                      <span className="text-sm text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="w-full">
                  <Button variant="outline" className="w-full rounded-full h-12">
                    Contact Sales
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 bg-background/80 backdrop-blur-md pt-16 pb-8">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <HeartPulse className="w-6 h-6 text-primary" />
                  <span className="text-xl font-bold tracking-tight">MediStock</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  The complete operating system for modern pharmacies and medical stores.
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Integrations
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Changelog
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      About Us
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Careers
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Blog
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Contact
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      Cookie Policy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="hover:text-primary transition-colors">
                      HIPAA Compliance
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="border-t border-border/40 pt-8 text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} MediStock Technologies Inc. All rights reserved.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function StarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
