// components/MintyDatePicker -- its own month names (DP_MONTHS), which are NOT lib/date's.
//
// DP_MONTHS and dpPretty are private, so they are pinned through what the picker draws.

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MintyDatePicker from '../MintyDatePicker';

const FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

describe('MintyDatePicker month names', () => {
  // Pins the picker's MONTHS array and its "12 Sep 2026" trigger text before the month
  // names move to @minty/shared (the shared-code refactor, 2026-10-21). The flow's
  // other dates (@minty/shared/dates' formatDay) are title case too since then, so they match.

  it.each(FULL.map((name, i) => [i, name]))(
    'month %i: trigger shows the first three letters in title case, header the full name',
    (i, name) => {
      const iso = `2026-${String(Number(i) + 1).padStart(2, '0')}-05`;
      render(<MintyDatePicker value={iso} onChange={vi.fn()} />);
      const trigger = screen.getByText(`05 ${String(name).slice(0, 3)} 2026`);
      expect(trigger).toHaveClass('mdp-value');
      fireEvent.click(trigger);
      expect(screen.getByText(`${name} 2026`)).toHaveClass('mdp-title');
    },
  );

  it('cuts September to "Sep", like lib/date, not en-GB\'s "Sept"', () => {
    render(<MintyDatePicker value="2026-09-12" onChange={vi.fn()} />);
    expect(screen.getByText('12 Sep 2026')).toBeInTheDocument();
  });

  it('shows the placeholder for an empty or unparseable value', () => {
    const { rerender } = render(<MintyDatePicker value="" onChange={vi.fn()} />);
    expect(screen.getByText('Select a date')).toHaveClass('placeholder');
    rerender(<MintyDatePicker value="2026-13" onChange={vi.fn()} />);
    expect(screen.getByText('Select a date')).toBeInTheDocument();
  });
});
