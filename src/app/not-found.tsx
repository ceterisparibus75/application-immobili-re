import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4 p-4">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-muted-foreground text-center max-w-md">
        La page que vous recherchez n&apos;existe pas ou a été déplacée.
      </p>
      <div className="flex gap-3">
        <Link href="/">
          <Button>Retour à l&apos;accueil</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline">Se connecter</Button>
        </Link>
      </div>
    </div>
  );
}
