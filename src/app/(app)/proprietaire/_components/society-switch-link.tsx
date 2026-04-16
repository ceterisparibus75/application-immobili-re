"use client";

import { useRouter } from "next/navigation";
import { useSociety } from "@/providers/society-provider";
import { cn } from "@/lib/utils";

interface SocietySwitchLinkProps {
  href: string;
  societyId: string;
  className?: string;
  children: React.ReactNode;
}

export function SocietySwitchLink({ href, societyId, className, children }: SocietySwitchLinkProps) {
  const router = useRouter();
  const { societies, setActiveSociety } = useSociety();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    const target = societies.find((s) => s.id === societyId);
    if (target) {
      setActiveSociety(target);
    } else {
      document.cookie = `active-society-id=${societyId};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax;Secure`;
    }
    router.push(href);
  }

  return (
    <a href={href} onClick={handleClick} className={cn(className)}>
      {children}
    </a>
  );
}
