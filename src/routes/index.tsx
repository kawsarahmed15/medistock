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
  Sparkles,
  Pill,
  Users,
  Clock,
  Package,
  TrendingUp,
  ScanBarcode,
  CreditCard,
  Star,
  ChevronRight,
  Globe,
} from "lucide-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")(  {
  component: LandingPage,
});

/* ─── Scroll-reveal wrapper ─── */
function Reveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const animClass =
    direction === "left"
      ? "animate-reveal-left"
      : direction === "right"
        ? "animate-reveal-right"
        : "animate-reveal-up";

  return (
    <div
      ref={ref}
      className={`${visible ? animClass : "opacity-0"} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Floating particles background ─── */
function Particles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    size: 2 + Math.random() * 4,
    left: Math.random() * 100,
    top: Math.random() * 100,
    driftX: (Math.random() - 0.5) * 200,
    driftY: -100 - Math.random() * 200,
    duration: 6 + Math.random() * 10,
    delay: Math.random() * 8,
    opacity: 0.15 + Math.random() * 0.3,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-primary animate-particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            top: `${p.top}%`,
            opacity: p.opacity,
            "--drift-x": `${p.driftX}px`,
            "--drift-y": `${p.driftY}px`,
            "--duration": `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ─── Animated counter ─── */
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let frame: number;
    const duration = 2000;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [started, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

function LandingPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30 relative">
      {/* ═══════════ AURORA BACKGROUND ═══════════ */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
        <div
          className="absolute w-[600px] h-[600px] rounded-full animate-aurora animate-morph-blob"
          style={{
            top: "-10%",
            left: "-5%",
            background:
              "radial-gradient(circle, oklch(0.62 0.13 175 / 0.25) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute w-[800px] h-[800px] rounded-full animate-aurora animate-morph-blob"
          style={{
            top: "15%",
            right: "-15%",
            background:
              "radial-gradient(circle, oklch(0.78 0.12 175 / 0.2) 0%, transparent 70%)",
            animationDelay: "3s",
          }}
        />
        <div
          className="absolute w-[700px] h-[700px] rounded-full animate-aurora animate-morph-blob"
          style={{
            bottom: "-20%",
            left: "25%",
            background:
              "radial-gradient(circle, oklch(0.68 0.15 155 / 0.15) 0%, transparent 70%)",
            animationDelay: "6s",
          }}
        />
        <Particles />
      </div>

      {/* ═══════════ NAVBAR ═══════════ */}
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          scrolled
            ? "bg-background/80 backdrop-blur-2xl border-b border-border/50 shadow-soft"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow animate-glow-pulse">
              <Pill className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent tracking-tight">
              MediStock
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {["Features", "About", "Testimonials", "Pricing"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="relative text-muted-foreground hover:text-foreground transition-colors group"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary rounded-full group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium hover:text-primary transition-colors hidden sm:block px-4 py-2 rounded-full hover:bg-primary/5"
            >
              Log in
            </Link>
            <Link to="/signup">
              <Button className="rounded-full shadow-glow bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold px-6 transition-all duration-300 hover:shadow-[0_10px_40px_-10px_oklch(0.62_0.13_175/0.5)] hover:scale-105">
                Start Free Trial
                <Sparkles className="ml-1.5 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <main className="relative z-10 pt-20">
        {/* ─── HERO SECTION ─── */}
        <section className="container mx-auto px-6 pt-24 sm:pt-32 pb-16 text-center relative">
          {/* Floating decorative elements */}
          <div className="absolute top-20 left-[10%] w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 animate-float opacity-40 hidden lg:block" style={{ animationDelay: "0s" }} />
          <div className="absolute top-40 right-[8%] w-14 h-14 rounded-full bg-success/10 border border-success/20 animate-float opacity-30 hidden lg:block" style={{ animationDelay: "2s" }} />
          <div className="absolute bottom-20 left-[15%] w-10 h-10 rounded-lg bg-warning/10 border border-warning/20 animate-float opacity-30 hidden lg:block" style={{ animationDelay: "4s" }} />

          <div
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass text-primary font-medium text-sm mb-8 gradient-border animate-reveal-up"
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Trusted by 2,000+ Pharmacies across India</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8 max-w-5xl mx-auto leading-[1.1] animate-reveal-up"
            style={{ animationDelay: "100ms" }}
          >
            Smart Pharmacy{" "}
            <br className="hidden sm:block" />
            <span className="relative inline-block">
              <span
                className="bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent animate-text-gradient"
                style={{ backgroundSize: "300% 300%" }}
              >
                Management
              </span>
              {/* Decorative underline */}
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 300 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M2 8.5C50 2 100 2 150 6C200 10 250 4 298 7.5"
                  stroke="url(#underline-grad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                <defs>
                  <linearGradient id="underline-grad" x1="0" y1="0" x2="300" y2="0" gradientUnits="userSpaceOnUse">
                    <stop stopColor="oklch(0.62 0.13 175)" />
                    <stop offset="0.5" stopColor="oklch(0.82 0.11 175)" />
                    <stop offset="1" stopColor="oklch(0.62 0.13 175)" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h1>

          <p
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-reveal-up leading-relaxed"
            style={{ animationDelay: "200ms" }}
          >
            Elevate your medical store with intelligent inventory tracking, seamless
            billing, and real-time analytics. Built for modern healthcare professionals.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-reveal-up"
            style={{ animationDelay: "300ms" }}
          >
            <Link to="/signup">
              <Button
                size="lg"
                className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow text-lg h-14 px-8 w-full sm:w-auto hover:scale-105 hover:shadow-[0_15px_50px_-12px_oklch(0.62_0.13_175/0.6)] transition-all duration-300 group"
              >
                Get Started for Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#features">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full glass hover:bg-primary/5 text-lg h-14 px-8 w-full sm:w-auto border-border/30 transition-all duration-300"
              >
                Explore Features
              </Button>
            </a>
          </div>
        </section>

        {/* ─── STATS BAR ─── */}
        <section className="container mx-auto px-6 pb-16">
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto">
              {[
                { value: 2000, suffix: "+", label: "Pharmacies", icon: Package },
                { value: 5, suffix: "M+", label: "Bills Generated", icon: CreditCard },
                { value: 99, suffix: ".9%", label: "Uptime", icon: Clock },
                { value: 24, suffix: "/7", label: "Support", icon: Users },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="glass rounded-2xl p-5 text-center hover-lift group"
                >
                  <stat.icon className="w-5 h-5 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-2xl md:text-3xl font-bold text-foreground">
                    <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-xs text-muted-foreground font-medium mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ─── DASHBOARD PREVIEW (Glassmorphism) ─── */}
        <section className="container mx-auto px-6 pb-32">
          <Reveal>
            <div className="relative rounded-2xl md:rounded-[2rem] glass shadow-2xl p-2 md:p-3 overflow-hidden gradient-border group">
              {/* Glow behind the image */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-primary-glow/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative rounded-xl md:rounded-[1.5rem] overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=2000&q=80"
                  alt="MediStock Dashboard Preview"
                  className="w-full h-[280px] md:h-[550px] object-cover opacity-80 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                {/* Bottom floating badge */}
                <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 glass rounded-full px-5 py-2.5 flex items-center gap-2 text-sm font-medium">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live Dashboard Preview
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ─── FEATURES SECTION ─── */}
        <section id="features" className="py-24 relative">
          <div className="container mx-auto px-6">
            <Reveal>
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Sparkles className="w-4 h-4" />
                  Powerful Features
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-4">
                  Everything you need to{" "}
                  <span className="text-shimmer">scale</span>
                </h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Our platform provides end-to-end solutions for pharmacies, clinics, and
                  medical suppliers.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Database,
                  title: "Real-time Inventory",
                  desc: "Track medicines, check expiry dates, and get low-stock alerts automatically.",
                  color: "from-teal-500/20 to-cyan-500/20",
                  iconColor: "text-teal-500",
                },
                {
                  icon: ScanBarcode,
                  title: "Barcode Scanning",
                  desc: "Scan barcodes and QR codes for instant product lookup and seamless checkout.",
                  color: "from-violet-500/20 to-purple-500/20",
                  iconColor: "text-violet-500",
                },
                {
                  icon: Zap,
                  title: "Lightning Fast Billing",
                  desc: "Cart-based checkout with instant invoice generation and PDF download.",
                  color: "from-amber-500/20 to-orange-500/20",
                  iconColor: "text-amber-500",
                },
                {
                  icon: BarChart3,
                  title: "Advanced Analytics",
                  desc: "Understand sales trends, top-selling medicines, and revenue growth at a glance.",
                  color: "from-blue-500/20 to-indigo-500/20",
                  iconColor: "text-blue-500",
                },
                {
                  icon: Shield,
                  title: "Secure & Compliant",
                  desc: "Bank-level security ensuring your patient data and financial records are safe.",
                  color: "from-emerald-500/20 to-green-500/20",
                  iconColor: "text-emerald-500",
                },
                {
                  icon: TrendingUp,
                  title: "Credit Management",
                  desc: "Track customer credit, record payments, and manage outstanding balances effortlessly.",
                  color: "from-rose-500/20 to-pink-500/20",
                  iconColor: "text-rose-500",
                },
              ].map((feature, idx) => (
                <Reveal key={idx} delay={idx * 80}>
                  <div className="group relative p-7 rounded-2xl glass hover-lift overflow-hidden h-full">
                    {/* Hover glow */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                    />
                    <div className="relative z-10">
                      <div
                        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                      >
                        <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── ABOUT SECTION ─── */}
        <section id="about" className="py-24 relative overflow-hidden">
          {/* Decorative blob */}
          <div
            className="absolute -left-40 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full animate-morph-blob opacity-10"
            style={{
              background:
                "radial-gradient(circle, oklch(0.62 0.13 175) 0%, transparent 70%)",
            }}
            aria-hidden
          />
          <div className="container mx-auto px-6 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              <Reveal direction="right" className="flex-1">
                <div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                    <HeartPulse className="w-4 h-4" />
                    Our Mission
                  </div>
                  <h2 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                    Built by Healthcare{" "}
                    <span className="text-shimmer">Tech Veterans</span>
                  </h2>
                  <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                    We noticed that independent pharmacies and medical stores were
                    struggling with outdated, clunky software. MediStock was born to
                    bring modern, sleek, and highly efficient tools to the medical
                    retail space.
                  </p>
                  <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                    Our goal is simple: let you focus on patient care while we automate
                    your inventory, compliance, and billing.
                  </p>
                  <ul className="space-y-4">
                    {[
                      { text: "99.9% Uptime Guarantee", icon: Activity },
                      { text: "24/7 Dedicated Support", icon: Users },
                      { text: "Seamless Data Migration", icon: Globe },
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-3 text-foreground font-medium group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <item.icon className="text-primary w-4 h-4" />
                        </div>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal direction="left" className="flex-1 w-full">
                <div className="relative">
                  {/* Glow behind the image */}
                  <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-primary-glow/20 rounded-3xl blur-2xl opacity-40 animate-pulse" style={{ animationDuration: "4s" }} />
                  <div className="relative rounded-3xl overflow-hidden glass shadow-2xl group">
                    <img
                      src="https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1000&q=80"
                      alt="Pharmacy team using MediStock"
                      className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
                  </div>
                  {/* Floating badge */}
                  <div className="absolute -bottom-4 -right-4 md:bottom-6 md:right-6 glass rounded-2xl p-4 shadow-soft animate-float" style={{ animationDelay: "1s" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Revenue Growth</div>
                        <div className="text-lg font-bold text-green-500">+47%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─── */}
        <section id="testimonials" className="py-24 relative">
          <div className="container mx-auto px-6">
            <Reveal>
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <Star className="w-4 h-4" />
                  Testimonials
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-4">
                  Loved by <span className="text-shimmer">pharmacists</span>{" "}
                  everywhere
                </h2>
                <p className="text-muted-foreground text-lg">
                  Hear what our partners have to say.
                </p>
              </div>
            </Reveal>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  quote:
                    "MediStock completely transformed how we handle our inventory. We no longer worry about expired meds, and billing is blazing fast.",
                  author: "Dr. Sarah Jenkins",
                  role: "City Health Pharmacy",
                  avatar: "S",
                  color: "from-teal-500 to-cyan-500",
                },
                {
                  quote:
                    "The interface is so beautiful and intuitive. My staff learned it in an hour. The expiry alert system for drugs is a game-changer.",
                  author: "Mark Thomas",
                  role: "Owner, MedPlus Stores",
                  avatar: "M",
                  color: "from-violet-500 to-purple-500",
                },
                {
                  quote:
                    "Best SaaS investment we've made. The credit management feature lets me track all pending amounts from my phone anywhere.",
                  author: "Emily Chen",
                  role: "Director of Operations",
                  avatar: "E",
                  color: "from-rose-500 to-pink-500",
                },
              ].map((testi, i) => (
                <Reveal key={i} delay={i * 120}>
                  <div className="relative p-7 rounded-2xl glass hover-lift h-full flex flex-col">
                    <Quote className="absolute top-5 right-5 w-8 h-8 text-primary/10" />
                    {/* Stars */}
                    <div className="flex gap-1 mb-5">
                      {[...Array(5)].map((_, j) => (
                        <Star
                          key={j}
                          className="w-4 h-4 text-amber-400 fill-amber-400"
                        />
                      ))}
                    </div>
                    <p className="text-base mb-8 leading-relaxed text-muted-foreground flex-1">
                      "{testi.quote}"
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${testi.color} flex items-center justify-center text-white font-bold text-sm shadow-soft`}
                      >
                        {testi.avatar}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">
                          {testi.author}
                        </h4>
                        <span className="text-xs text-primary">{testi.role}</span>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section id="pricing" className="py-24 relative">
          {/* Background accent */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.03] to-transparent pointer-events-none"
            aria-hidden
          />
          <div className="container mx-auto px-6 relative z-10">
            <Reveal>
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                  <CreditCard className="w-4 h-4" />
                  Pricing
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6">
                  Simple, <span className="text-shimmer">transparent</span>{" "}
                  pricing
                </h2>
                {/* Toggle */}
                <div className="flex items-center justify-center gap-4">
                  <span
                    className={`text-sm font-medium transition-colors ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    Monthly
                  </span>
                  <button
                    onClick={() => setIsAnnual(!isAnnual)}
                    className="w-14 h-8 bg-primary/20 rounded-full relative transition-colors focus:outline-none hover:bg-primary/30"
                    aria-label="Toggle annual pricing"
                  >
                    <div
                      className={`w-6 h-6 bg-primary rounded-full absolute top-1 transition-all duration-300 shadow-soft ${isAnnual ? "translate-x-7" : "translate-x-1"}`}
                    />
                  </button>
                  <span
                    className={`text-sm font-medium transition-colors ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    Annually{" "}
                    <span className="text-green-500 text-xs font-bold ml-1 px-2 py-0.5 rounded-full bg-green-500/10">
                      Save 30%
                    </span>
                  </span>
                </div>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
              {/* Retailer */}
              <Reveal delay={0}>
                <div className="p-7 rounded-2xl glass hover-lift flex flex-col h-full">
                  <h3 className="text-xl font-bold mb-2">Retailer</h3>
                  <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">
                    Perfect for single small pharmacies getting started.
                  </p>
                  <div className="mb-2">
                    <span className="text-4xl font-extrabold">
                      ₹{isAnnual ? "129" : "149"}
                    </span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  {isAnnual ? (
                    <p className="text-xs text-green-500 font-medium mb-6">
                      Billed ₹1,548 yearly
                    </p>
                  ) : (
                    <p className="text-xs text-primary font-medium mb-6">
                      1 Month Free included
                    </p>
                  )}
                  <ul className="space-y-3 mb-8 flex-1">
                    {[
                      "Up to 5,000 SKUs",
                      "1 User Account",
                      "Basic Billing",
                      "Standard Support",
                    ].map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup" className="w-full">
                    <Button
                      variant="outline"
                      className="w-full rounded-full h-12 hover:bg-primary/5 transition-all duration-300"
                    >
                      Start Free Trial
                    </Button>
                  </Link>
                </div>
              </Reveal>

              {/* Wholesaler (Popular) */}
              <Reveal delay={100}>
                <div className="relative p-7 rounded-2xl glass hover-lift flex flex-col h-full gradient-border animate-glow-pulse">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold shadow-glow">
                    Most Popular ✨
                  </div>
                  <h3 className="text-xl font-bold mb-2">Wholesaler</h3>
                  <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">
                    For growing medical stores with high volume.
                  </p>
                  <div className="mb-2">
                    <span className="text-4xl font-extrabold">
                      ₹{isAnnual ? "239" : "299"}
                    </span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  {isAnnual ? (
                    <p className="text-xs text-green-500 font-medium mb-6">
                      20% Off — Billed ₹2,868 yearly
                    </p>
                  ) : (
                    <p className="text-xs text-primary font-medium mb-6">
                      1 Week Free Trial
                    </p>
                  )}
                  <ul className="space-y-3 mb-8 flex-1">
                    {[
                      "Unlimited SKUs",
                      "Up to 5 User Accounts",
                      "Advanced Analytics",
                      "Batch & Expiry Tracking",
                      "Priority 24/7 Support",
                    ].map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup" className="w-full">
                    <Button className="w-full rounded-full h-12 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 hover:shadow-[0_10px_40px_-10px_oklch(0.62_0.13_175/0.5)] transition-all duration-300">
                      Start 1 Week Free
                    </Button>
                  </Link>
                </div>
              </Reveal>

              {/* Enterprise */}
              <Reveal delay={200}>
                <div className="p-7 rounded-2xl glass hover-lift flex flex-col h-full">
                  <h3 className="text-xl font-bold mb-2">Enterprise</h3>
                  <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">
                    Multi-store chains requiring maximum control.
                  </p>
                  <div className="mb-2">
                    <span className="text-4xl font-extrabold">
                      ₹{isAnnual ? "419" : "599"}
                    </span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  {isAnnual ? (
                    <p className="text-xs text-green-500 font-medium mb-6">
                      30% Off — Billed ₹5,028 yearly
                    </p>
                  ) : (
                    <p className="text-xs text-primary font-medium mb-6">
                      1 Week Free Trial
                    </p>
                  )}
                  <ul className="space-y-3 mb-8 flex-1">
                    {[
                      "Everything in Wholesaler",
                      "Multi-Store Management",
                      "Unlimited Users",
                      "Custom API Access",
                      "Dedicated Account Manager",
                    ].map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <Check className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup" className="w-full">
                    <Button
                      variant="outline"
                      className="w-full rounded-full h-12 hover:bg-primary/5 transition-all duration-300"
                    >
                      Contact Sales
                    </Button>
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── CTA SECTION ─── */}
        <section className="py-24">
          <div className="container mx-auto px-6">
            <Reveal>
              <div className="relative rounded-3xl overflow-hidden glass p-12 md:p-20 text-center gradient-border">
                {/* Background decorations */}
                <div
                  className="absolute -top-20 -right-20 w-60 h-60 rounded-full animate-morph-blob opacity-20"
                  style={{
                    background:
                      "radial-gradient(circle, oklch(0.62 0.13 175) 0%, transparent 70%)",
                  }}
                  aria-hidden
                />
                <div
                  className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full animate-morph-blob opacity-15"
                  style={{
                    background:
                      "radial-gradient(circle, oklch(0.78 0.12 175) 0%, transparent 70%)",
                    animationDelay: "5s",
                  }}
                  aria-hidden
                />
                <div className="relative z-10">
                  <h2 className="text-3xl md:text-5xl font-bold mb-6">
                    Ready to transform your{" "}
                    <span className="text-shimmer">pharmacy?</span>
                  </h2>
                  <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
                    Join thousands of pharmacists who have streamlined their operations
                    with MediStock. Start your free trial today.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link to="/signup">
                      <Button
                        size="lg"
                        className="rounded-full bg-gradient-primary text-primary-foreground shadow-glow text-lg h-14 px-10 hover:scale-105 hover:shadow-[0_15px_50px_-12px_oklch(0.62_0.13_175/0.6)] transition-all duration-300 group"
                      >
                        Get Started for Free
                        <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <Link to="/login">
                      <Button
                        variant="outline"
                        size="lg"
                        className="rounded-full glass text-lg h-14 px-10 border-border/30 hover:bg-primary/5 transition-all duration-300"
                      >
                        Sign in
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══════════ FOOTER ═══════════ */}
        <footer className="border-t border-border/30 bg-background/50 backdrop-blur-md pt-16 pb-8 relative">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div>
                <div className="flex items-center gap-2.5 mb-6">
                  <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
                    <Pill className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="text-xl font-bold tracking-tight">MediStock</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  The complete operating system for modern pharmacies and medical
                  stores.
                </p>
                {/* Social icons placeholder */}
                <div className="flex gap-3">
                  {["X", "In", "Gh"].map((s, i) => (
                    <div
                      key={i}
                      className="w-9 h-9 rounded-lg glass flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                    >
                      {s}
                    </div>
                  ))}
                </div>
              </div>
              {[
                {
                  title: "Product",
                  links: ["Features", "Pricing", "Integrations", "Changelog"],
                },
                {
                  title: "Company",
                  links: ["About Us", "Careers", "Blog", "Contact"],
                },
                {
                  title: "Legal",
                  links: [
                    "Privacy Policy",
                    "Terms of Service",
                    "Cookie Policy",
                    "HIPAA Compliance",
                  ],
                },
              ].map((col, i) => (
                <div key={i}>
                  <h4 className="font-bold mb-4 text-sm">{col.title}</h4>
                  <ul className="space-y-2.5">
                    {col.links.map((link, j) => (
                      <li key={j}>
                        <a
                          href="#"
                          className="text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-border/30 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <span>
                © {new Date().getFullYear()} MediStock Technologies. All rights
                reserved.
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                Made with <HeartPulse className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> in India
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
