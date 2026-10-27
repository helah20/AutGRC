/**
 * The organisation's identity on the files the platform produces.
 *
 * A Word policy, a PDF, a workbook and a swimlane deck leave the platform and
 * circulate inside the organisation as its own documents, so they carry its
 * logo, colours and type rather than the platform's. The choices are curated
 * rather than free: a palette is a primary and an accent that have been
 * checked against the white text and the light tints the exports put on them,
 * and a font is a Latin face paired with an Arabic one that ships with
 * Windows (on a Mac, Word substitutes a similar face). A custom colour is accepted only if it keeps that contrast,
 * because a header nobody can read is not a brand.
 *
 * Every export derives its tints from the two colours here, so a table header,
 * a callout and a swimlane box shift together and never clash.
 */

import { q } from '../db/index.js';

/** Curated pairs: primary carries white text, accent marks headings and rules. */
export const PALETTES = {
  navy: { primary: '1F3A5F', accent: '2E6F9E' },
  emerald: { primary: '0E5A45', accent: '1E8466' },
  royal: { primary: '27348B', accent: '4A5FC7' },
  teal: { primary: '124E5C', accent: '24808F' },
  graphite: { primary: '2B2F36', accent: '8C6A2B' },
  plum: { primary: '4A2A5E', accent: '7A4E94' }
};

/**
 * Latin and Arabic faces chosen together. Arabic set in Sakkal Majalla reads
 * about two points smaller than Latin at the same size, so it is raised.
 */
export const FONTS = {
  calibri_segoe: { latin: 'Calibri', arabic: 'Segoe UI', arabicBoost: 0 },
  arial: { latin: 'Arial', arabic: 'Arial', arabicBoost: 0 },
  calibri_sakkal: { latin: 'Calibri', arabic: 'Sakkal Majalla', arabicBoost: 4 },
  tahoma: { latin: 'Tahoma', arabic: 'Tahoma', arabicBoost: 0 }
};

export const DEFAULT_BRAND = { palette: 'navy', font: 'calibri_segoe' };

const HEX = /^[0-9A-F]{6}$/;

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const n = parseInt(hex, 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two colours. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour `amount` of the way from `hex` to white. */
export function tint(hex, amount) {
  const n = parseInt(hex, 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix).map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Why a pair of custom colours would not work, or null when it does. The
 * primary carries white text in table headers and title bars (4.5:1, the
 * body-text threshold); the accent is used for headings on white (3:1, the
 * large-text threshold).
 */
export function colourProblem(primary, accent) {
  if (!HEX.test(primary || '') || !HEX.test(accent || '')) return 'Colours must be six-digit hex values.';
  if (contrast(primary, 'FFFFFF') < 4.5) return 'The primary colour is too light to carry white text. Choose a darker shade.';
  if (contrast(accent, 'FFFFFF') < 3) return 'The accent colour is too light to read on white. Choose a darker shade.';
  return null;
}

/** Width and height of a PNG or JPEG, read from its header. */
export function imageSize(buffer) {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { type: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i < buffer.length) {
      if (buffer[i] !== 0xff) { i += 1; continue; }
      const marker = buffer[i + 1];
      const length = buffer.readUInt16BE(i + 2);
      // Start-of-frame markers carry the dimensions; DHT, JPG and DAC do not.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: 'jpg', height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
      }
      i += 2 + length;
    }
  }
  return null;
}

/** Decode a logo data URL, or explain why it cannot be used. */
export function parseLogo(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return { error: 'The logo must be a PNG or JPEG image.' };
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > 512 * 1024) return { error: 'The logo must be smaller than 512 KB.' };
  const size = imageSize(buffer);
  if (!size || !size.width || !size.height) return { error: 'The logo image could not be read.' };
  return { buffer, ...size };
}

/** Fit an image inside a box, keeping its proportions. Units are the caller's. */
export function fitWithin(size, maxW, maxH) {
  const scale = Math.min(maxW / size.width, maxH / size.height);
  return { width: size.width * scale, height: size.height * scale };
}

/** The brand as the exporters use it, from an org_profile row. */
export function brandFrom(row) {
  const paletteKey = row?.brand_palette === 'custom' || PALETTES[row?.brand_palette] ? row.brand_palette : DEFAULT_BRAND.palette;
  const colours = paletteKey === 'custom' && !colourProblem(row.brand_primary, row.brand_accent)
    ? { primary: row.brand_primary, accent: row.brand_accent }
    : PALETTES[paletteKey] || PALETTES[DEFAULT_BRAND.palette];
  const fontKey = FONTS[row?.brand_font] ? row.brand_font : DEFAULT_BRAND.font;
  const logo = row?.logo_data_url ? parseLogo(row.logo_data_url) : null;
  return {
    palette: paletteKey,
    font: fontKey,
    fonts: FONTS[fontKey],
    primary: colours.primary,
    accent: colours.accent,
    // Derived, so every tint moves with the two chosen colours.
    light: tint(colours.primary, 0.93),
    border: tint(colours.primary, 0.75),
    soft: tint(colours.accent, 0.55),
    logo: logo && !logo.error ? logo : null
  };
}

/** The organisation's current brand. */
export function currentBrand() {
  return brandFrom(q.get('SELECT logo_data_url, brand_palette, brand_primary, brand_accent, brand_font FROM org_profile WHERE id = 1'));
}
