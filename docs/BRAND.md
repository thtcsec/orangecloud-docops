# Brand assets

## Source files (repo root)

| File | Use |
|------|-----|
| `logo.png` | Light-background lockup (design export) |
| `logo-dark.png` | Dark-background lockup (design export) |

## Served assets (`public/brand/`)

| File | Use |
|------|-----|
| `logo.png` / `logo-dark.png` | App headers — pixel-accurate to the design |
| `logo-light.svg` / `logo-dark.svg` / `logo-mark.svg` | Clean handcrafted vectors for sharp scaling |
| `../favicon.svg` | Browser tab icon (mark only) |

## PNG → SVG online convert — do not use

The files `ChatGPT-Image-*.svg` are **bitmap traces** (Potrace-style):

- Colors were flattened to black (`fill="#000000"`)
- Thousands of jagged path segments instead of clean geometry
- Tiny “CONTRACT / PO / INVOICE” labels become muddy blobs when scaled down
- One file even traced the dark background as a solid black rectangle

**True SVG is better for scaling** — but only when it is real vector geometry (or SVG `<text>`), not an auto-trace of a PNG.

Recommendation:

1. Keep the PNG exports as the design source of truth for the full lockup.
2. Use the handcrafted SVGs in `public/brand/` for favicon / scalable mark.
3. For a production-perfect SVG lockup later, redraw in Figma/Illustrator (or export SVG from the design tool), do not rely on online PNG→SVG converters.
