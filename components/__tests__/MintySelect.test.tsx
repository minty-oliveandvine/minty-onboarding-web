// MintySelect's "type to add" hint -- the petty-cash contact fields (step 7) can create a
// Xero contact, but the "+ Add" row only appears once a name is typed. The hint says so
// the moment the box opens, and gives way to the "+ Add" row as soon as there is a name.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MintySelect from '../MintySelect';
import type { ContactResult } from '../../lib/api';

const HINT = 'Type a contact name to add a new contact';

function renderSelect(onCreate: ((name: string) => Promise<ContactResult>) | null) {
  render(
    <MintySelect
      value=""
      onChange={vi.fn()}
      options={['Alice', 'Bob']}
      searchable
      onCreate={onCreate}
      createNoun="contact"
    />,
  );
  return screen.getByRole('textbox');
}

describe('MintySelect create hint', () => {
  it('shows on opening a field that can create', async () => {
    await userEvent.click(renderSelect(vi.fn()));
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it('gives way to the + Add row once a new name is typed', async () => {
    await userEvent.type(renderSelect(vi.fn()), 'Carol');
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Add .Carol. as a new contact/ })).toBeVisible();
  });

  it('is absent where nothing can be created', async () => {
    await userEvent.click(renderSelect(null));
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});
