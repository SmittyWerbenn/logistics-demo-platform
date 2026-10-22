import type { ComponentProps } from "react";

/** Shared look of every action in a table's "Aksi" column: each action is a small, clearly bordered
 * button (never a bare icon), colored by what it does. Icon-only by default (32px square);
 * pass `labeled` for icon + text. Same visual language as the "Kembali" button, just more compact. */
export type ActionTone = "view" | "track" | "update" | "print" | "edit" | "danger" | "success" | "warn" | "hold" | "neutral";

const TONES: Record<ActionTone, string> = {
  view: "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100",
  track: "border-cyan-200 bg-cyan-50 text-cyan-700 hover:border-cyan-300 hover:bg-cyan-100",
  update: "border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-300 hover:bg-teal-100",
  print: "border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100",
  edit: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100",
  danger: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
  warn: "border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100",
  hold: "border-orange-300 bg-orange-50 text-orange-700 hover:border-orange-400 hover:bg-orange-100",
  neutral: "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50",
};

const BASE =
  "inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border shadow-sm transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

/** className for any <button>/<Link> acting as a table action. */
export function actionClass(tone: ActionTone, labeled = false): string {
  return `${BASE} ${TONES[tone]} ${labeled ? "h-8 gap-1.5 whitespace-nowrap px-2.5 text-xs font-semibold" : "h-8 w-8"}`;
}

/** Wrapper for a row's actions: separate buttons with a visible gap, wrapping instead of collapsing on narrow screens. */
export const ACTION_ROW = "flex flex-wrap items-center gap-2";

export function ActionButton({ tone, labeled, className = "", ...rest }: ComponentProps<"button"> & { tone: ActionTone; labeled?: boolean }) {
  return <button type="button" {...rest} className={`${actionClass(tone, labeled)} ${className}`} />;
}
