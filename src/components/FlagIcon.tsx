/** Small inline SVG flags for the language switcher - kept as real vector
 * graphics (not emoji) so rendering is crisp and consistent across
 * platforms/browsers. */

export function FlagID({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden>
      <rect width="24" height="16" rx="2" fill="#fff" />
      <path d="M0 2a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v6H0z" fill="#CE1126" />
      <rect width="24" height="16" rx="2" fill="none" stroke="#00000014" />
    </svg>
  );
}

export function FlagEN({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" className={className} aria-hidden>
      <clipPath id="flagEnClip">
        <rect width="24" height="16" rx="2" />
      </clipPath>
      <g clipPath="url(#flagEnClip)">
        <rect width="24" height="16" fill="#00247D" />
        <path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="3.2" />
        <path d="M0 0 24 16M24 0 0 16" stroke="#CF142B" strokeWidth="1.3" />
        <path d="M12 0V16M0 8H24" stroke="#fff" strokeWidth="5.4" />
        <path d="M12 0V16M0 8H24" stroke="#CF142B" strokeWidth="2.2" />
      </g>
      <rect width="24" height="16" rx="2" fill="none" stroke="#00000014" />
    </svg>
  );
}
