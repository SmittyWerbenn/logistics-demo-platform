import type { TruckArtKind } from "../../data/compro/fleetData";

/**
 * Vector truck illustrations in brand colours. Used as the fleet image slot
 * when `FleetItem.image` is empty; set a real photo path in fleetData to
 * replace it.
 */
const NAVY = "#0B2553";
const GOLD = "#D4A72C";
const BODY = "#FFFFFF";
const GLASS = "#BFD3EE";

function Wheel({ x }: { x: number }) {
  return (
    <g>
      <circle cx={x} cy={118} r={12} fill="#14213D" />
      <circle cx={x} cy={118} r={5} fill="#EAF0F8" />
    </g>
  );
}

export function TruckArt({ kind, dark = false }: { kind: TruckArtKind; dark?: boolean }) {
  const body = dark ? "#102F63" : BODY;
  const stroke = dark ? GOLD : NAVY;
  const cab = (x: number, w = 44) => (
    <g>
      <path d={`M${x} 110 V68 Q${x} 60 ${x + 8} 60 H${x + w - 14} L${x + w} 82 V110 Z`} fill={GOLD} />
      <path d={`M${x + w - 38} 66 H${x + w - 16} L${x + w - 5} 82 H${x + w - 38} Z`} fill={GLASS} />
    </g>
  );
  let content: React.ReactNode;
  switch (kind) {
    case "pickup":
      content = (
        <>
          <rect x={20} y={80} width={60} height={30} rx={3} fill={body} stroke={stroke} strokeWidth={2.5} />
          <path d="M84 110V78Q84 70 92 70H108L126 88V110Z" fill={GOLD} />
          <path d="M96 75H108L119 88H96Z" fill={GLASS} />
          <Wheel x={48} />
          <Wheel x={108} />
        </>
      );
      break;
    case "van":
      content = (
        <>
          <path d="M20 110V66Q20 58 28 58H98L128 84V110Z" fill={body} stroke={stroke} strokeWidth={2.5} />
          <path d="M102 64H108L122 84H102Z" fill={GLASS} />
          <rect x={20} y={92} width={108} height={5} fill={GOLD} />
          <Wheel x={48} />
          <Wheel x={106} />
        </>
      );
      break;
    case "cde":
      content = (
        <>
          <rect x={12} y={50} width={82} height={60} rx={3} fill={body} stroke={stroke} strokeWidth={2.5} />
          <rect x={12} y={96} width={82} height={5} fill={GOLD} />
          {cab(98)}
          <Wheel x={36} />
          <Wheel x={130} />
        </>
      );
      break;
    case "cdd": {
      const w = 100;
      content = (
        <>
          <rect x={12} y={50} width={w} height={60} rx={3} fill={body} stroke={stroke} strokeWidth={2.5} />
          <rect x={12} y={96} width={w} height={5} fill={GOLD} />
          {cab(12 + w + 4)}
          <Wheel x={36} />
          <Wheel x={60} />
          <Wheel x={12 + w + 36} />
        </>
      );
      break;
    }
    case "fuso":
      content = (
        <>
          <rect x={8} y={42} width={118} height={68} rx={3} fill={body} stroke={stroke} strokeWidth={2.5} />
          <rect x={8} y={96} width={118} height={5} fill={GOLD} />
          {cab(130, 48)}
          <Wheel x={32} />
          <Wheel x={56} />
          <Wheel x={152} />
        </>
      );
      break;
    case "tronton":
      content = (
        <>
          <path d="M8 110V46Q8 40 14 40H142L148 46V110Z" fill={body} stroke={stroke} strokeWidth={2.5} />
          <path d="M8 62H148" stroke={stroke} strokeWidth={2} />
          <rect x={8} y={96} width={140} height={5} fill={GOLD} />
          {cab(152, 44)}
          <Wheel x={30} />
          <Wheel x={56} />
          <Wheel x={82} />
          <Wheel x={172} />
        </>
      );
      break;
    case "reefer":
      content = (
        <>
          <rect x={8} y={40} width={140} height={70} rx={3} fill={body} stroke={stroke} strokeWidth={2.5} />
          <rect x={14} y={46} width={22} height={18} rx={2} fill={GLASS} />
          <text x={92} y={84} textAnchor="middle" fontSize={20} fontWeight={800} fill={dark ? GOLD : NAVY} fontFamily="Inter, sans-serif">
            REEFER
          </text>
          <rect x={8} y={98} width={140} height={4} fill={GOLD} />
          {cab(152, 44)}
          <Wheel x={30} />
          <Wheel x={56} />
          <Wheel x={82} />
          <Wheel x={172} />
        </>
      );
      break;
    case "trailer":
      content = (
        <>
          <rect x={10} y={92} width={150} height={8} fill={stroke} />
          <rect x={22} y={52} width={124} height={40} rx={2} fill={GOLD} stroke={stroke} strokeWidth={2.5} />
          <path d="M42 52V92M62 52V92M82 52V92M102 52V92M122 52V92" stroke={stroke} strokeWidth={1.5} opacity={0.5} />
          {cab(164, 40)}
          <Wheel x={32} />
          <Wheel x={56} />
          <Wheel x={80} />
          <Wheel x={184} />
        </>
      );
      break;
    case "lowbed":
      content = (
        <>
          <path d="M8 104H150L162 92H196V104H8Z" fill={stroke} />
          <rect x={30} y={60} width={90} height={42} rx={3} fill={GOLD} stroke={dark ? "#fff" : NAVY} strokeWidth={2.5} />
          <path d="M44 60V102M75 60V102M106 60V102" stroke={NAVY} strokeWidth={1.5} opacity={0.4} />
          {cab(160, 40)}
          <Wheel x={22} />
          <Wheel x={46} />
          <Wheel x={70} />
          <Wheel x={94} />
          <Wheel x={180} />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 210 136" className="h-full w-full" role="img" aria-hidden="true">
      <ellipse cx={105} cy={130} rx={90} ry={4} fill={dark ? "#000" : NAVY} opacity={0.12} />
      {content}
    </svg>
  );
}
