// Neutral QC brand mark — a hexagon (industrial) with an inspection check inside.
export function BrandMark({ size = 26, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.5 20 7v10l-8 4.5L4 17V7z" />
      <polyline points="8.4 12 11 14.6 15.6 9.4" />
    </svg>
  )
}

// Full lockup: mark + wordmark
export default function BrandLogo({ size = 26, color = 'currentColor' }) {
  return (
    <span className="brand-lockup">
      <span className="brand-mark"><BrandMark size={size} color={color} /></span>
      <span className="brand-word">Quality Control</span>
    </span>
  )
}
