// This app takes the TOKENS from @minty/shared and nothing else - no packaged component, so no
// `@source` line and no transpilePackages. The import is loud if it breaks (a bad specifier fails
// the build); what this pins is what the tokens come out AS, and that nothing local redeclares
// them, which would win invisibly.
//
// It compiles the app's REAL stylesheet with the app's REAL Tailwind plugin, so it tests what the
// browser is served, not what the file says.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { beforeAll, describe, expect, it } from 'vitest';

const CSS = 'app/globals.css';

let compiled = '';

beforeAll(async () => {
  compiled = (
    await postcss([tailwind()]).process(readFileSync(CSS, 'utf8'), { from: resolve(CSS) })
  ).css;
}, 120_000);

describe("@minty/shared's tokens reach the stylesheet", () => {
  it('imports them', () => {
    expect(readFileSync(CSS, 'utf8')).toContain("@import '@minty/shared/theme.css';");
  });

  it('has no local font tokens left to override them', () => {
    expect(readFileSync(CSS, 'utf8')).not.toMatch(/^\s*--font-(sans|brand|mono):/m);
  });

  it('emits the shared faces', () => {
    expect(compiled).toMatch(/--font-sans:\s*var\(--font-inter\)/);
    expect(compiled).toMatch(/--font-brand:\s*var\(--font-jakarta\)/);
  });

  it("still emits this app's own icon font and brand colours", () => {
    expect(compiled).toMatch(/--color-secondary:\s*#54d3da/);
    expect(compiled).toMatch(/material-symbols|Material Symbols/i);
  });
});
