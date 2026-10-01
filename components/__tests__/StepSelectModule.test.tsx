// components/OnboardingSteps StepSelectModule -- the confetti pop on the module step.
//
// It is fired by the CLICK that completes the pair, not by the pair being picked: a
// payer coming back to the step with both already ticked has celebrated once and sees
// nothing. Unticking and re-ticking is a new completion and pops again.

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StepSelectModule } from '../OnboardingSteps';
import { ToastProvider } from '../Toast';
import type { ModuleId } from '../../lib/api';
import type { WizardState } from '../../lib/types';

function Harness({ modules }: { modules: ModuleId[] }) {
  const [state, setState] = useState({ modules, entity: {} } as unknown as WizardState);
  return (
    <ToastProvider>
      <StepSelectModule
        state={state}
        set={(patch) =>
          setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))
        }
        next={vi.fn()}
        back={vi.fn()}
        submitModule={vi.fn()}
        modulePlans={null}
        token=""
        saveAndExit={vi.fn()}
      />
    </ToastProvider>
  );
}

const cards = (c: HTMLElement) => c.querySelectorAll<HTMLElement>('.module-pick');
const pieces = (c: HTMLElement) => c.querySelectorAll('.confetti-piece.is-pop');

describe('StepSelectModule confetti', () => {
  it('bursts on the second pick, not the first', async () => {
    const { container } = render(<Harness modules={[]} />);
    await userEvent.click(cards(container)[0]);
    expect(pieces(container)).toHaveLength(0);
    await userEvent.click(cards(container)[1]);
    expect(pieces(container).length).toBeGreaterThan(0);
  });

  it('shows nothing on arriving with both already picked', () => {
    const { container } = render(<Harness modules={['pettyCash', 'bills']} />);
    expect(pieces(container)).toHaveLength(0);
  });

  it('pops a fresh burst on every re-completion', async () => {
    const { container } = render(<Harness modules={['pettyCash', 'bills']} />);
    await userEvent.click(cards(container)[1]);
    await userEvent.click(cards(container)[1]);
    const first = pieces(container)[0];
    expect(first).toBeDefined();
    await userEvent.click(cards(container)[1]);
    await userEvent.click(cards(container)[1]);
    expect(pieces(container)[0]).not.toBe(first);
  });
});
