"use client";

import { useEffect, useState } from "react";

type Heading = { id: string; text: string };

export function TocClient() {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    let observer: IntersectionObserver | null = null;

    const frame = window.requestAnimationFrame(() => {
      const sections = Array.from(document.querySelectorAll("section[id]"));
      const extracted = sections
        .map((section) => {
          const h2 = section.querySelector("h2");
          return h2 ? { id: section.id, text: h2.textContent?.trim() ?? "" } : null;
        })
        .filter(Boolean) as Heading[];
      setHeadings(extracted);

      if (extracted.length === 0) return;

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActive(entry.target.id);
          });
        },
        { rootMargin: "-10% 0% -75% 0%", threshold: 0 }
      );

      extracted.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) observer?.observe(el);
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  if (headings.length === 0) return null;

  return (
    <div className="border rounded-xl p-5 mb-10 bg-muted/30">
      <p className="text-sm font-semibold mb-3">Sur cette page</p>
      <ul className="space-y-1.5">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`text-sm block transition-colors hover:text-primary ${
                active === h.id ? "text-primary font-medium" : "text-muted-foreground"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
