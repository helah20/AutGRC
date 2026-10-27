/**
 * The organisation's identity on exported files: curated colours that keep
 * their contrast, a logo read from its own header, and the exports carrying
 * both.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autgrc-brand-'));
process.env.AUTGRC_DATA_DIR = tmpDir;
process.env.AUTGRC_DB_FILE = path.join(tmpDir, 'test.db');

const { PALETTES, FONTS, colourProblem, contrast, parseLogo, imageSize, brandFrom } = await import('../src/services/brand.js');
const { buildDocx } = await import('../src/services/export-docx.js');
const { buildSwimlanePptx } = await import('../src/services/export-pptx.js');
const { default: JSZip } = await import('jszip');

/** A valid PNG of the given size, solid colour. */
function png(width, height) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x40)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}
const logoUrl = `data:image/png;base64,${png(300, 100).toString('base64')}`;

test('every curated palette carries white text and reads on white', () => {
  for (const [key, p] of Object.entries(PALETTES)) {
    assert.equal(colourProblem(p.primary, p.accent), null, key);
    assert.ok(contrast(p.primary, 'FFFFFF') >= 4.5, `${key} primary`);
  }
  assert.match(colourProblem('F5D76E', '1F3A5F'), /too light/, 'a pale primary is refused');
  assert.match(colourProblem('zzz', '1F3A5F'), /hex/);
});

test('a logo is read from its own header, and anything else is refused', () => {
  const logo = parseLogo(logoUrl);
  assert.equal(logo.error, undefined);
  assert.deepEqual([logo.type, logo.width, logo.height], ['png', 300, 100]);
  assert.ok(parseLogo('data:image/gif;base64,R0lGOD').error);
  assert.ok(parseLogo('not a data url').error);
  // A minimal JPEG start-of-frame header.
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x40, 0x00, 0x80, 0x03]);
  assert.deepEqual(imageSize(jpeg), { type: 'jpg', width: 128, height: 64 });
});

test('the brand falls back to the defaults, and keeps a valid custom pair', () => {
  const plain = brandFrom({});
  assert.equal(plain.primary, PALETTES.navy.primary);
  assert.equal(plain.fonts, FONTS.calibri_segoe);
  const custom = brandFrom({ brand_palette: 'custom', brand_primary: '0B3D2E', brand_accent: '1E6B52', brand_font: 'arial' });
  assert.equal(custom.primary, '0B3D2E');
  assert.equal(custom.fonts.arabic, 'Arial');
  const unreadable = brandFrom({ brand_palette: 'custom', brand_primary: 'FFFF00', brand_accent: 'FFFF00' });
  assert.equal(unreadable.primary, PALETTES.navy.primary, 'an unreadable custom pair is not used');
});

test('a Word document carries the logo, the colours and the font pairing', async () => {
  const brand = brandFrom({ brand_palette: 'emerald', brand_font: 'calibri_sakkal', logo_data_url: logoUrl });
  const buffer = await buildDocx({
    document: { reference: 'POL-TST-001', title: 'سياسة الاختبار', version: '1.0', status: 'published', classification: 'internal', doc_type: 'policy', domain_key: 'iam' },
    sections: [{ heading: 'الغرض', body: '<p>نص</p>' }],
    org: { org_name: 'Test Org' },
    lang: 'ar',
    brand
  });
  const zip = await JSZip.loadAsync(buffer);
  const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
  assert.ok(media.length >= 1, 'the logo is embedded');
  const styles = await zip.file('word/styles.xml').async('string');
  assert.match(styles, new RegExp(PALETTES.emerald.primary, 'i'), 'headings use the primary colour');
  assert.match(styles, /w:cs="Sakkal Majalla"/, 'Arabic is set in the Arabic face');
  assert.match(styles, /w:ascii="Calibri"/, 'Latin is set in the Latin face');
  const body = await zip.file('word/document.xml').async('string');
  assert.doesNotMatch(body, /TOC \\\\/, 'the contents are written out, not a field');
});

test('a swimlane deck carries the logo and the palette', async () => {
  const brand = brandFrom({ brand_palette: 'plum', brand_font: 'arial', logo_data_url: logoUrl });
  const buffer = await buildSwimlanePptx({
    flow: { steps: [{ name: 'Start', actor: 'A', detail: 'x' }, { name: 'Finish', actor: 'B', detail: 'y' }] },
    lang: 'en', title: 'Test', brand
  });
  const zip = await JSZip.loadAsync(buffer);
  const slide = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.match(slide, new RegExp(PALETTES.plum.primary, 'i'));
  assert.ok(Object.keys(zip.files).some((name) => name.startsWith('ppt/media/')), 'the logo is embedded');
});
