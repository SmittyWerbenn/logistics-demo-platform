import { Camera, Check, MapPin, Monitor } from "lucide-react";
import { C } from "../../data/compro/content";
import type { JourneyStep } from "../../data/compro/journeySteps";
import { TruckArt } from "./TruckArt";
import { useL } from "./utils";

/**
 * Branded scene shown when `JourneyStep.image` is empty. Mock UI uses sample
 * values only (no real customer data).
 */
export function JourneyArt({ step }: { step: JourneyStep }) {
  const l = useL();
  const chip = "rounded-full bg-gms-gold px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-gms-deep";
  const phone = (
    <div className="w-44 rounded-[1.4rem] border-4 border-gms-deep bg-white p-3 shadow-xl">
      <p className="text-[10px] font-bold text-gms-corp">Shipment #GMS123456</p>
      <p className="mt-2 text-[10px] text-slate-500">Status</p>
      <p className="text-xs font-extrabold text-gms-corp">In Transit</p>
      <p className="mt-2 text-[10px] text-slate-500">{l(C.journey.location)}</p>
      <p className="flex items-center gap-1 text-xs font-bold text-gms-corp"><MapPin size={11} className="text-gms-gold" aria-hidden />{l(C.journey.currentLocation)}</p>
      <p className="mt-2 text-[10px] text-slate-500">{l(C.journey.lastUpdate)}</p>
      <p className="text-xs font-bold text-gms-corp">10:42 WIB</p>
    </div>
  );
  let scene: React.ReactNode;
  switch (step.id) {
    case "order":
      scene = (
        <div className="w-full max-w-sm rounded-xl border-4 border-gms-deep bg-white p-3 shadow-xl">
          <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 text-[11px] font-bold text-gms-corp"><Monitor size={12} aria-hidden /> GMS Dashboard</div>
          {[["Order", "w-3/4"], ["Pengirim / Sender", "w-1/2"], ["Penerima / Receiver", "w-2/3"], ["Armada / Fleet", "w-1/3"]].map(([k, w]) => (
            <div key={k} className="mt-2.5"><p className="text-[10px] text-slate-500">{k}</p><div className={`mt-1 h-2 rounded bg-gms-sky ${w}`} /></div>
          ))}
          <span className={`mt-3 inline-block ${chip}`}>{step.status}</span>
        </div>
      );
      break;
    case "pickup":
      scene = <div className="flex h-full w-full max-w-sm items-end gap-3"><div className="mb-1 flex h-14 w-14 shrink-0 flex-wrap content-end gap-1" aria-hidden>{[0,1,2,3].map((i)=><span key={i} className="h-6 w-6 rounded-sm bg-gms-gold" />)}</div><div className="h-32 flex-1"><TruckArt kind="cdd" /></div></div>;
      break;
    case "transit":
      scene = (
        <div className="w-full max-w-sm">
          <div className="h-24"><TruckArt kind="fuso" /></div>
          <svg viewBox="0 0 300 60" className="mt-2 w-full" aria-hidden>
            <path d="M20 40 Q150 -10 280 36" fill="none" stroke="#D4A72C" strokeWidth="3" strokeDasharray="8 6" style={{ animation: "dashMove 1.2s linear infinite" }} />
            <circle cx="20" cy="40" r="6" fill="#0B2553" /><circle cx="280" cy="36" r="6" fill="#D4A72C" />
          </svg>
          <div className="flex justify-between text-[11px] font-bold text-gms-corp"><span>Jakarta</span><span>Destination</span></div>
          <span className={`mt-3 inline-flex items-center gap-1.5 ${chip}`}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gms-deep" />{l(C.journey.liveTracking)}</span>
        </div>
      );
      break;
    case "update":
      scene = (
        <div className="flex items-center gap-5">
          {phone}
          <ul className="hidden space-y-2 text-xs font-bold text-gms-corp sm:block">
            {C.journey.photoUpdate.map((p, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow">{i === 0 ? <Camera size={14} className="text-gms-gold" aria-hidden /> : i === 1 ? <MapPin size={14} className="text-gms-gold" aria-hidden /> : <Check size={14} className="text-gms-gold" aria-hidden />}{l(p)}</li>
            ))}
          </ul>
        </div>
      );
      break;
    case "arrived":
      scene = <div className="flex h-full w-full max-w-sm flex-col items-center justify-end"><div className="h-28 w-full"><TruckArt kind="cdd" /></div><div className="mt-2 flex items-center gap-2 text-xs font-bold text-gms-corp"><MapPin size={14} className="text-gms-gold" aria-hidden />Destination</div></div>;
      break;
    default:
      scene = (
        <div className="w-full max-w-xs rounded-xl bg-white p-4 shadow-xl">
          <p className="text-xs font-extrabold text-gms-corp">{l(C.journey.pod)}</p>
          <ul className="mt-3 space-y-2">
            {C.journey.pods.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gms-ink"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-gms-gold text-gms-deep"><Check size={12} aria-hidden /></span>{l(p)}</li>
            ))}
          </ul>
        </div>
      );
  }
  return (
    <div role="img" aria-label={l(step.imageAlt)} className="relative flex h-full min-h-[240px] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-gms-sky to-white p-6">
      <div aria-hidden className="absolute -right-10 top-0 h-full w-24 skew-x-[-18deg] bg-gms-soft/70" />
      <div className="relative flex w-full justify-center">{scene}</div>
      <span className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{l(C.journey.sample)}</span>
    </div>
  );
}
