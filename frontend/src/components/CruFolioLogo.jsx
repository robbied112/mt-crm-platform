/**
 * CruFolio logomark — CF monogram inside vine leaf shape.
 * Matches DESIGN.md brand spec.
 */
export default function CruFolioLogo({ size = 40, variant = "dark", className, style }) {
  const fill = variant === "light" ? "#6B1E1E" : "#6B1E1E";
  const textFill = variant === "light" ? "#FDF8F0" : "#FDF8F0";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="CruFolio logo"
    >
      {/* Vine leaf shape */}
      <path
        d="M32 4C18 4 6 14 6 30c0 14 10 26 24 28a4 4 0 003-1l3-4c1-2 3-3 5-3h2c10-3 17-12 17-22C60 14 48 4 32 4z"
        fill={fill}
      />
      {/* Leaf vein */}
      <path
        d="M32 14v32M22 22l10 10M42 22L32 32"
        stroke={textFill}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.2"
      />
      {/* CF monogram */}
      <text
        x="32"
        y="40"
        textAnchor="middle"
        fontFamily="'Libre Baskerville', Georgia, serif"
        fontSize="22"
        fontWeight="700"
        fill={textFill}
      >
        CF
      </text>
    </svg>
  );
}
