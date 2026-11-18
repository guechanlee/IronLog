// The IronLog mark: an open progress ring around an I-beam, the same glyph as resources/icon.svg.
// Drawn in currentColor so it follows the accent wherever it is placed.
export default function Logo({ size = 54, ...rest }) {
  return <svg viewBox="84 84 344 344" width={size} height={size} fill="currentColor" aria-hidden="true" {...rest}>
    <circle cx="256" cy="256" r="152" fill="none" stroke="currentColor" strokeWidth="40" strokeLinecap="round"
      strokeDasharray="875 80" transform="rotate(-62 256 256)" />
    <rect x="238" y="156" width="36" height="200" />
    <rect x="204" y="156" width="104" height="32" />
    <rect x="204" y="324" width="104" height="32" />
  </svg>
}
