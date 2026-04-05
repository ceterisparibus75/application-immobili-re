export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background: "linear-gradient(145deg, #F0F9FF 0%, #F9FAFB 100%)",
      }}
    >
      {/* Carte centrale avec verre givré */}
      <div
        className="w-full max-w-sm rounded-xl border border-border/40 shadow-brand-lg p-8"
        style={{
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(40px) saturate(200%)",
          WebkitBackdropFilter: "blur(40px) saturate(200%)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mygestia.png" alt="MyGestia" className="h-10" />
          <p className="text-sm text-muted-foreground mt-0.5">Gestion locative intelligente</p>
        </div>

        {children}
      </div>
    </div>
  );
}
