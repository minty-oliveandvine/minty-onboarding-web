// useEmailInput (@minty/shared/emailInput; was lib/emailInput) -- the hook every email
// field spreads: English only, IME-aware.

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { EMAIL_ASCII_HINT, useEmailInput } from "@minty/shared/emailInput";

function setNativeValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
}

/** A controlled field the way BillingSheet and Step 1 wire it. */
function Field({ onValue }: { onValue?: (v: string) => void }) {
  const [value, setValue] = useState("");
  const email = useEmailInput((v) => {
    setValue(v);
    onValue?.(v);
  });
  return (
    <>
      <input aria-label="Email" value={value} {...email.props} />
      {email.rejected ? <p>{EMAIL_ASCII_HINT}</p> : null}
    </>
  );
}

describe("useEmailInput", () => {
  // Pinned before it moved to @minty/shared (the shared-code refactor,
  // 2026-10-21): the props it hands the input, the strip, the hint flag, and the IME pause.

  it("hands the input text/email props, never type=email", () => {
    render(<Field />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "email");
    expect(input).toHaveAttribute("autocomplete", "email");
    expect(input).toHaveAttribute("autocapitalize", "none");
    expect(input).toHaveAttribute("autocorrect", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
  });

  it("passes a clean value through and raises no hint", () => {
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "user@example.com" } });
    expect(onValue).toHaveBeenLastCalledWith("user@example.com");
    expect(input.value).toBe("user@example.com");
    expect(screen.queryByText(EMAIL_ASCII_HINT)).toBeNull();
  });

  it("strips Korean and raises the hint", () => {
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "user@회사.com" } });
    expect(onValue).toHaveBeenLastCalledWith("user@.com");
    expect(input.value).toBe("user@.com");
    expect(screen.getByText(EMAIL_ASCII_HINT)).toBeInTheDocument();
  });

  it("strips a space WITHOUT raising the hint (a space is ASCII)", () => {
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "user @example.com" } });
    expect(onValue).toHaveBeenLastCalledWith("user@example.com");
    expect(screen.queryByText(EMAIL_ASCII_HINT)).toBeNull();
  });

  it("clears the hint on the next clean change", () => {
    render(<Field />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "é@b.co" } });
    expect(screen.getByText(EMAIL_ASCII_HINT)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "e@b.co" } });
    expect(screen.queryByText(EMAIL_ASCII_HINT)).toBeNull();
  });

  it("keeps the caret where the user was, counted in the cleaned value", () => {
    render(<Field />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    const spy = vi.spyOn(input, "setSelectionRange");
    // jsdom puts the caret at the end of a value set this way: 10 characters raw, of which
    // two are dropped, so the cleaned caret is 8.
    fireEvent.change(input, { target: { value: "ab한cd@x한.y" } });
    expect(input.value).toBe("abcd@x.y");
    expect(spy).toHaveBeenLastCalledWith(8, 8);
  });

  it("during an IME composition hands the RAW value on and does not strip", () => {
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    // The prototype setter, as fireEvent.change uses: assigning input.value directly would
    // update React's value tracker too, and React would then see no change to report.
    setNativeValue(input, "user@회");
    input.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    expect(onValue).toHaveBeenLastCalledWith("user@회");
    expect(screen.queryByText(EMAIL_ASCII_HINT)).toBeNull();
  });

  it("strips once the composition ends", () => {
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    input.value = "user@회사";
    fireEvent.compositionEnd(input);
    expect(onValue).toHaveBeenLastCalledWith("user@");
    expect(input.value).toBe("user@");
    expect(screen.getByText(EMAIL_ASCII_HINT)).toBeInTheDocument();
  });

  it("works with no callback at all", () => {
    function Bare() {
      const email = useEmailInput();
      return <input aria-label="Bare" {...email.props} />;
    }
    render(<Bare />);
    const input = screen.getByLabelText("Bare") as HTMLInputElement;
    expect(() => fireEvent.change(input, { target: { value: "a한@b.c" } })).not.toThrow();
    expect(input.value).toBe("a@b.c");
  });
});
