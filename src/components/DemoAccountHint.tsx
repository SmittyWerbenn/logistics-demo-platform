import { useState } from "react";
import { Check, Copy, Info } from "lucide-react";

/**
 * Demo-only credentials panel shown under the login forms. The whole app is a
 * static demo (see README-DEMO.md): the accounts below are seeded into the
 * browser database, so nothing here is a real secret.
 */
export interface DemoAccount {
  label: string;
  email: string;
}

export const DEMO_PASSWORD = "Demo2026!";

/** Superadmin + every staff role that logs in through the admin portal. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: "Superadmin", email: "superadmin@sinartrans-demo.id" },
  { label: "Admin", email: "admin@sinartrans-demo.id" },
  { label: "Viewer", email: "viewer@sinartrans-demo.id" },
];

/** Driver portal accounts. */
export const DEMO_DRIVER_ACCOUNTS: DemoAccount[] = [
  { label: "Driver", email: "driver@sinartrans-demo.id" },
];

export function DemoAccountHint({
  accounts,
  onPick,
  className = "",
}: {
  accounts: DemoAccount[];
  /** Fills the form with the picked account (optional). */
  onPick?: (account: DemoAccount) => void;
  className?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may be unavailable (non-secure origin) - the text is visible anyway.
    }
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  return (
    <div className={`mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 ${className}`}>
      <p className="flex items-center gap-2 text-xs font-semibold text-slate-600">
        <Info size={14} className="shrink-0 text-slate-400" />
        Akun demo
      </p>

      <ul className="mt-3 flex flex-col gap-2">
        {accounts.map((a) => (
          <li key={a.email}>
            <button
              type="button"
              onClick={() => onPick?.(a)}
              className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors ${
                onPick ? "hover:border-blue-400 hover:bg-blue-50" : "cursor-default"
              }`}
            >
              <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{a.label}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800">{a.email}</span>
              <span
                role="button"
                tabIndex={0}
                title="Salin email"
                onClick={(e) => {
                  e.stopPropagation();
                  void copy(a.email, a.email);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    void copy(a.email, a.email);
                  }
                }}
                className="shrink-0 text-slate-400 transition-colors hover:text-slate-700"
              >
                {copied === a.email ? <Check size={13} /> : <Copy size={13} />}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2 border-t border-slate-200 pt-3">
        <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">Password</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800">{DEMO_PASSWORD}</span>
        <button
          type="button"
          title="Salin password"
          onClick={() => void copy(DEMO_PASSWORD, "password")}
          className="shrink-0 text-slate-400 transition-colors hover:text-slate-700"
        >
          {copied === "password" ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Data demo berjalan di browser (tanpa server). Akun lain seperti Client, Mitra, dan Admin kedua juga tersedia - lihat README-DEMO.md.
      </p>
    </div>
  );
}
