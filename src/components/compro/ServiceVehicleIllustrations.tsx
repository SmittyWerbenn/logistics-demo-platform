import { type SVGProps } from "react";

/** Modern corporate logistics vehicle illustrations for services. */

export function BoxTruckIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Background gradient */}
      <defs>
        <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#EAF0F8" />
          <stop offset="100%" stopColor="#F4F7FC" />
        </linearGradient>
        <linearGradient id="truckGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0B2553" />
          <stop offset="100%" stopColor="#071B41" />
        </linearGradient>
      </defs>
      <rect width="400" height="280" fill="url(#skyGrad)" />

      {/* Road */}
      <rect x="0" y="220" width="400" height="60" fill="#E5E7EB" />
      <line x1="0" y1="240" x2="400" y2="240" stroke="#D4A72C" strokeWidth="3" strokeDasharray="20,15" opacity="0.6" />

      {/* Package/cargo on top - animated */}
      <g className="animate-pulse" style={{ animationDuration: "3s" }}>
        <rect x="140" y="110" width="35" height="35" fill="#E5B83B" rx="2" />
        <rect x="185" y="115" width="40" height="30" fill="#D4A72C" rx="2" />
        <rect x="130" y="155" width="38" height="28" fill="#E5B83B" rx="2" />
      </g>

      {/* Truck body */}
      <g>
        {/* Main cargo box */}
        <rect x="100" y="140" width="150" height="70" fill="url(#truckGrad)" rx="8" />
        <rect x="105" y="145" width="140" height="30" fill="#0B2553" opacity="0.8" />

        {/* Cabin */}
        <rect x="60" y="155" width="45" height="55" fill="#0B2553" rx="4" />

        {/* Windshield */}
        <rect x="63" y="158" width="38" height="20" fill="#87CEEB" opacity="0.7" rx="2" />

        {/* Front bumper */}
        <rect x="55" y="205" width="55" height="10" fill="#14213D" />

        {/* Side stripe (gold accent) */}
        <rect x="100" y="180" width="150" height="3" fill="#D4A72C" />
      </g>

      {/* Wheels with subtle rotation */}
      <g className="animate-[spin_2s_linear_infinite]" style={{ transformOrigin: "135px 220px" }}>
        <circle cx="135" cy="220" r="15" fill="#14213D" />
        <circle cx="135" cy="220" r="10" fill="#1a2f4d" />
        <circle cx="135" cy="220" r="6" fill="#D4A72C" opacity="0.6" />
      </g>

      <g className="animate-[spin_2s_linear_infinite]" style={{ transformOrigin: "235px 220px" }}>
        <circle cx="235" cy="220" r="15" fill="#14213D" />
        <circle cx="235" cy="220" r="10" fill="#1a2f4d" />
        <circle cx="235" cy="220" r="6" fill="#D4A72C" opacity="0.6" />
      </g>

      {/* Small accent shapes */}
      <rect x="110" y="165" width="25" height="8" fill="#D4A72C" opacity="0.4" rx="2" />
    </svg>
  );
}

export function FullTruckIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="skyGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#EAF0F8" />
          <stop offset="100%" stopColor="#F4F7FC" />
        </linearGradient>
        <linearGradient id="truckGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0B2553" />
          <stop offset="100%" stopColor="#071B41" />
        </linearGradient>
      </defs>
      <rect width="400" height="280" fill="url(#skyGrad2)" />

      {/* Road */}
      <rect x="0" y="220" width="400" height="60" fill="#E5E7EB" />
      <line x1="0" y1="240" x2="400" y2="240" stroke="#D4A72C" strokeWidth="3" strokeDasharray="20,15" opacity="0.6" />

      {/* Large cargo truck */}
      <g>
        {/* Extended cargo box */}
        <rect x="90" y="130" width="200" height="85" fill="url(#truckGrad2)" rx="10" />

        {/* Top edge highlight */}
        <rect x="90" y="130" width="200" height="4" fill="#D4A72C" opacity="0.8" />

        {/* Cabin */}
        <rect x="50" y="150" width="50" height="65" fill="#0B2553" rx="4" />
        <rect x="52" y="152" width="46" height="22" fill="#87CEEB" opacity="0.7" rx="2" />

        {/* Front bumper */}
        <rect x="45" y="210" width="65" height="12" fill="#14213D" />

        {/* Side accent stripes */}
        <rect x="90" y="175" width="200" height="2" fill="#D4A72C" />
        <rect x="90" y="190" width="200" height="2" fill="#D4A72C" opacity="0.5" />
      </g>

      {/* Wheels (3 axles for heavy truck) */}
      <g className="animate-[spin_2s_linear_infinite]" style={{ transformOrigin: "130px 220px" }}>
        <circle cx="130" cy="220" r="16" fill="#14213D" />
        <circle cx="130" cy="220" r="11" fill="#1a2f4d" />
        <circle cx="130" cy="220" r="6" fill="#D4A72C" opacity="0.6" />
      </g>

      <g className="animate-[spin_2s_linear_infinite]" style={{ transformOrigin: "200px 220px" }}>
        <circle cx="200" cy="220" r="16" fill="#14213D" />
        <circle cx="200" cy="220" r="11" fill="#1a2f4d" />
        <circle cx="200" cy="220" r="6" fill="#D4A72C" opacity="0.6" />
      </g>

      <g className="animate-[spin_2s_linear_infinite]" style={{ transformOrigin: "270px 220px" }}>
        <circle cx="270" cy="220" r="16" fill="#14213D" />
        <circle cx="270" cy="220" r="11" fill="#1a2f4d" />
        <circle cx="270" cy="220" r="6" fill="#D4A72C" opacity="0.6" />
      </g>

      {/* Load indicator bars */}
      <g className="animate-pulse" style={{ animationDuration: "2.5s" }}>
        <rect x="105" y="145" width="15" height="65" fill="#E5B83B" opacity="0.7" />
        <rect x="130" y="140" width="15" height="70" fill="#D4A72C" opacity="0.7" />
        <rect x="155" y="148" width="15" height="62" fill="#E5B83B" opacity="0.7" />
        <rect x="180" y="143" width="15" height="67" fill="#D4A72C" opacity="0.7" />
        <rect x="205" y="150" width="15" height="60" fill="#E5B83B" opacity="0.7" />
      </g>
    </svg>
  );
}

export function ContainerTruckIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="skyGrad3" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#EAF0F8" />
          <stop offset="100%" stopColor="#F4F7FC" />
        </linearGradient>
      </defs>
      <rect width="400" height="280" fill="url(#skyGrad3)" />

      {/* Road */}
      <rect x="0" y="220" width="400" height="60" fill="#E5E7EB" />
      <line x1="0" y1="240" x2="400" y2="240" stroke="#D4A72C" strokeWidth="3" strokeDasharray="20,15" opacity="0.6" />

      {/* Shipping container */}
      <g>
        {/* Container body */}
        <rect x="100" y="115" width="180" height="100" fill="#14213D" stroke="#D4A72C" strokeWidth="2" />

        {/* Container doors */}
        <line x1="190" y1="115" x2="190" y2="215" stroke="#D4A72C" strokeWidth="2" opacity="0.6" />

        {/* Door handles */}
        <circle cx="155" cy="165" r="3" fill="#D4A72C" opacity="0.7" />
        <circle cx="225" cy="165" r="3" fill="#D4A72C" opacity="0.7" />

        {/* Container corner brackets */}
        <rect x="100" y="115" width="6" height="6" fill="#D4A72C" opacity="0.8" />
        <rect x="274" y="115" width="6" height="6" fill="#D4A72C" opacity="0.8" />
        <rect x="100" y="209" width="6" height="6" fill="#D4A72C" opacity="0.8" />
        <rect x="274" y="209" width="6" height="6" fill="#D4A72C" opacity="0.8" />
      </g>

      {/* Truck cabin & chassis */}
      <g>
        <rect x="55" y="155" width="48" height="60" fill="#0B2553" rx="3" />
        <rect x="57" y="158" width="44" height="18" fill="#87CEEB" opacity="0.7" rx="2" />
        <rect x="50" y="210" width="60" height="11" fill="#14213D" />
      </g>

      {/* Wheels */}
      <g className="animate-[spin_2s_linear_infinite]" style={{ transformOrigin: "125px 220px" }}>
        <circle cx="125" cy="220" r="16" fill="#14213D" />
        <circle cx="125" cy="220" r="11" fill="#1a2f4d" />
        <circle cx="125" cy="220" r="6" fill="#D4A72C" opacity="0.6" />
      </g>

      <g className="animate-[spin_2s_linear_infinite]" style={{ transformOrigin: "255px 220px" }}>
        <circle cx="255" cy="220" r="16" fill="#14213D" />
        <circle cx="255" cy="220" r="11" fill="#1a2f4d" />
        <circle cx="255" cy="220" r="6" fill="#D4A72C" opacity="0.6" />
      </g>

      {/* Cargo indicator lines (animated) */}
      <g className="animate-pulse" style={{ animationDuration: "3s" }}>
        <line x1="115" y1="135" x2="115" y2="195" stroke="#E5B83B" strokeWidth="3" opacity="0.6" />
        <line x1="155" y1="130" x2="155" y2="200" stroke="#D4A72C" strokeWidth="3" opacity="0.6" />
        <line x1="195" y1="132" x2="195" y2="198" stroke="#E5B83B" strokeWidth="3" opacity="0.6" />
        <line x1="235" y1="135" x2="235" y2="195" stroke="#D4A72C" strokeWidth="3" opacity="0.6" />
        <line x1="265" y1="138" x2="265" y2="192" stroke="#E5B83B" strokeWidth="3" opacity="0.6" />
      </g>
    </svg>
  );
}

export function CargoAirplaneIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="skyGrad4" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#EAF0F8" />
          <stop offset="100%" stopColor="#F4F7FC" />
        </linearGradient>
      </defs>
      <rect width="400" height="280" fill="url(#skyGrad4)" />

      {/* Clouds (floating animation) */}
      <g className="animate-[float_6s_ease-in-out_infinite]" style={{ animationDelay: "0s" }}>
        <ellipse cx="80" cy="60" rx="35" ry="25" fill="#FFFFFF" opacity="0.7" />
        <ellipse cx="110" cy="70" rx="40" ry="20" fill="#FFFFFF" opacity="0.6" />
      </g>

      <g className="animate-[float_7s_ease-in-out_infinite]" style={{ animationDelay: "1s" }}>
        <ellipse cx="300" cy="50" rx="38" ry="22" fill="#FFFFFF" opacity="0.7" />
        <ellipse cx="330" cy="62" rx="35" ry="18" fill="#FFFFFF" opacity="0.6" />
      </g>

      {/* Aircraft body */}
      <g className="animate-[float_4s_ease-in-out_infinite]">
        {/* Fuselage */}
        <ellipse cx="200" cy="140" rx="90" ry="30" fill="#0B2553" />

        {/* Cargo door area highlight */}
        <rect x="130" y="125" width="70" height="30" fill="#14213D" opacity="0.7" rx="2" />

        {/* Door line */}
        <line x1="165" y1="125" x2="165" y2="155" stroke="#D4A72C" strokeWidth="2" opacity="0.8" />

        {/* Windows */}
        <circle cx="150" cy="135" r="4" fill="#87CEEB" opacity="0.7" />
        <circle cx="175" cy="135" r="4" fill="#87CEEB" opacity="0.7" />
      </g>

      {/* Wings */}
      <g>
        <ellipse cx="200" cy="140" rx="140" ry="15" fill="#0B2553" opacity="0.9" />

        {/* Wing accent */}
        <rect x="80" y="138" width="240" height="2" fill="#D4A72C" opacity="0.6" />
      </g>

      {/* Tail */}
      <g>
        <polygon points="285,140 310,130 310,150" fill="#0B2553" />
        <polygon points="290,140 300,135 300,145" fill="#D4A72C" opacity="0.7" />
      </g>

      {/* Landing gear */}
      <g>
        <line x1="170" y1="170" x2="170" y2="200" stroke="#14213D" strokeWidth="3" />
        <line x1="230" y1="170" x2="230" y2="200" stroke="#14213D" strokeWidth="3" />
        <circle cx="170" cy="203" r="6" fill="#14213D" />
        <circle cx="230" cy="203" r="6" fill="#14213D" />
      </g>

      {/* Cargo boxes (animated) */}
      <g className="animate-pulse" style={{ animationDuration: "2s" }}>
        <rect x="140" y="155" width="20" height="15" fill="#E5B83B" opacity="0.8" />
        <rect x="170" y="158" width="18" height="12" fill="#D4A72C" opacity="0.8" />
        <rect x="200" y="156" width="20" height="14" fill="#E5B83B" opacity="0.8" />
        <rect x="230" y="159" width="18" height="11" fill="#D4A72C" opacity="0.8" />
      </g>

      {/* Motion lines */}
      <g opacity="0.4" className="animate-pulse">
        <line x1="50" y1="140" x2="80" y2="140" stroke="#D4A72C" strokeWidth="2" />
        <line x1="45" y1="150" x2="75" y2="150" stroke="#D4A72C" strokeWidth="2" opacity="0.7" />
        <line x1="50" y1="160" x2="80" y2="160" stroke="#D4A72C" strokeWidth="2" opacity="0.5" />
      </g>
    </svg>
  );
}

export function LowbedHeavyHaulIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 280" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="skyGrad5" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#EAF0F8" />
          <stop offset="100%" stopColor="#F4F7FC" />
        </linearGradient>
      </defs>
      <rect width="400" height="280" fill="url(#skyGrad5)" />

      {/* Road */}
      <rect x="0" y="220" width="400" height="60" fill="#E5E7EB" />
      <line x1="0" y1="240" x2="400" y2="240" stroke="#D4A72C" strokeWidth="3" strokeDasharray="20,15" opacity="0.6" />

      {/* Lowbed trailer (very low, close to ground) */}
      <g>
        {/* Trailer deck */}
        <rect x="95" y="185" width="210" height="25" fill="#14213D" rx="2" />

        {/* Deck edge highlight */}
        <rect x="95" y="185" width="210" height="3" fill="#D4A72C" opacity="0.8" />

        {/* Ramps/supports */}
        <rect x="100" y="205" width="4" height="15" fill="#14213D" />
        <rect x="300" y="205" width="4" height="15" fill="#14213D" />
      </g>

      {/* Heavy cargo (construction equipment) */}
      <g className="animate-pulse" style={{ animationDuration: "3.5s" }}>
        {/* Large equipment block */}
        <rect x="145" y="130" width="110" height="55" fill="#0B2553" stroke="#D4A72C" strokeWidth="2" />

        {/* Equipment window/detail */}
        <circle cx="190" cy="155" r="8" fill="#87CEEB" opacity="0.6" />
        <circle cx="210" cy="155" r="8" fill="#87CEEB" opacity="0.6" />

        {/* Equipment color accent */}
        <rect x="145" y="140" width="110" height="4" fill="#D4A72C" opacity="0.7" />
      </g>

      {/* Tractor unit cabin */}
      <g>
        <rect x="50" y="150" width="50" height="65" fill="#0B2553" rx="4" />
        <rect x="52" y="152" width="46" height="22" fill="#87CEEB" opacity="0.7" rx="2" />
      </g>

      {/* Front bumper */}
      <rect x="45" y="210" width="65" height="12" fill="#14213D" />

      {/* Heavy duty wheels (6 wheels - dual rear axle) */}
      <g className="animate-[spin_1.8s_linear_infinite]" style={{ transformOrigin: "120px 220px" }}>
        <circle cx="120" cy="220" r="17" fill="#14213D" />
        <circle cx="120" cy="220" r="12" fill="#1a2f4d" />
        <circle cx="120" cy="220" r="7" fill="#D4A72C" opacity="0.6" />
      </g>

      {/* Dual rear wheels - left */}
      <g className="animate-[spin_1.8s_linear_infinite]" style={{ transformOrigin: "260px 215px" }}>
        <circle cx="260" cy="215" r="17" fill="#14213D" />
        <circle cx="260" cy="215" r="12" fill="#1a2f4d" />
        <circle cx="260" cy="215" r="7" fill="#D4A72C" opacity="0.6" />
      </g>

      <g className="animate-[spin_1.8s_linear_infinite]" style={{ transformOrigin: "260px 235px" }}>
        <circle cx="260" cy="235" r="17" fill="#14213D" />
        <circle cx="260" cy="235" r="12" fill="#1a2f4d" />
        <circle cx="260" cy="235" r="7" fill="#D4A72C" opacity="0.6" />
      </g>

      {/* Additional rear axle wheels */}
      <g className="animate-[spin_1.8s_linear_infinite]" style={{ transformOrigin: "295px 215px" }}>
        <circle cx="295" cy="215" r="17" fill="#14213D" />
        <circle cx="295" cy="215" r="12" fill="#1a2f4d" />
        <circle cx="295" cy="215" r="7" fill="#D4A72C" opacity="0.6" />
      </g>

      <g className="animate-[spin_1.8s_linear_infinite]" style={{ transformOrigin: "295px 235px" }}>
        <circle cx="295" cy="235" r="17" fill="#14213D" />
        <circle cx="295" cy="235" r="12" fill="#1a2f4d" />
        <circle cx="295" cy="235" r="7" fill="#D4A72C" opacity="0.6" />
      </g>

      {/* Power lines accent */}
      <line x1="100" y1="175" x2="300" y2="175" stroke="#D4A72C" strokeWidth="1" opacity="0.4" strokeDasharray="5,5" />
    </svg>
  );
}

// Utility for float animation keyframes
export const floatStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-15px); }
  }
`;
