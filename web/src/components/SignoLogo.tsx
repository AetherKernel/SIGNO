// Logo: proposal 02 "Hoja Cartografica", generated with Gemini (Google) and chosen by the team (Kiara, approved by
// José), 2026-11-15. Exported to inline SVG with Claude (Anthropic) via Claude Code; the pixel grid and the colours are
// unchanged. Colours per part live in index.css (.signo-logo), with a dark set for prefers-color-scheme: dark.
//
// Horizontal logo: the 16x16 leaf (forest greens, the Amazon river and its tributaries) and "SIGNO" in a pixel serif.
// Drawn at 2x its 61x16 grid (122x32 px) so every pixel stays sharp.

const PARTS: Record<'D' | 'M' | 'L' | 'B' | 'R' | 'T' | 'X', string> = {
  D: 'M5 3h1v1h-1zM6 3h1v1h-1zM4 4h1v1h-1zM5 4h1v1h-1zM3 5h1v1h-1zM4 5h1v1h-1zM2 6h1v1h-1zM3 6h1v1h-1zM1 7h1v1h-1zM2 7h1v1h-1zM15 7h1v1h-1zM0 8h1v1h-1zM1 8h1v1h-1zM15 8h1v1h-1zM0 9h1v1h-1zM1 9h1v1h-1zM14 9h1v1h-1zM15 9h1v1h-1zM0 10h1v1h-1zM1 10h1v1h-1zM13 10h1v1h-1zM14 10h1v1h-1zM15 10h1v1h-1zM1 11h1v1h-1zM2 11h1v1h-1zM12 11h1v1h-1zM13 11h1v1h-1zM14 11h1v1h-1zM2 12h1v1h-1zM3 12h1v1h-1zM11 12h1v1h-1zM12 12h1v1h-1zM13 12h1v1h-1zM9 13h1v1h-1zM10 13h1v1h-1zM11 13h1v1h-1zM12 13h1v1h-1zM4 14h1v1h-1zM5 14h1v1h-1zM6 14h1v1h-1zM7 14h1v1h-1zM8 14h1v1h-1zM9 14h1v1h-1zM10 14h1v1h-1zM11 14h1v1h-1z',
  M: 'M13 2h1v1h-1zM14 2h1v1h-1zM11 3h1v1h-1zM12 3h1v1h-1zM13 3h1v1h-1zM14 3h1v1h-1zM9 4h1v1h-1zM10 4h1v1h-1zM11 4h1v1h-1zM12 4h1v1h-1zM14 4h1v1h-1zM15 4h1v1h-1zM7 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM10 5h1v1h-1zM13 5h1v1h-1zM14 5h1v1h-1zM15 5h1v1h-1zM6 6h1v1h-1zM7 6h1v1h-1zM12 6h1v1h-1zM13 6h1v1h-1zM14 6h1v1h-1zM15 6h1v1h-1zM5 7h1v1h-1zM6 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1zM11 7h1v1h-1zM12 7h1v1h-1zM13 7h1v1h-1zM14 7h1v1h-1zM4 8h1v1h-1zM5 8h1v1h-1zM6 8h1v1h-1zM7 8h1v1h-1zM12 8h1v1h-1zM13 8h1v1h-1zM14 8h1v1h-1zM4 9h1v1h-1zM5 9h1v1h-1zM6 9h1v1h-1zM9 9h1v1h-1zM10 9h1v1h-1zM11 9h1v1h-1zM12 9h1v1h-1zM13 9h1v1h-1zM4 10h1v1h-1zM5 10h1v1h-1zM8 10h1v1h-1zM9 10h1v1h-1zM10 10h1v1h-1zM11 10h1v1h-1zM12 10h1v1h-1zM3 11h1v1h-1zM4 11h1v1h-1zM7 11h1v1h-1zM8 11h1v1h-1zM9 11h1v1h-1zM10 11h1v1h-1zM11 11h1v1h-1zM6 12h1v1h-1zM7 12h1v1h-1zM8 12h1v1h-1zM9 12h1v1h-1zM10 12h1v1h-1zM5 13h1v1h-1zM6 13h1v1h-1zM7 13h1v1h-1zM8 13h1v1h-1z',
  L: 'M11 1h1v1h-1zM12 1h1v1h-1zM13 1h1v1h-1zM14 1h1v1h-1zM9 2h1v1h-1zM10 2h1v1h-1zM11 2h1v1h-1zM12 2h1v1h-1zM7 3h1v1h-1zM8 3h1v1h-1zM9 3h1v1h-1zM10 3h1v1h-1zM6 4h1v1h-1zM7 4h1v1h-1zM8 4h1v1h-1zM5 5h1v1h-1zM6 5h1v1h-1zM4 6h1v1h-1zM5 6h1v1h-1zM3 7h1v1h-1zM4 7h1v1h-1zM2 8h1v1h-1zM3 8h1v1h-1zM2 9h1v1h-1zM3 9h1v1h-1zM2 10h1v1h-1zM3 10h1v1h-1z',
  B: 'M11 0h1v1h-1zM12 0h1v1h-1zM13 0h1v1h-1zM14 0h1v1h-1zM15 0h1v1h-1zM9 1h1v1h-1zM10 1h1v1h-1zM15 1h1v1h-1zM7 2h1v1h-1zM8 2h1v1h-1zM15 2h1v1h-1zM15 3h1v1h-1z',
  R: 'M13 4h1v1h-1zM11 5h1v1h-1zM12 5h1v1h-1zM10 6h1v1h-1zM11 6h1v1h-1zM9 7h1v1h-1zM10 7h1v1h-1zM8 8h1v1h-1zM9 8h1v1h-1zM7 9h1v1h-1zM8 9h1v1h-1zM6 10h1v1h-1zM7 10h1v1h-1zM5 11h1v1h-1zM6 11h1v1h-1zM4 12h1v1h-1zM5 12h1v1h-1zM1 13h1v1h-1zM2 13h1v1h-1zM3 13h1v1h-1zM4 13h1v1h-1zM0 14h1v1h-1zM1 14h1v1h-1zM0 15h1v1h-1z',
  T: 'M8 6h1v1h-1zM9 6h1v1h-1zM10 8h1v1h-1zM11 8h1v1h-1z',
  X: 'M20 4h1v1h-1zM21 4h1v1h-1zM22 4h1v1h-1zM23 4h1v1h-1zM24 4h1v1h-1zM25 4h1v1h-1zM19 5h1v1h-1zM20 5h1v1h-1zM21 5h1v1h-1zM22 5h1v1h-1zM23 5h1v1h-1zM24 5h1v1h-1zM25 5h1v1h-1zM26 5h1v1h-1zM19 6h1v1h-1zM20 6h1v1h-1zM25 6h1v1h-1zM26 6h1v1h-1zM20 7h1v1h-1zM21 7h1v1h-1zM22 7h1v1h-1zM23 7h1v1h-1zM24 7h1v1h-1zM21 8h1v1h-1zM22 8h1v1h-1zM23 8h1v1h-1zM24 8h1v1h-1zM25 8h1v1h-1zM19 9h1v1h-1zM20 9h1v1h-1zM25 9h1v1h-1zM26 9h1v1h-1zM19 10h1v1h-1zM20 10h1v1h-1zM21 10h1v1h-1zM22 10h1v1h-1zM23 10h1v1h-1zM24 10h1v1h-1zM25 10h1v1h-1zM26 10h1v1h-1zM20 11h1v1h-1zM21 11h1v1h-1zM22 11h1v1h-1zM23 11h1v1h-1zM24 11h1v1h-1zM25 11h1v1h-1zM28 4h1v1h-1zM29 4h1v1h-1zM30 4h1v1h-1zM31 4h1v1h-1zM32 4h1v1h-1zM33 4h1v1h-1zM28 5h1v1h-1zM29 5h1v1h-1zM30 5h1v1h-1zM31 5h1v1h-1zM32 5h1v1h-1zM33 5h1v1h-1zM30 6h1v1h-1zM31 6h1v1h-1zM30 7h1v1h-1zM31 7h1v1h-1zM30 8h1v1h-1zM31 8h1v1h-1zM30 9h1v1h-1zM31 9h1v1h-1zM28 10h1v1h-1zM29 10h1v1h-1zM30 10h1v1h-1zM31 10h1v1h-1zM32 10h1v1h-1zM33 10h1v1h-1zM28 11h1v1h-1zM29 11h1v1h-1zM30 11h1v1h-1zM31 11h1v1h-1zM32 11h1v1h-1zM33 11h1v1h-1zM36 4h1v1h-1zM37 4h1v1h-1zM38 4h1v1h-1zM39 4h1v1h-1zM40 4h1v1h-1zM41 4h1v1h-1zM35 5h1v1h-1zM36 5h1v1h-1zM37 5h1v1h-1zM38 5h1v1h-1zM39 5h1v1h-1zM40 5h1v1h-1zM41 5h1v1h-1zM42 5h1v1h-1zM35 6h1v1h-1zM36 6h1v1h-1zM41 6h1v1h-1zM42 6h1v1h-1zM35 7h1v1h-1zM36 7h1v1h-1zM35 8h1v1h-1zM36 8h1v1h-1zM39 8h1v1h-1zM40 8h1v1h-1zM41 8h1v1h-1zM42 8h1v1h-1zM35 9h1v1h-1zM36 9h1v1h-1zM41 9h1v1h-1zM42 9h1v1h-1zM35 10h1v1h-1zM36 10h1v1h-1zM37 10h1v1h-1zM38 10h1v1h-1zM39 10h1v1h-1zM40 10h1v1h-1zM41 10h1v1h-1zM42 10h1v1h-1zM36 11h1v1h-1zM37 11h1v1h-1zM38 11h1v1h-1zM39 11h1v1h-1zM40 11h1v1h-1zM41 11h1v1h-1zM44 4h1v1h-1zM45 4h1v1h-1zM46 4h1v1h-1zM49 4h1v1h-1zM50 4h1v1h-1zM51 4h1v1h-1zM45 5h1v1h-1zM46 5h1v1h-1zM47 5h1v1h-1zM50 5h1v1h-1zM51 5h1v1h-1zM45 6h1v1h-1zM46 6h1v1h-1zM47 6h1v1h-1zM48 6h1v1h-1zM50 6h1v1h-1zM51 6h1v1h-1zM45 7h1v1h-1zM46 7h1v1h-1zM48 7h1v1h-1zM49 7h1v1h-1zM50 7h1v1h-1zM51 7h1v1h-1zM45 8h1v1h-1zM46 8h1v1h-1zM49 8h1v1h-1zM50 8h1v1h-1zM51 8h1v1h-1zM45 9h1v1h-1zM46 9h1v1h-1zM50 9h1v1h-1zM51 9h1v1h-1zM45 10h1v1h-1zM46 10h1v1h-1zM50 10h1v1h-1zM51 10h1v1h-1zM44 11h1v1h-1zM45 11h1v1h-1zM46 11h1v1h-1zM47 11h1v1h-1zM50 11h1v1h-1zM51 11h1v1h-1zM54 4h1v1h-1zM55 4h1v1h-1zM56 4h1v1h-1zM57 4h1v1h-1zM58 4h1v1h-1zM59 4h1v1h-1zM53 5h1v1h-1zM54 5h1v1h-1zM55 5h1v1h-1zM56 5h1v1h-1zM57 5h1v1h-1zM58 5h1v1h-1zM59 5h1v1h-1zM60 5h1v1h-1zM53 6h1v1h-1zM54 6h1v1h-1zM59 6h1v1h-1zM60 6h1v1h-1zM53 7h1v1h-1zM54 7h1v1h-1zM59 7h1v1h-1zM60 7h1v1h-1zM53 8h1v1h-1zM54 8h1v1h-1zM59 8h1v1h-1zM60 8h1v1h-1zM53 9h1v1h-1zM54 9h1v1h-1zM59 9h1v1h-1zM60 9h1v1h-1zM53 10h1v1h-1zM54 10h1v1h-1zM55 10h1v1h-1zM56 10h1v1h-1zM57 10h1v1h-1zM58 10h1v1h-1zM59 10h1v1h-1zM60 10h1v1h-1zM54 11h1v1h-1zM55 11h1v1h-1zM56 11h1v1h-1zM57 11h1v1h-1zM58 11h1v1h-1zM59 11h1v1h-1z',
}

export function SignoLogo() {
  return (
    <svg
      className="signo-logo"
      viewBox="0 0 61 16"
      width={122}
      height={32}
      shapeRendering="crispEdges"
      role="img"
      aria-label="SIGNO"
    >
      {(Object.keys(PARTS) as (keyof typeof PARTS)[]).map((part) => (
        <path key={part} className={`k-${part}`} d={PARTS[part]} />
      ))}
    </svg>
  )
}
