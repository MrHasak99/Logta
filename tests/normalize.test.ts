import { describe, expect, it } from 'vitest';
import { normalizeAlias, parseSize, toWesternDigits } from '../src/lib/normalize.ts';

describe('normalizeAlias', () => {
  it('lowercases, strips punctuation and unifies units (English shorthand)', () => {
    expect(normalizeAlias('KDD F/F MILK 1LTR')).toBe('kdd f f milk 1 l');
    expect(normalizeAlias('ALM FF MLK 1L')).toBe('alm ff mlk 1 l');
    expect(normalizeAlias('TILDA BSMTI 5KG')).toBe('tilda bsmti 5 kg');
    expect(normalizeAlias('Nido 1800 GMS')).toBe('nido 1800 g');
    expect(normalizeAlias('Water 500 ML')).toBe('water 500 ml');
  });

  it('converts Arabic-Indic digits and the Arabic decimal separator', () => {
    expect(toWesternDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
    expect(normalizeAlias('أرز بسمتي ٢٫٥ كجم')).toBe('ارز بسمتي 2.5 kg');
  });

  it('unifies Arabic letter variants and strips tatweel / diacritics', () => {
    expect(normalizeAlias('حليب المراعي كامل ١ لتر')).toBe('حليب المراعي كامل 1 l');
    expect(normalizeAlias('إسبريسو')).toBe('اسبريسو');
    expect(normalizeAlias('آيس كريم')).toBe('ايس كريم');
    expect(normalizeAlias('قَهْوَة')).toBe('قهوه');
    expect(normalizeAlias('حلـــيب')).toBe('حليب');
    expect(normalizeAlias('مستشفى')).toBe('مستشفي');
  });

  it('unifies Arabic unit words, including glued to digits', () => {
    expect(normalizeAlias('عيش تيلدا ٥كيلو')).toBe('عيش تيلدا 5 kg');
    expect(normalizeAlias('دجاج ساديا ١٠٠٠غ')).toBe('دجاج ساديا 1000 g');
    expect(normalizeAlias('جبنة ٥٠٠ غرام')).toBe('جبنه 500 g');
    expect(normalizeAlias('تونة ١٨٥ جم')).toBe('تونه 185 g');
  });

  it('keeps decimals, canonicalises numbers and multipacks; strips Latin accents', () => {
    expect(normalizeAlias('AFIA CORN OIL 1.80 LTR')).toBe('afia corn oil 1.8 l');
    expect(normalizeAlias('PEPSI 6X330ML')).toBe('pepsi 6 x 330 ml');
    expect(normalizeAlias('Nescafé Classic')).toBe('nescafe classic');
    expect(normalizeAlias('  lots   of\tspace  ')).toBe('lots of space');
  });

  it('equal strings for equivalent Arabic/English spellings', () => {
    expect(normalizeAlias('حليب KDD كامل ١ لتر')).toBe(normalizeAlias('حليب kdd كامل 1L'));
  });
});

describe('parseSize', () => {
  it('extracts base quantities', () => {
    expect(parseSize(normalizeAlias('TILDA 5KG'))).toEqual({ baseQty: 5000, kind: 'mass', packCount: 1 });
    expect(parseSize(normalizeAlias('حليب ١ لتر'))).toEqual({ baseQty: 1000, kind: 'volume', packCount: 1 });
    expect(parseSize(normalizeAlias('PEPSI 6X330ML'))).toEqual({ baseQty: 330, kind: 'volume', packCount: 6 });
    expect(parseSize(normalizeAlias('EGGS 30PCS'))).toEqual({ baseQty: 30, kind: 'count', packCount: 1 });
    expect(parseSize(normalizeAlias('just text'))).toBeNull();
  });
});
