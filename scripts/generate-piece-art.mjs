/**
 * Turns the two licensed source asset sets into board-ready art.
 *
 *   assets/cburnett/*.svg        -> vector chess pieces, recoloured per seat
 *   assets/xiangqi-pictorial.svg -> rasterised tiles in public/pieces
 *
 * The chess set is kept as vectors because each file is one clean piece whose
 * fills and strokes can be rebound. The xiangqi sheet is rasterised instead:
 * it draws each piece as a single path holding several subpaths, and splitting
 * that by bounding box silently loses parts of the blockier shapes (the
 * chariot loses its body and base). Recolouring the sheet before rasterising
 * gives an exact copy of the original artwork in each seat's palette.
 *
 * Run with: npm run art
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "src/components/pieceArt.tsx");

/* ------------------------------------------------------------------ chess */

const CHESS_FILES = {
  king: "klt.svg",
  queen: "qlt.svg",
  rook: "rlt.svg",
  bishop: "blt.svg",
  knight: "nlt.svg",
  pawn: "plt.svg",
};

/**
 * Route every literal colour to a sentinel.
 *
 * The long alternative has to come first: `#(?:fff|ffffff)` matches `fff` and
 * leaves the other three characters behind, yielding an invalid colour that
 * either falls back to black or, under a group with fill:none, disappears.
 */
function recolour(xml) {
  return xml
    .replace(/fill="#(?:ffffff|fff)"/gi, 'fill="__PF__"')
    .replace(/fill:\s*#(?:ffffff|fff)\b/gi, "fill:__PF__")
    .replace(/stroke="#(?:000000|000)"/gi, 'stroke="__PS__"')
    .replace(/stroke:\s*#(?:000000|000)\b/gi, "stroke:__PS__")
    .replace(/fill="#(?:000000|000)"/gi, 'fill="__PS__"')
    .replace(/fill:\s*#(?:000000|000)\b/gi, "fill:__PS__");
}

/** JSX wants camelCase attributes and object styles. */
function toJsx(xml) {
  const ATTRS = {
    "fill-rule": "fillRule",
    "fill-opacity": "fillOpacity",
    "stroke-width": "strokeWidth",
    "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin",
    "stroke-miterlimit": "strokeMiterlimit",
    "stroke-dasharray": "strokeDasharray",
    "stroke-opacity": "strokeOpacity",
    "stroke-dashoffset": "strokeDashoffset",
    "clip-rule": "clipRule",
  };
  let out = xml;
  for (const [from, to] of Object.entries(ATTRS)) {
    out = out.replace(new RegExp(`\\b${from}=`, "g"), `${to}=`);
  }
  return out.replace(/style="([^"]*)"/g, (_, decls) => {
    const entries = decls
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((decl) => {
        const i = decl.indexOf(":");
        const key = decl
          .slice(0, i)
          .trim()
          .replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
        return `${JSON.stringify(key)}: ${JSON.stringify(decl.slice(i + 1).trim())}`;
      });
    return `style={{${entries.join(", ")}}}`;
  });
}

/** Bind the sentinels to the palette argument `c`. */
function bindColours(jsx) {
  return jsx
    .replace(/: "__PF__"/g, ": c.pf")
    .replace(/: "__PS__"/g, ": c.ps")
    .replace(/="__PF__"/g, "={c.pf}")
    .replace(/="__PS__"/g, "={c.ps}");
}

function innerSvg(xml) {
  const open = xml.indexOf(">", xml.indexOf("<svg"));
  return xml.slice(open + 1, xml.lastIndexOf("</svg>")).trim();
}

function buildChess() {
  const parts = {};
  for (const [type, file] of Object.entries(CHESS_FILES)) {
    const raw = fs.readFileSync(path.join(ROOT, "assets/cburnett", file), "utf8");
    parts[type] = bindColours(toJsx(recolour(innerSvg(raw))));
  }
  return parts;
}

/**
 * The dark pieces use Cburnett's own dark artwork rather than the light
 * geometry recoloured. Recolouring gives a dark body that needs a light
 * outline for its engraved lines to survive, which reads badly; the real dark
 * set is a black piece with a black outline and white detail lines inside.
 * Pure black is softened slightly so it sits better on a warm board.
 */
function buildChessDark() {
  const parts = {};
  for (const [type, file] of Object.entries(CHESS_FILES)) {
    const dark = file.replace("lt.svg", "dt.svg");
    const raw = fs.readFileSync(path.join(ROOT, "assets/cburnett", dark), "utf8");
    const softened = innerSvg(raw)
      .replace(/#(?:000000|000)\b/gi, "#1c1916")
      .replace(/#(?:ffffff|fff)\b/gi, "#efe8db");
    parts[type] = toJsx(softened);
  }
  return parts;
}

/* ---------------------------------------------------------------- xiangqi */

const XQ_ORDER = [
  "general",
  "elephant",
  "advisor",
  "cannon",
  "soldier",
  "chariot",
  "horse",
];

const SHEET_W = 285.06934;
const SHEET_H = 79.29126;
const COLS = 7;
const TILE = 256;

/*
 * Measured disc geometry, not the nominal cell size. The discs are pitched
 * 41.43 apart and the first one starts at x = -2.3, slightly outside the
 * sheet, so cropping on SHEET_W / 7 clips one edge of most tiles.
 */
const DISC_CX0 = 18.25;
const DISC_PITCH = 41.4333;
const DISC_CY = 18.25;
const DISC_SIZE = 42;
/** Padding so a crop centred on the first disc stays inside the canvas. */
const PAD = 6;

/** The three looks the four seats need; both dark seats share one. */
const VARIANTS = {
  light: { disc: "#f4f1ea", art: "#1b1714" },
  dark: { disc: "#2a2623", art: "#ece4d4" },
  red: { disc: "#f1e7d0", art: "#b3271d" },
};

async function buildXiangqi() {
  const raw = fs.readFileSync(path.join(ROOT, "assets/xiangqi-pictorial.svg"), "utf8");
  const dir = path.join(ROOT, "public/pieces");
  fs.mkdirSync(dir, { recursive: true });

  // One sheet unit maps to this many pixels, so a disc lands exactly on a tile.
  const s = TILE / DISC_SIZE;
  const canvasW = Math.round((SHEET_W + PAD * 2) * s);
  const canvasH = Math.round((SHEET_H + PAD * 2) * s);

  for (const [name, colors] of Object.entries(VARIANTS)) {
    // Both rows take the same colour, so cropping the top row is enough.
    const recoloured = raw
      .replace(/#353734/gi, colors.disc)
      .replace(/#ffffff/gi, colors.art)
      .replace(/#aa0000/gi, colors.art)
      // Re-frame with padding so no crop falls off the canvas.
      .replace(
        /<svg([^>]*?)>/,
        (tag, attrs) =>
          `<svg${attrs
            .replace(/\swidth="[^"]*"/, "")
            .replace(/\sheight="[^"]*"/, "")
            .replace(/\sviewBox="[^"]*"/, "")} width="${SHEET_W + PAD * 2}" height="${SHEET_H + PAD * 2}" viewBox="${-PAD} ${-PAD} ${SHEET_W + PAD * 2} ${SHEET_H + PAD * 2}">`,
      );

    const sheet = await sharp(Buffer.from(recoloured), { density: 600 })
      .resize({ width: canvasW, height: canvasH })
      .png()
      .toBuffer();

    for (let i = 0; i < COLS; i++) {
      const left = Math.round((DISC_CX0 + i * DISC_PITCH - DISC_SIZE / 2 + PAD) * s);
      const top = Math.round((DISC_CY - DISC_SIZE / 2 + PAD) * s);
      await sharp(sheet)
        .extract({ left, top, width: TILE, height: TILE })
        .png({ compressionLevel: 9 })
        .toFile(path.join(dir, `xq-${XQ_ORDER[i]}-${name}.png`));
    }
  }
  return Object.keys(VARIANTS);
}

/* ------------------------------------------------------------------- emit */

const chess = buildChess();
const chessDark = buildChessDark();
const variants = await buildXiangqi();

const out = [];
out.push("/* GENERATED FILE -- do not edit by hand. Run `npm run art` instead.");
out.push(" *");
out.push(" * Chess pieces: the Cburnett set from Wikimedia Commons (CC BY-SA 3.0 /");
out.push(" * GFDL), the artwork Wikipedia and lichess use. Vector, recoloured per");
out.push(" * seat at render time.");
out.push(' * Xiangqi pieces: "Xiangqi pieces with pictorial (Western chess style)');
out.push(' * drawings" by Hari Seldon, Wikimedia Commons (CC BY-SA 3.0). Rasterised');
out.push(" * into public/pieces, one tile per piece per palette.");
out.push(" * See ATTRIBUTION.md.");
out.push(" */");
out.push('import type { JSX } from "react";');
out.push('import type { PieceType } from "@/rules/types";');
out.push("");
out.push("export interface PieceColors {");
out.push("  /** Body fill. */");
out.push("  pf: string;");
out.push("  /** Outline and engraved detail. */");
out.push("  ps: string;");
out.push("}");
out.push("");
out.push("/** Scales the 45x45 chess art onto the shared 0..100 box. */");
out.push(`export const CHESS_SCALE = "scale(${(100 / 45).toFixed(6)})";`);
out.push("");
out.push(
  `export type XiangqiVariant = ${variants.map((v) => JSON.stringify(v)).join(" | ")};`,
);
out.push("");
out.push("/** Tile for a xiangqi-native piece, served from public/pieces. */");
out.push(
  "export function xiangqiSprite(type: PieceType, variant: XiangqiVariant): string {",
);
out.push("  return `/pieces/xq-${type}-${variant}.png`;");
out.push("}");
out.push("");
out.push(
  "export const CHESS_ART: Partial<Record<PieceType, (c: PieceColors) => JSX.Element>> = {",
);
for (const [type, jsx] of Object.entries(chess)) {
  out.push(`  ${type}: (c) => (`);
  out.push("    <>");
  out.push(jsx);
  out.push("    </>");
  out.push("  ),");
}
out.push("};");
out.push("");
out.push("/** Cburnett's own dark artwork, used as drawn. */");
out.push(
  "export const CHESS_ART_DARK: Partial<Record<PieceType, JSX.Element>> = {",
);
for (const [type, jsx] of Object.entries(chessDark)) {
  out.push(`  ${type}: (`);
  out.push("    <>");
  out.push(jsx);
  out.push("    </>");
  out.push("  ),");
}
out.push("};");
out.push("");

fs.writeFileSync(OUT, out.join("\n"));
console.log(`wrote ${path.relative(ROOT, OUT)} - ${Object.keys(chess).length} light + ${Object.keys(chessDark).length} dark chess vectors`);
console.log(`wrote ${XQ_ORDER.length * variants.length} xiangqi tiles to public/pieces`);
