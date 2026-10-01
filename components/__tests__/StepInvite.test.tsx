// StepInvite's arrival prompt -- "The following setup steps require accounting expertise".
//
// It opens on its own every time the step mounts. "Ok" only closes it (the user stays to
// invite someone); "Skip" closes it AND advances, so a user with nobody to invite is not
// made to dismiss the prompt and then find "Add later" at the foot of the page.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StepInvite } from '../OnboardingSteps';
import { ToastProvider } from '../Toast';
import type { StepProps } from '../../lib/types';

function renderStep() {
  const next = vi.fn();
  render(
    <ToastProvider>
      <StepInvite
        state={{ invites: [] } as unknown as StepProps['state']}
        set={vi.fn()}
        next={next}
        back={vi.fn()}
        submitInvite={vi.fn()}
        cancelInvite={vi.fn()}
        saveAndExit={vi.fn()}
      />
    </ToastProvider>,
  );
  return { next };
}

const prompt = () => screen.queryByRole('dialog', { name: /require accounting expertise/ });

describe('StepInvite arrival prompt', () => {
  it('opens on arrival', () => {
    renderStep();
    expect(prompt()).toBeInTheDocument();
  });

  it('Ok closes it and stays on the step', async () => {
    const { next } = renderStep();
    await userEvent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(prompt()).not.toBeInTheDocument();
    expect(next).not.toHaveBeenCalled();
  });

  it('Skip closes it and moves on to the next step', async () => {
    const { next } = renderStep();
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(prompt()).not.toBeInTheDocument();
    expect(next).toHaveBeenCalledOnce();
  });
});
