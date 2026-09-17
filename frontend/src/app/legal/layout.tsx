"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/legal/privacy-policy", label: "Privacy" },
  { href: "/legal/terms-of-service", label: "Terms" },
  { href: "/legal/cookie-policy", label: "Cookies" },
  { href: "/legal/gdpr", label: "GDPR" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="hh-page">
      <header className="sticky top-16 z-30 border-b bg-background/85 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-4xl items-center justify-center gap-1 px-4 py-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                pathname === l.href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
        <article className="rounded-2xl border bg-card p-6 shadow-soft sm:p-10 md:p-12">
          {children}
        </article>
      </main>
    </div>
  );
}
