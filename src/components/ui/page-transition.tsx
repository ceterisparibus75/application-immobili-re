"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Wrapper qui anime l'entrée de page à chaque changement de route.
 * Applique une animation CSS fade-in légère pour éviter le "flash blanc".
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (pathname !== lastPath.current) {
      lastPath.current = pathname;
      setVisible(false);
      // Re-trigger l'animation au prochain frame
      requestAnimationFrame(() => {
        setVisible(true);
      });
    }
  }, [pathname]);

  return (
    <div className={visible ? "page-transition-enter" : "opacity-0"}>
      {children}
    </div>
  );
}
