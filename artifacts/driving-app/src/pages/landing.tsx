import { Link } from "wouter";
import { Shield, CheckCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-border bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold">
            LL
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">Learner Log</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="hidden sm:flex">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button>Get Started</Button>
          </Link>
        </div>
      </header>
      
      <main className="flex-1">
        <section className="py-20 md:py-32 px-6 text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            Precision assessment for <br className="hidden md:block"/> professional driving instructors.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            The digital replacement for the clipboard. Track student progress, log TMR and Q-SAFE maneuvers, and manage your driving school with uncompromised accuracy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="h-12 px-8 text-base">Start Free Trial</Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">Instructor Login</Button>
            </Link>
          </div>
        </section>

        <section className="py-20 bg-gray-50 border-y border-border px-6">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6 text-primary">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Rapid Logging</h3>
              <p className="text-muted-foreground">Tap-friendly assessment interface designed for the passenger seat. Log maneuvers in seconds without looking down.</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6 text-primary">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Clear Progression</h3>
              <p className="text-muted-foreground">Students see exactly what they've mastered and what needs work before their test day.</p>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6 text-primary">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Fleet Management</h3>
              <p className="text-muted-foreground">Admin tools for multi-instructor schools. Oversee hours logged, instructor metrics, and audit logs.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-muted-foreground text-sm border-t border-border">
        <p>&copy; {new Date().getFullYear()} Learner Log. Professional Driving Assessment.</p>
      </footer>
    </div>
  );
}
