import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backTo?: string;
}

export default function PageHeader({ eyebrow, title, subtitle, actions, backTo }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
      <div>
        {backTo && (
          <Link
            to={backTo}
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800 mb-3 lg:hidden transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
            Tools
          </Link>
        )}
        {eyebrow && <p className="section-title mb-1.5">{eyebrow}</p>}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink-900">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-ink-600 max-w-2xl leading-relaxed">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
