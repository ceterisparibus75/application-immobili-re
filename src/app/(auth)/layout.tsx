import { Building2 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background: "linear-gradient(145deg, oklch(0.95 0.01 264) 0%, oklch(0.975 0.005 264) 100%)",
      }}
    >
      {/* Carte centrale avec verre givré */}
      <div
        className="w-full max-w-sm rounded-2xl border border-border/40 shadow-2xl p-8"
        style={{
          background: "oklch(1 0 0 / 0.85)",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground tracking-tight">GestImmo</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gestion de baux commerciaux</p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
