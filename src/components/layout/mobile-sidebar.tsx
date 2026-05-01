"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MOBILE_NAV_GROUPS } from "./navigation-config";
import { ProprietaireSwitcher } from "./proprietaire-switcher";
import { SocietySwitcher } from "./society-switcher";

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fermer le menu"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation principale"
        className="fixed inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-sidebar-border bg-sidebar animate-slide-in-left"
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mygestia.svg" alt="MyGestia" className="h-7" width={108} height={28} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 px-3 py-3 border-b border-sidebar-border">
          <ProprietaireSwitcher />
          <SocietySwitcher />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" aria-label="Navigation mobile">
          {MOBILE_NAV_GROUPS.map((group, gi) => (
            <div key={group.title} className={cn(gi > 0 && "mt-4")}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-muted/60 select-none">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <item.icon className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-primary" : "text-sidebar-muted/50 group-hover:text-sidebar-muted"
                      )} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}

