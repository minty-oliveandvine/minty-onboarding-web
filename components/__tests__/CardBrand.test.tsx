// components/CardBrand -- the network mark, in its two fits.
//
// `tile` is the picker chip's look and must not move: the mark in the middle of a 46x30
// card-shaped field. `mark` is the same drawing with that field cropped away, so in the
// Subscription Summary (01-C) the logo fills its slot instead of sitting small in the
// middle of it. minty-web's copy of the component has the same two fits and the same
// crops; these cases mirror its tests so the two cannot drift apart unnoticed.

import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import CardBrand from '../CardBrand';

const svgOf = (ui: ReactElement) => render(ui).container.querySelector('svg')!;
const box = (svg: SVGSVGElement) => svg.getAttribute('viewBox')!.split(' ').map(Number);

describe('CardBrand', () => {
  it('draws on the card-shaped field by default, as the picker chip does', () => {
    for (const brand of ['visa', 'mastercard']) {
      const svg = svgOf(<CardBrand brand={brand} />);
      expect(svg).toHaveAttribute('viewBox', '0 0 46 30');
      expect(svg).toHaveAttribute('width', '46');
      expect(svg).toHaveAttribute('height', '30');
      expect(svg).not.toHaveAttribute('preserveAspectRatio');
    }
  });

  it('crops a wordmark to its own width and its capitals, flush right', () => {
    // VISA's four letters are 24.8 units wide, centred on x=23.
    const visa = svgOf(<CardBrand brand="visa" fit="mark" />);
    const [x, y, w, h] = box(visa);
    expect(x).toBeCloseTo(23 - 24.8 / 2);
    expect(w).toBeCloseTo(24.8);
    expect([y, h]).toEqual([10, 10.5]);
    expect(visa).toHaveAttribute('preserveAspectRatio', 'xMaxYMid meet');
    // The crop's own size is the svg's intrinsic ratio, which `height: auto` sizes it by.
    expect(Number(visa.getAttribute('width'))).toBeCloseTo(w);
    expect(Number(visa.getAttribute('height'))).toBe(h);

    // A long name keeps the chip's cap, so the crop never grows past it.
    expect(box(svgOf(<CardBrand brand="unionpay" fit="mark" />))[2]).toBe(38);
  });

  it('never crops narrower than a four-letter mark, so a short one is not drawn huge', () => {
    const [x, , w] = box(svgOf(<CardBrand brand="cartes_bancaires" fit="mark" />));
    expect(w).toBeCloseTo(24.8);
    expect(x + w).toBeCloseTo(23 + 14 / 2); // the crop ends where "CB" does
  });

  it('crops Mastercard to its two circles', () => {
    const svg = svgOf(<CardBrand brand="mastercard" fit="mark" />);
    expect(svg).toHaveAttribute('viewBox', '9.5 6 27 18');
    expect(svg).toHaveAttribute('width', '27');
    expect(svg).toHaveAttribute('height', '18');
    expect(svg.querySelectorAll('circle')).toHaveLength(2);
  });

  it('an unknown brand still gets a readable mark from its label', () => {
    const { container } = render(
      <CardBrand brand="link" label="Link" className="sub-pay-mark" fit="mark" />,
    );
    expect(container.querySelector('text')).toHaveTextContent('LINK');
    expect(container.firstElementChild).toHaveClass('sub-pay-mark');
  });
});
