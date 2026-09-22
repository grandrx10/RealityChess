# Third-party artwork

Both piece sets come from Wikimedia Commons and are used under
**CC BY-SA 3.0**. That licence requires attribution and that derivative
versions of the artwork be shared under the same terms. The recolouring and
rasterising done by `scripts/generate-piece-art.mjs` counts as a derivative of
the artwork, so if you publish this project, keep this file with it.

The licence applies to the artwork. It does not extend to the rest of the
source in this repository.

## Chess pieces

"Cburnett" chess piece set — the artwork used by Wikipedia and lichess.

- Author: Colin M.L. Burnett (User:Cburnett)
- Source: https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces
- Licence: CC BY-SA 3.0, GFDL, and BSD (multi-licensed; any one may be chosen)
- Files: `assets/cburnett/*.svg`
- Changes: the six light pieces are used as the geometry for all four seats,
  with fills and strokes rebound per seat.

## Xiangqi pieces

"Xiangqi pieces with pictorial (Western chess style) drawings"

- Author: Hari Seldon
- Source: https://commons.wikimedia.org/wiki/File:Xiangqi_pieces_with_pictorial_(Western_chess_style)_drawings.svg
- Licence: CC BY-SA 3.0
- File: `assets/xiangqi-pictorial.svg`
- Changes: recoloured into three palettes and rasterised into per-piece tiles
  under `public/pieces/`.

## Regenerating

```bash
npm run art
```

Reads `assets/`, writes `src/components/pieceArt.tsx` and `public/pieces/`.
