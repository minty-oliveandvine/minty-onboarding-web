/**
 * The one Auto Fill button (Figma component 47:79, "Auto Fill button"): white with a mint edge, the
 * Minty mark, the label and a sparkle; once filled it turns mint and reads "Revert". Petty Cash
 * Settings and Accounting Setup's account lists (4.3, 4.4) both draw it - change it here.
 */
import Icon from "./Icon";

export default function AutofillButton({
  active,
  onClick,
  disabled = false,
  label,
}: {
  /** Filled: mint, and the label reads "Revert". */
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  /** What a screen reader hears, when the visible word alone isn't enough. */
  label?: string;
}) {
  return (
    <button
      type="button"
      className={"autofill-btn" + (active ? " is-active" : "")}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/autofill-logo.png" alt="" className="autofill-logo" />
      <span className="autofill-label">{active ? "Revert" : "Auto Fill"}</span>
      <span className="autofill-spark" aria-hidden>
        <Icon.Sparkle />
      </span>
    </button>
  );
}
