"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type FaqItem = { q: string; a: string };

export function FaqAccordion({ faqs }: { faqs: FaqItem[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="space-y-2 max-w-3xl">
      {faqs.map((faq, i) => {
        const key = String(i);
        const isOpen = openKey === key;
        return (
          <div key={key} className="border rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenKey(isOpen ? null : key)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/40 transition-colors"
              aria-expanded={isOpen}
            >
              <span className="font-medium text-sm pr-4">{faq.q}</span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-5 pt-3 text-sm text-muted-foreground border-t bg-muted/20 leading-relaxed">
                {faq.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
