import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDeleteImpact, type ImpactItem, type RecycleEntity } from "../utils/recycle";
import { adminPath } from "../utils/urls";

/** Loads what still points at a record (live or already binned). null = still loading. */
export function useImpact(entityType: RecycleEntity, id: string | null, enabled = true): ImpactItem[] | null {
  const [items, setItems] = useState<ImpactItem[] | null>(null);
  useEffect(() => {
    if (!enabled || !id) return;
    let cancelled = false;
    setItems(null);
    getDeleteImpact(entityType, id)
      .then((r) => !cancelled && setItems(r.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [entityType, id, enabled]);
  return items;
}

/** The related data with concrete examples (AWB numbers link to the shipment detail) so it can be traced. */
export function ImpactList({ items, className = "" }: { items: ImpactItem[]; className?: string }) {
  return (
    <ul className={`space-y-2 ${className}`}>
      {items.map((i) => (
        <li key={i.label}>
          <span className="font-semibold">{i.count.toLocaleString("id-ID")}</span> {i.label}
          {i.samples && i.samples.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              {i.samples.map((s) =>
                i.kind === "awb" ? (
                  <Link key={s} to={adminPath(`/resi/${s}`)} target="_blank" rel="noreferrer" className="rounded-md border border-blue-200 bg-white px-1.5 py-0.5 font-mono font-medium text-blue-800 hover:bg-blue-50">
                    {s}
                  </Link>
                ) : (
                  <span key={s} className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700">
                    {s}
                  </span>
                ),
              )}
              {i.count > i.samples.length && <span className="text-slate-500">dan {(i.count - i.samples.length).toLocaleString("id-ID")} lainnya</span>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
