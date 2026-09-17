import React from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Rendered under the card, separated by a rule. */
  footer?: React.ReactNode;
  /** Wider card for the multi-field register form. */
  wide?: boolean;
}

/**
 * Shared frame for every /login, /register, /forgot and /reset screen so the
 * four pages stay visually identical.
 */
const AuthShell: React.FC<AuthShellProps> = ({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}) => {
  return (
    <div className="hh-page flex items-center justify-center px-4 py-12">
      <div className={wide ? "w-full max-w-lg" : "w-full max-w-md"}>
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2"
            aria-label="HireHeaven home"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-brand">
              <Briefcase size={20} />
            </span>
            <span className="hh-wordmark text-xl font-extrabold tracking-tight">
              HireHeaven
            </span>
          </Link>

          <h1 className="mb-2 text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-soft-lg sm:p-8">
          {children}

          {footer && (
            <div className="mt-6 border-t pt-6 text-center text-sm">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
