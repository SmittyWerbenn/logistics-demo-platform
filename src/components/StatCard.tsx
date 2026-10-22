import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  accent: string;
  /** When set, the whole card becomes a link (e.g. to a pre-filtered list). */
  to?: string;
}

export function StatCard({ label, value, icon: Icon, accent, to }: StatCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-3 text-3xl font-semibold text-slate-900">{value}</p>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
      >
        {content}
      </Link>
    );
  }

  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{content}</div>;
}
