import { Building2 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Panneau gauche — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center">
        <div className="text-center text-primary-foreground">
          <Building2 className="h-16 w-16 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-2">GestImmo</h1>
          <p className="text-lg opacity-80">
            Gestion de baux commerciaux
          </p>
          <p className="text-sm opacity-60 mt-2">
            Multi-sociétés &bull; Multi-utilisateurs
          </p>
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
