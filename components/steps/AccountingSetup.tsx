"use client";

// Step 4 - Accounting Setup (Xero optional; Figma LGkVZqcyxSIh6pp5ihDjXw node 348:1007), drawn in
// this branch's classic look. 4.1 asks how Minty keeps the books. With Xero, the next screen is
// today's Connect to Xero (X1, StepConnectXero) and the wizard goes on as before. On its own: the
// business type and the cash question (4.2), the sales and expense accounts with Auto Fill (4.3,
// 4.4) and, with Petty Cash, the five accounts daily closing needs (4.5). Every change is saved as
// it is made (minty-onboarding-api's /accounting routes), so Save & Next only moves on.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AutofillButton from "../AutofillButton";
import Icon from "../Icon";
import MintySelect from "../MintySelect";
import { ModalFrame } from "../ModalFrame";
import { StepConnectXero } from "../OnboardingSteps";
import { useToast } from "../Toast";
import { ErrorSummary, type SummaryItem } from "./ErrorSummary";
import { SaveExitLink } from "./StepChrome";
import {
  accountingApi,
  type Account,
  type AccountInput,
  type AccountingSetup as Setup,
  type AccountKind,
  type Answer,
  type SlotRole,
  type Suggestion,
} from "../../lib/accountingApi";
import { accountingOf } from "../../lib/wizardSteps";
import type { BusinessType, StepProps } from "../../lib/types";

type Sub = "mode" | "xero" | "xsales" | "xexpense" | "business" | "sales" | "expense" | "closing";

type Props = Pick<
  StepProps,
  | "state"
  | "set"
  | "next"
  | "back"
  | "token"
  | "saveAndExit"
  | "connectXero"
  | "disconnectXero"
  | "xeroMismatch"
  | "clearXeroMismatch"
  | "xeroChoose"
  | "clearXeroChoose"
  | "xeroConflict"
  | "clearXeroConflict"
  | "releaseXeroConflict"
>;

const BUSINESSES: { value: BusinessType; title: string; body: string }[] = [
  {
    value: "fnb",
    title: "Restaurant & Food",
    body: "Cafés, restaurants, bakeries and other food & beverage businesses.",
  },
  {
    value: "retail",
    title: "Retail shop",
    body: "Shops, boutiques, convenience stores and online shops.",
  },
  {
    value: "service",
    title: "Service business",
    body: "Professional services, agencies, clinics and salons.",
  },
  {
    value: "general",
    title: "General business",
    body: "A standard set of accounts that fits most businesses.",
  },
];
const BUSINESS_WORDS: Record<string, string> = {
  fnb: "Restaurant & Food",
  retail: "Retail shop",
  service: "Service business",
  general: "General business",
};
const CASH_CHOICES: { value: "with" | "without" | "unsure"; title: string; body: string }[] = [
  {
    value: "with",
    title: "We pay expenses from sales cash",
    body: "Cash taken at the till pays for small expenses.",
  },
  {
    value: "without",
    title: "We bank all sales",
    body: "Every sale goes to the bank, and a separate petty cash float pays for expenses.",
  },
  {
    value: "unsure",
    title: "Not sure",
    body: "Minty starts as if you pay from sales cash. You can change it later.",
  },
];
const KIND_TYPES: Record<AccountKind, string[]> = {
  sales: ["sales", "revenue", "other_income"],
  expense: ["expense", "direct_costs", "overheads"], // the form starts on Expense
};
const SLOTS: { role: SlotRole; title: string; body: string }[] = [
  {
    role: "petty_cash",
    title: "Petty cash",
    body: "The cash drawer or float you count at closing.",
  },
  { role: "bank", title: "Bank you deposit into", body: "Where cash goes when you bank it." },
  { role: "cash_sale", title: "Cash sales", body: "Cash taken from customers at the till." },
  {
    role: "discrepancy",
    title: "Cash difference",
    body: "When the cash you count doesn't match what Minty expects.",
  },
  {
    role: "director",
    title: "Paid personally",
    body: "When an owner or director pays for the business out of pocket.",
  },
];
/** The heading over a slot's accounts in its menu (4.5a). */
const SLOT_HEADING: Record<SlotRole, string> = {
  petty_cash: "Bank accounts",
  bank: "Bank accounts",
  cash_sale: "Sales accounts",
  discrepancy: "Expense accounts",
  director: "Liability accounts",
};
const SLOT_TYPES: Record<SlotRole, string[]> = {
  petty_cash: ["bank"],
  bank: ["bank"],
  cash_sale: KIND_TYPES.sales,
  discrepancy: KIND_TYPES.expense,
  director: ["current_liability", "liability", "term_liability", "current", "noncurrent"],
};
const CODE_MAX = 10;
const NAME_MAX = 80;

/** What the list screens draw in the standalone prototype (no company): nothing yet. */
const EMPTY_SETUP: Setup = {
  mode: "minty",
  business_type: null,
  uses_sales_cash: true,
  business_answered: true,
  connected: false,
  accounts: { sales: [], expense: [] },
  slots: {
    petty_cash: { account: null, options: [] },
    bank: { account: null, options: [] },
    cash_sale: { account: null, options: [] },
    discrepancy: { account: null, options: [] },
    director: { account: null, options: [] },
  },
  slots_ready: 0,
  next_code: {},
  types: [],
};

const without = (fields: Record<string, string>, key: string) =>
  Object.fromEntries(Object.entries(fields).filter(([k]) => k !== key));
const label = (a: Account) => (a.code ? `${a.code} · ${a.name}` : a.name);

function firstSub(state: Props["state"]): Sub {
  const a = accountingOf(state);
  if (state.xero.connected || a.mode === "xero") return a.mode ? "xero" : "mode";
  if (a.mode !== "minty") return "mode";
  return a.usesSalesCash === null ? "business" : "sales";
}

export function StepAccountingSetup(props: Props) {
  const { state, set, next, back, token, saveAndExit } = props;
  const entityId = state.entity.id || "";
  const accounting = accountingOf(state);
  const hasPetty = state.modules.includes("pettyCash");
  const toast = useToast();
  const [sub, setSub] = useState<Sub>(() => firstSub(state));
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loadError, setLoadError] = useState("");

  const xeroPath = accounting.mode === "xero";
  const subs: Sub[] = useMemo(
    () => [
      ...((xeroPath
        ? ["mode", "xero", "xsales", "xexpense"]
        : ["mode", "business", "sales", "expense"]) as Sub[]),
      ...(hasPetty ? (["closing"] as Sub[]) : []),
    ],
    [hasPetty, xeroPath],
  );

  const reload = useCallback(async () => {
    if (!token || !entityId) return;
    const answer = await accountingApi.setup(token, entityId);
    if (!answer.ok) {
      setLoadError(answer.error);
      return;
    }
    setLoadError("");
    setSetup(answer);
  }, [token, entityId]);

  // The lists load when a list screen opens; changes reload through `reload`.
  useEffect(() => {
    if (!["sales", "expense", "xsales", "xexpense", "closing"].includes(sub) || !token || !entityId)
      return;
    let live = true;
    accountingApi.setup(token, entityId).then((answer) => {
      if (!live) return;
      if (answer.ok) {
        setLoadError("");
        setSetup(answer);
      } else setLoadError(answer.error);
    });
    return () => {
      live = false;
    };
  }, [sub, token, entityId]);

  const remember = (patch: Partial<typeof accounting>) =>
    set((prev) => ({ accounting: { ...accountingOf(prev), ...patch } }));

  const go = (to: Sub) => {
    setSub(to);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const forward = () => {
    const i = subs.indexOf(sub);
    if (i >= 0 && i < subs.length - 1) go(subs[i + 1]);
    else next();
  };
  const backward = () => {
    if (sub === "mode") return back();
    if (sub === "xero") return go("mode");
    const i = subs.indexOf(sub);
    go(i > 0 ? subs[i - 1] : "mode");
  };

  if (sub === "xero") {
    return (
      <StepConnectXero
        state={state}
        // Connected: on to X2, the Xero accounts Minty uses; not yet: the wizard goes on, as before.
        next={() => (state.xero.connected ? go("xsales") : next())}
        back={() => go("mode")}
        connectXero={props.connectXero}
        disconnectXero={props.disconnectXero}
        xeroMismatch={props.xeroMismatch}
        clearXeroMismatch={props.clearXeroMismatch}
        xeroChoose={props.xeroChoose}
        clearXeroChoose={props.clearXeroChoose}
        xeroConflict={props.xeroConflict}
        clearXeroConflict={props.clearXeroConflict}
        releaseXeroConflict={props.releaseXeroConflict}
        saveAndExit={saveAndExit}
      />
    );
  }

  const position = subs.indexOf(sub) + 1;
  const kicker = `Accounting setup · ${position} of ${subs.length}`;
  const nav = (onNext: () => void, busy = false) => (
    <div className="step-nav">
      <button className="btn btn-ghost" onClick={backward}>
        <Icon.ArrowLeft /> Back
      </button>
      <div className="step-actions">
        <SaveExitLink saveAndExit={saveAndExit} disabled={busy} />
        <button className="btn btn-primary" onClick={onNext} disabled={busy}>
          {busy ? (
            "Saving…"
          ) : (
            <>
              Save &amp; Next <Icon.Arrow />
            </>
          )}
        </button>
      </div>
    </div>
  );

  if (sub === "mode") {
    return (
      <ModeScreen
        kicker={kicker}
        initial={accounting.mode}
        connected={state.xero.connected}
        nav={nav}
        onSave={async (mode) => {
          const answer = entityId
            ? await accountingApi.setMode(token, entityId, mode)
            : ({ ok: true } as const);
          if (!answer.ok) {
            toast.error(answer.error);
            return;
          }
          remember({ mode });
          go(mode === "xero" ? "xero" : "business");
        }}
      />
    );
  }
  if (sub === "business") {
    return (
      <BusinessScreen
        kicker={kicker}
        initial={accounting}
        nav={nav}
        onSave={async (businessType, usesSalesCash) => {
          const answer = entityId
            ? await accountingApi.setBusiness(token, entityId, businessType, usesSalesCash)
            : ({ ok: true } as const);
          if (!answer.ok) {
            toast.error(answer.error);
            return false;
          }
          remember({ businessType, usesSalesCash });
          forward();
          return true;
        }}
      />
    );
  }
  const view = entityId ? setup : EMPTY_SETUP;
  if (!view) {
    return (
      <div className="acs" aria-busy={!loadError}>
        <p className="acs-kicker">{kicker}</p>
        {loadError ? (
          <div className="acs-banner is-warn" role="alert">
            <p>{loadError}</p>
            <button type="button" className="btn btn-ghost" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        ) : (
          <p className="acs-loading">Loading your accounts…</p>
        )}
        {nav(() => {}, true)}
      </div>
    );
  }
  const refreshXero = async () => {
    const answer = await accountingApi.refreshXero(token, entityId);
    if (!answer.ok) {
      toast.error(answer.error);
      return;
    }
    setSetup(answer);
    toast.success("Your accounts are up to date with Xero.");
  };
  if (sub === "xsales" || sub === "xexpense") {
    return (
      <XeroAccountsScreen
        key={sub}
        kind={sub === "xsales" ? "sales" : "expense"}
        kicker={kicker}
        setup={view}
        nav={nav}
        onRefresh={refreshXero}
        onSave={async (ids) => {
          const answer = await accountingApi.xeroTicks(
            token,
            entityId,
            sub === "xsales" ? "sales" : "expense",
            ids,
          );
          if (!answer.ok) return answer.error;
          setSetup(answer);
          forward();
          return null;
        }}
      />
    );
  }
  if (sub === "sales" || sub === "expense") {
    return (
      <AccountsScreen
        key={sub}
        kind={sub}
        kicker={kicker}
        setup={view}
        token={token}
        entityId={entityId}
        businessType={accounting.businessType}
        reload={reload}
        nav={() => nav(forward)}
      />
    );
  }
  return (
    <ClosingScreen
      kicker={kicker}
      xero={xeroPath}
      onRefresh={refreshXero}
      setup={view}
      token={token}
      entityId={entityId}
      reload={reload}
      nav={nav}
      onDone={next}
    />
  );
}

// ---- 4.1 ----------------------------------------------------------------------------------------

function ModeScreen({
  kicker,
  initial,
  connected,
  nav,
  onSave,
}: {
  kicker: string;
  initial: "minty" | "xero" | null;
  connected: boolean;
  nav: (onNext: () => void, busy?: boolean) => React.ReactNode;
  onSave: (mode: "minty" | "xero") => Promise<void>;
}) {
  const [mode, setMode] = useState<"minty" | "xero" | null>(initial ?? (connected ? "xero" : null));
  const [refused, setRefused] = useState(false);
  const [saving, setSaving] = useState(false);
  // Each card's picture is its own crop of one artwork sheet, as the design places it (Figma
  // 348:1018): a fixed box, the sheet sized and offset inside it.
  const choices = [
    {
      value: "minty" as const,
      title: "Use Minty independently",
      body: "Record and manage your books directly in Minty.",
      art: "is-minty",
    },
    {
      value: "xero" as const,
      title: "Connect with Xero",
      body: "Automatically send your records to Xero and keep your books up to date there.",
      art: "is-xero",
    },
  ];
  return (
    <div className="acs acs-mode">
      <div className="page-head acs-head acs-mode-head">
        <p className="acs-kicker">{kicker}</p>
        <h2 id="acs-mode-title">How would you like Minty to work?</h2>
        <p>Choose how Minty keeps your books.</p>
      </div>
      <div
        className="acs-mode-grid"
        role="radiogroup"
        aria-labelledby="acs-mode-title"
        aria-required
      >
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={mode === c.value}
            className={"acs-mode-card" + (mode === c.value ? " is-on" : "")}
            onClick={() => {
              setMode(c.value);
              setRefused(false);
            }}
          >
            <span className="acs-mode-art" aria-hidden>
              <span className={"acs-mode-crop " + c.art}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/accounting/mode-art.jpg" alt="" />
              </span>
            </span>
            <span className="acs-mode-title">{c.title}</span>
            <span className="acs-mode-body">{c.body}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="acs-mode-radio"
              src={mode === c.value ? "/accounting/radio-on.svg" : "/accounting/radio-off.svg"}
              width={24}
              height={24}
              alt=""
              aria-hidden
            />
          </button>
        ))}
      </div>
      {refused && !mode && (
        <p className="field-required" role="alert">
          Choose how Minty should work to continue.
        </p>
      )}
      <p className="acs-note acs-mode-note">
        Not sure? Start with Minty only — you can connect Xero later in Settings.
      </p>
      {nav(async () => {
        if (!mode) {
          setRefused(true);
          return;
        }
        setSaving(true);
        await onSave(mode);
        setSaving(false);
      }, saving)}
    </div>
  );
}

// ---- 4.2 ----------------------------------------------------------------------------------------

function BusinessScreen({
  kicker,
  initial,
  nav,
  onSave,
}: {
  kicker: string;
  initial: { businessType: BusinessType | null; usesSalesCash: boolean | null };
  nav: (onNext: () => void, busy?: boolean) => React.ReactNode;
  onSave: (businessType: BusinessType | null, usesSalesCash: boolean) => Promise<boolean>;
}) {
  const answered = initial.usesSalesCash !== null;
  const [business, setBusiness] = useState<BusinessType | "none" | "">(
    answered ? (initial.businessType ?? "none") : "",
  );
  const [cash, setCash] = useState<"with" | "without" | "unsure" | "">(
    answered ? (initial.usesSalesCash ? "with" : "without") : "",
  );
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);

  const problems: SummaryItem[] = [
    ...(business
      ? []
      : [
          {
            fieldId: "acs-business",
            message: "Choose what best describes your business to continue.",
          },
        ]),
    ...(cash
      ? []
      : [{ fieldId: "acs-cash", message: "Choose how you handle cash sales to continue." }]),
  ];
  const shown = attempt > 0 ? problems : [];
  const messageFor = (id: string) => shown.find((p) => p.fieldId === id)?.message;

  const save = async () => {
    if (problems.length) {
      setAttempt((a) => a + 1);
      if (problems.length === 1) document.getElementById(problems[0].fieldId)?.focus();
      return;
    }
    setSaving(true);
    const ok = await onSave(
      business === "none" ? null : (business as BusinessType),
      cash !== "without",
    );
    if (!ok) setSaving(false);
  };

  return (
    <div className="acs acs-business">
      <div className="page-head acs-head acs-mode-head">
        <p className="acs-kicker">{kicker}</p>
        <h2>What best describes your business?</h2>
        <p>
          We&apos;ll suggest accounts that fit your industry on the next two screens. Nothing is
          added until you press Auto Fill there.
        </p>
      </div>
      <ErrorSummary items={shown} attempt={attempt} />

      {/* Figma 348:1135: a picture card per business type, the heading asks the question */}
      <fieldset className={"acs-fieldset" + (messageFor("acs-business") ? " field-error" : "")}>
        <legend className="sr-only">Business type (required)</legend>
        <div
          id="acs-business"
          tabIndex={-1}
          className="acs-biz-grid"
          role="radiogroup"
          aria-label="Business type"
          aria-required
          aria-invalid={!!messageFor("acs-business")}
          aria-describedby={messageFor("acs-business") ? "acs-business-error" : undefined}
        >
          {BUSINESSES.map((b) => {
            const on = business === b.value;
            return (
              <button
                key={b.value}
                type="button"
                role="radio"
                aria-checked={on}
                className={`acs-biz is-${b.value}` + (on ? " is-on" : "")}
                onClick={() => setBusiness(b.value)}
              >
                <span className="acs-biz-art" aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/accounting/business-${b.value}.png`} alt="" />
                </span>
                <span className="acs-biz-text">
                  <span className="acs-biz-title-row">
                    <span className="acs-biz-icon" aria-hidden>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/accounting/glyph-${b.value}.svg`} width={25} height={25} alt="" />
                    </span>
                    <span className="acs-biz-title">{b.title}</span>
                  </span>
                  <span className="acs-biz-body">{b.body}</span>
                  <span className="acs-biz-go" aria-hidden>
                    {on ? (
                      <Icon.CheckSm width={18} height={18} />
                    ) : (
                      <Icon.Arrow width={18} height={18} />
                    )}
                  </span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={business === "none"}
            className={"acs-biz is-none" + (business === "none" ? " is-on" : "")}
            onClick={() => setBusiness("none")}
          >
            <span className="acs-biz-text">
              <span className="acs-biz-title">
                None of these — I&apos;ll set up my own accounts
              </span>
              <span className="acs-biz-body">
                No suggestions. The account lists on the next screens start empty.
              </span>
            </span>
            <span className="acs-biz-go" aria-hidden>
              {business === "none" ? (
                <Icon.CheckSm width={18} height={18} />
              ) : (
                <Icon.Arrow width={18} height={18} />
              )}
            </span>
          </button>
        </div>
        {messageFor("acs-business") && (
          <div className="field-required" id="acs-business-error">
            {messageFor("acs-business")}
          </div>
        )}
      </fieldset>

      <fieldset className={"acs-fieldset" + (messageFor("acs-cash") ? " field-error" : "")}>
        <legend className="acs-legend">
          How do you handle cash from sales?
          <span className="req" aria-hidden>
            *
          </span>
          <span className="sr-only"> (required)</span>
        </legend>
        <div
          id="acs-cash"
          tabIndex={-1}
          className="acs-choice-grid is-cash"
          role="radiogroup"
          aria-label="How do you handle cash from sales?"
          aria-required
          aria-invalid={!!messageFor("acs-cash")}
          aria-describedby={messageFor("acs-cash") ? "acs-cash-error" : undefined}
        >
          {CASH_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={cash === c.value}
              className={"acs-choice is-compact" + (cash === c.value ? " is-on" : "")}
              onClick={() => setCash(c.value)}
            >
              <span className="acs-choice-title">{c.title}</span>
              <span className="acs-choice-body">{c.body}</span>
              <span className="acs-radio" aria-hidden />
            </button>
          ))}
        </div>
        {messageFor("acs-cash") && (
          <div className="field-required" id="acs-cash-error">
            {messageFor("acs-cash")}
          </div>
        )}
      </fieldset>
      <p className="acs-note">
        You can change your business type or any account anytime in Settings.
      </p>
      {nav(save, saving)}
    </div>
  );
}

// ---- one account's form (4.3b, 4.4a, 4.5a) --------------------------------------------------------

function AccountForm({
  idPrefix,
  title,
  types,
  typeLabels,
  nextCode,
  initial,
  submitLabel,
  onCancel,
  onSave,
}: {
  idPrefix: string;
  title: string;
  types: string[];
  typeLabels: Record<string, string>;
  nextCode: Record<string, string>;
  initial?: AccountInput;
  submitLabel: string;
  onCancel: () => void;
  onSave: (input: AccountInput) => Promise<Answer<object>>;
}) {
  const startType = initial?.type && types.includes(initial.type) ? initial.type : types[0];
  const [type, setType] = useState(startType);
  const [code, setCode] = useState(initial?.code ?? nextCode[startType] ?? "");
  const [codeTouched, setCodeTouched] = useState(!!initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [attempt, setAttempt] = useState(0);
  const [server, setServer] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initial) nameRef.current?.focus();
  }, [initial]);

  // Checked as you type: shape and length. Empty waits for a refused save.
  const live: Record<string, string> = {};
  if (code.length > CODE_MAX)
    live.code = `The code can be up to ${CODE_MAX} characters. Shorten it to continue.`;
  else if (code && !/^[A-Za-z0-9.-]+$/.test(code))
    live.code = "The code can use letters, numbers, dots and dashes. Remove the other characters.";
  if (name.trim().length > NAME_MAX)
    live.name = `The name can be up to ${NAME_MAX} characters. Shorten it to continue.`;
  const empty: Record<string, string> = {};
  if (!code.trim() && type !== "bank")
    empty.code = "The code is still empty. Add a code to continue.";
  if (!name.trim()) empty.name = "The name is still empty. Add a name to continue.";
  const messages = { ...(attempt > 0 ? empty : {}), ...live, ...server };

  const fieldId = (f: string) => `${idPrefix}-${f}`;
  const summary: SummaryItem[] = Object.entries(messages).map(([f, m]) => ({
    fieldId: fieldId(f),
    message: m,
  }));

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const problems = { ...empty, ...live };
    if (Object.keys(problems).length) {
      setAttempt((a) => a + 1);
      if (Object.keys(problems).length === 1)
        document.getElementById(fieldId(Object.keys(problems)[0]))?.focus();
      return;
    }
    setSaving(true);
    const answer = await onSave({ code: code.trim(), name: name.trim(), type });
    setSaving(false);
    if (!answer.ok) {
      setServer(answer.fields);
      setAttempt((a) => a + 1);
      const first = Object.keys(answer.fields)[0];
      if (first) document.getElementById(fieldId(first))?.focus();
    }
  };

  return (
    <form className="acs-form" onSubmit={submit} noValidate>
      <p className="acs-form-title">{title}</p>
      <ErrorSummary items={summary} attempt={attempt} />
      <div className="acs-form-row">
        <div className={"field" + (messages.code ? " field-error" : "")}>
          <label htmlFor={fieldId("code")}>
            Code
            {type !== "bank" && (
              <>
                <span className="req" aria-hidden>
                  *
                </span>
                <span className="sr-only"> (required)</span>
              </>
            )}
          </label>
          <input
            id={fieldId("code")}
            type="text"
            inputMode="text"
            autoComplete="off"
            value={code}
            aria-required={type !== "bank"}
            aria-invalid={!!messages.code}
            aria-describedby={messages.code ? fieldId("code-error") : fieldId("code-hint")}
            onChange={(e) => {
              setCode(e.target.value);
              setCodeTouched(true);
              setServer((f) => without(f, "code"));
            }}
          />
          {messages.code ? (
            <div className="field-required" id={fieldId("code-error")}>
              {messages.code}
            </div>
          ) : (
            !initial &&
            nextCode[type] && (
              <p className="acs-hint" id={fieldId("code-hint")}>
                {nextCode[type]} is the next free code for {typeLabels[type] || "this type"}. You
                can change it.
              </p>
            )
          )}
        </div>
        <div className="field">
          <label htmlFor={fieldId("type")}>Type</label>
          <MintySelect
            id={fieldId("type")}
            value={type}
            options={types.map((t) => ({ value: t, label: typeLabels[t] || t }))}
            onChange={(t) => {
              setType(t);
              if (!codeTouched) setCode(nextCode[t] ?? "");
              setServer((f) => without(f, "type"));
            }}
          />
        </div>
      </div>
      <div className={"field" + (messages.name ? " field-error" : "")}>
        <label htmlFor={fieldId("name")}>
          Name
          <span className="req" aria-hidden>
            *
          </span>
          <span className="sr-only"> (required)</span>
        </label>
        <input
          ref={nameRef}
          id={fieldId("name")}
          type="text"
          autoComplete="off"
          placeholder="e.g. Catering orders"
          value={name}
          aria-required
          aria-invalid={!!messages.name}
          aria-describedby={messages.name ? fieldId("name-error") : undefined}
          onChange={(e) => {
            setName(e.target.value);
            setServer((f) => without(f, "name"));
          }}
        />
        {messages.name && (
          <div className="field-required" id={fieldId("name-error")}>
            {messages.name}
          </div>
        )}
      </div>
      <div className="acs-form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---- 4.3 and 4.4 ------------------------------------------------------------------------------------

// 4.3's row icon (Figma 348:1209 draws three): delivery by name, other income by type or name,
// every other sales account the shop bag.
const salesGlyph = (name: string, type: string) =>
  /deliver/i.test(name)
    ? "delivery"
    : type === "other_income" || /\bother\b/i.test(name)
      ? "other-income"
      : "sales";

// 4.4's card icon (Figma 348:1267 draws ten), by the account's name; a cost-of-sales account that
// matches none is "products", anything else "other".
const EXPENSE_GLYPHS: [string, RegExp][] = [
  ["packaging", /packag|\bbags?\b|\bbox|container/i],
  ["staff", /staff|salar|wage|mpf|payroll|employee/i],
  ["rent", /\brent|premis|lease/i],
  ["utilities", /utilit|electric|water|\bgas\b|power|light|phone|internet/i],
  ["cleaning", /clean/i],
  ["repairs", /repair|mainten/i],
  ["delivery", /deliver|courier|freight|postage|transport/i],
  ["marketing", /market|advert|promot/i],
  ["products", /product|stock|suppl|purchase|goods|ingredient|food/i],
];
const expenseGlyph = (name: string, type: string) =>
  EXPENSE_GLYPHS.find(([, re]) => re.test(name))?.[0] ??
  (type === "direct_costs" ? "products" : "other");

/** A row's menu: Edit and Remove. Closes on Escape, on a pick, or on a click elsewhere. */
function RowMenu({
  name,
  disabled,
  onEdit,
  onRemove,
}: {
  name: string;
  disabled: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="acs-menu" ref={ref}>
      <button
        type="button"
        className="acs-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More for ${name}`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/accounting/more.svg" width={16} height={18} alt="" />
      </button>
      {open && (
        <div className="acs-menu-list" role="menu">
          <button type="button" role="menuitem" onClick={pick(onEdit)}>
            Edit
          </button>
          <button type="button" role="menuitem" onClick={pick(onRemove)}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function AccountsScreen({
  kind,
  kicker,
  setup,
  token,
  entityId,
  businessType,
  reload,
  nav,
}: {
  kind: AccountKind;
  kicker: string;
  setup: Setup;
  token: string;
  entityId: string;
  businessType: BusinessType | null;
  reload: () => Promise<void>;
  nav: () => React.ReactNode;
}) {
  const toast = useToast();
  const accounts = setup.accounts[kind];
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const filled =
    accounts.some((a) => a.source === "template") ||
    (suggestions !== null && suggestions.length > 0);
  const basedOn = BUSINESS_WORDS[businessType || "general"];
  const typeLabels = Object.fromEntries(setup.types.map((t) => [t.value, t.label]));

  // Once the list has Auto Fill rows, the template's other suggestions show unticked beside them.
  useEffect(() => {
    if (suggestions !== null || !accounts.some((a) => a.source === "template")) return;
    void accountingApi
      .suggestions(token, entityId, kind)
      .then((a) => a.ok && setSuggestions(a.options));
  }, [accounts, suggestions, token, entityId, kind]);

  const autoFill = async () => {
    setBusy(true);
    const offer = await accountingApi.suggestions(token, entityId, kind);
    if (!offer.ok) {
      setBusy(false);
      toast.error(offer.error);
      return;
    }
    if (offer.options.length === 0) {
      setBusy(false);
      toast.info("There are no suggestions for this business yet. Add your own accounts instead.");
      return;
    }
    const chosen = offer.options.filter((o) => o.ticked && !o.added).map((o) => o.template_id);
    const added = chosen.length
      ? await accountingApi.autofill(token, entityId, kind, chosen)
      : null;
    if (added && !added.ok) toast.error(added.error);
    setSuggestions(offer.options);
    await reload();
    setBusy(false);
  };

  const revert = async () => {
    setBusy(true);
    const answer = await accountingApi.revert(token, entityId, kind);
    if (!answer.ok) toast.error(answer.error);
    else if (answer.kept.length)
      toast.info(
        `${answer.kept.length} stayed because Minty already uses them: ${answer.kept.map((k) => k.name).join(", ")}.`,
      );
    setSuggestions(null);
    await reload();
    setBusy(false);
  };

  const untick = async (a: Account) => {
    if (a.from_xero) return;
    setBusy(true);
    const answer = await accountingApi.remove(token, entityId, a.id);
    if (!answer.ok) toast.error(answer.error);
    else if (answer.archived)
      toast.info(`${a.name} is kept for the records that use it, and no longer offered.`);
    await reload();
    setBusy(false);
  };

  const tick = async (s: Suggestion) => {
    setBusy(true);
    const answer = await accountingApi.autofill(token, entityId, kind, [s.template_id]);
    if (!answer.ok) toast.error(answer.error);
    await reload();
    setBusy(false);
  };

  const added = new Set(accounts.map((a) => `${a.code}|${a.name.toLowerCase()}`));
  const unticked = (suggestions || []).filter(
    (s) => !added.has(`${s.code}|${s.name.toLowerCase()}`),
  );
  type Item = { key: string; account?: Account; suggestion?: Suggestion; group: Account["group"] };
  const items: Item[] = [
    ...accounts.map((a) => ({ key: a.id, account: a, group: a.group })),
    ...unticked.map((s) => ({ key: s.template_id, suggestion: s, group: s.group })),
  ];
  const groups: { id: string; title: string | null; items: Item[] }[] =
    kind === "sales"
      ? [{ id: "all", title: null, items }].filter((g) => g.items.length > 0)
      : [
          {
            id: "cost_of_sales",
            title: "Cost of what you sell",
            items: items.filter((i) => i.group === "cost_of_sales"),
          },
          {
            id: "running_costs",
            title: "Running the business",
            items: items.filter((i) => i.group !== "cost_of_sales"),
          },
        ].filter((g) => g.items.length > 0);

  const title = kind === "sales" ? "Your sales categories" : "What do you usually spend money on?";
  const lede =
    kind === "sales"
      ? filled
        ? `Based on ${basedOn}. Choose what applies - you can always add, remove or rename these later.`
        : "Press Auto Fill for the usual ones, or add your own."
      : "Choose the categories that apply to your business. Staff pick from these when they add an expense.";
  const noun = kind === "sales" ? "sales category" : "category";

  const sales = kind === "sales";
  return (
    <div className={"acs" + (sales ? " acs-sales" : " acs-expense")}>
      <div className="page-head acs-head acs-mode-head">
        <p className="acs-kicker">{kicker}</p>
        <h2>{title}</h2>
        <p>{lede}</p>
      </div>

      {/* the one Auto Fill button, as Petty Cash Settings draws it */}
      <div className="acs-autofill">
        <AutofillButton active={filled} onClick={filled ? revert : autoFill} disabled={busy} />
        <p className="autofill-hint">
          {filled
            ? `Filled for ${basedOn}. Revert takes the suggestions out again.`
            : `Auto Fill adds the usual ones for ${basedOn}.`}
        </p>
      </div>

      {items.length === 0 && !adding && (
        <div className="acs-empty">
          <p className="acs-empty-title">
            No {kind === "sales" ? "sales categories" : "expense categories"} yet
          </p>
          <p>Auto Fill adds the usual ones. Or add your own, one at a time.</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.id} className="acs-group" aria-label={g.title || title}>
          {g.title && (
            <h3 className="acs-group-title">
              {g.title} <span>({g.items.length})</span>
            </h3>
          )}
          <ul className={sales ? "acs-coa" : "acs-cards"}>
            {g.items.map((it) =>
              it.account && editing === it.account.id ? (
                <li key={it.key} className="acs-row is-editing">
                  <AccountForm
                    idPrefix={`acs-edit-${it.account.id}`}
                    title="Edit account"
                    types={KIND_TYPES[kind]}
                    typeLabels={typeLabels}
                    nextCode={setup.next_code}
                    initial={{
                      code: it.account.code,
                      name: it.account.name,
                      type: it.account.type,
                    }}
                    submitLabel="Save"
                    onCancel={() => setEditing(null)}
                    onSave={async (input) => {
                      const answer = await accountingApi.update(
                        token,
                        entityId,
                        it.account!.id,
                        input,
                      );
                      if (answer.ok) {
                        setEditing(null);
                        await reload();
                      }
                      return answer;
                    }}
                  />
                </li>
              ) : sales ? (
                <li key={it.key} className={"acs-coa-row" + (it.account ? " is-on" : "")}>
                  <span
                    className={
                      "acs-coa-icon is-" +
                      salesGlyph(
                        it.account?.name ?? it.suggestion!.name,
                        it.account?.type ?? it.suggestion!.type,
                      )
                    }
                    aria-hidden
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/accounting/glyph-${salesGlyph(
                        it.account?.name ?? it.suggestion!.name,
                        it.account?.type ?? it.suggestion!.type,
                      )}.svg`}
                      width={34}
                      height={34}
                      alt=""
                    />
                  </span>
                  <label className="acs-coa-main">
                    <span className="acs-coa-text">
                      <span className="acs-coa-name">
                        {it.account?.name ?? it.suggestion!.name}
                      </span>
                      <span className="acs-coa-meta">
                        {[
                          it.account?.code ?? it.suggestion!.code,
                          it.account?.description || it.suggestion?.description,
                        ]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="acs-coa-input"
                      checked={!!it.account}
                      disabled={busy || !!it.account?.from_xero}
                      onChange={() => (it.account ? untick(it.account) : tick(it.suggestion!))}
                    />
                    <span className="acs-coa-check" aria-hidden>
                      {it.account && <Icon.CheckSm width={16} height={16} />}
                    </span>
                  </label>
                  {it.account && !it.account.from_xero ? (
                    <RowMenu
                      name={it.account.name}
                      disabled={busy}
                      onEdit={() => setEditing(it.account!.id)}
                      onRemove={() => untick(it.account!)}
                    />
                  ) : (
                    <span className="acs-menu" aria-hidden />
                  )}
                </li>
              ) : (
                <li key={it.key} className={"acs-exp" + (it.account ? " is-on" : "")}>
                  <label className="acs-exp-main">
                    <span className="acs-exp-top">
                      <span
                        className={
                          "acs-exp-icon is-" +
                          expenseGlyph(
                            it.account?.name ?? it.suggestion!.name,
                            it.account?.type ?? it.suggestion!.type,
                          )
                        }
                        aria-hidden
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/accounting/exp-${expenseGlyph(
                            it.account?.name ?? it.suggestion!.name,
                            it.account?.type ?? it.suggestion!.type,
                          )}.svg`}
                          width={40}
                          height={40}
                          alt=""
                        />
                      </span>
                      <input
                        type="checkbox"
                        className="acs-coa-input"
                        checked={!!it.account}
                        disabled={busy || !!it.account?.from_xero}
                        onChange={() => (it.account ? untick(it.account) : tick(it.suggestion!))}
                      />
                      <span
                        className={"acs-xero-box acs-exp-box" + (it.account ? " is-on" : "")}
                        aria-hidden
                      >
                        {it.account && <Icon.CheckSm width={14} height={14} />}
                      </span>
                    </span>
                    <span className="acs-exp-name">{it.account?.name ?? it.suggestion!.name}</span>
                    {(it.account?.description || it.suggestion?.description) && (
                      <span className="acs-exp-body">
                        {it.account?.description || it.suggestion?.description}
                      </span>
                    )}
                    {(it.account?.code ?? it.suggestion!.code) && (
                      <span className="acs-exp-code">
                        Code {it.account?.code ?? it.suggestion!.code}
                      </span>
                    )}
                  </label>
                  {it.account && !it.account.from_xero && (
                    <RowMenu
                      name={it.account.name}
                      disabled={busy}
                      onEdit={() => setEditing(it.account!.id)}
                      onRemove={() => untick(it.account!)}
                    />
                  )}
                </li>
              ),
            )}
          </ul>
        </section>
      ))}

      {adding ? (
        <AccountForm
          idPrefix={`acs-add-${kind}`}
          title="Add an account"
          types={KIND_TYPES[kind]}
          typeLabels={typeLabels}
          nextCode={setup.next_code}
          submitLabel="Add"
          onCancel={() => setAdding(false)}
          onSave={async (input) => {
            const answer = await accountingApi.create(token, entityId, input);
            if (answer.ok) {
              setAdding(false);
              await reload();
            }
            return answer;
          }}
        />
      ) : (
        <button
          type="button"
          className={"acs-add" + (sales ? " acs-coa-add" : " acs-exp-add")}
          onClick={() => setAdding(true)}
        >
          {sales ? (
            <>
              <span className="acs-coa-plus" aria-hidden>
                +
              </span>
              Add another {noun}
            </>
          ) : (
            <>
              <span className="acs-exp-add-label">+&nbsp;&nbsp;Add another {noun}</span>
              <span className="acs-exp-add-hint">Can&apos;t find what you need? Add it here.</span>
            </>
          )}
        </button>
      )}
      {nav()}
    </div>
  );
}

// ---- 4.5 -------------------------------------------------------------------------------------------

/** "Refresh from Xero" (X2-X4): accounts-api syncs the chart, then the step reads it again. */
function XeroRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="acs-xero-refresh">
      <button
        type="button"
        className="btn-link-center"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onRefresh();
          setBusy(false);
        }}
      >
        {busy ? "Refreshing…" : "Refresh from Xero"}
      </button>
    </div>
  );
}

/** Rows shown before "Show more accounts" (X2, X3); a search shows every match. */
const XERO_VISIBLE = 10;

/** X2 / X3 (Figma 348:1874, 348:1949): tick which of the Xero chart's sales or expense accounts
 * Minty uses. Accounts not ticked stay in Xero; they just aren't offered in Minty. */
function XeroAccountsScreen({
  kind,
  kicker,
  setup,
  nav,
  onRefresh,
  onSave,
}: {
  kind: AccountKind;
  kicker: string;
  setup: Setup;
  nav: (onNext: () => void, busy?: boolean) => React.ReactNode;
  onRefresh: () => Promise<void>;
  /** Saves the ticks; answers the refusal's sentence, or null when saved. */
  onSave: (ids: string[]) => Promise<string | null>;
}) {
  const rows = setup.accounts[kind].filter((a) => a.from_xero);
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(rows.filter((a) => a.used).map((a) => a.id)),
  );
  const [query, setQuery] = useState("");
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const noun = kind === "sales" ? "sales" : "expense";

  const q = query.trim().toLowerCase();
  const matches = q
    ? rows.filter((a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
    : rows;
  const shown = q || more ? matches : matches.slice(0, XERO_VISIBLE);
  const hidden = matches.length - shown.length;

  const toggle = (id: string) => {
    setError("");
    setTicked((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  };

  const save = async () => {
    if (rows.length > 0 && ticked.size === 0) {
      setError(`Tick at least one ${noun} account to continue.`);
      document.getElementById("acs-xero-list")?.focus();
      return;
    }
    setSaving(true);
    const refused = await onSave([...ticked]);
    setSaving(false);
    if (refused) setError(refused);
  };

  return (
    <div className="acs acs-sales acs-xero">
      <div className="page-head acs-head acs-mode-head">
        <p className="acs-kicker">{kicker}</p>
        <h2>Which {noun} accounts should Minty use?</h2>
        <p>
          {kind === "sales"
            ? "These come from your Xero chart of accounts. Tick the ones your daily sales are recorded to."
            : "These come from your Xero chart of accounts. Tick the ones staff pick from when they add an expense."}
        </p>
      </div>
      <XeroRefresh onRefresh={onRefresh} />
      <div className="acs-xero-stack">
        <label className="acs-xero-search">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/accounting/search.svg" width={14} height={14} alt="" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts…"
            aria-label="Search accounts"
          />
        </label>
        {rows.length === 0 ? (
          <p className="acs-xero-empty">
            No {noun} accounts came from Xero yet. Create one in Xero, then press Refresh from Xero.
          </p>
        ) : (
          <ul
            id="acs-xero-list"
            tabIndex={-1}
            className={"acs-xero-list" + (error ? " has-error" : "")}
            aria-label={`Xero ${noun} accounts`}
            aria-describedby={error ? "acs-xero-error" : undefined}
          >
            {shown.map((a) => (
              <li key={a.id}>
                <label className="acs-xero-row">
                  <input
                    type="checkbox"
                    className="acs-coa-input"
                    checked={ticked.has(a.id)}
                    onChange={() => toggle(a.id)}
                  />
                  <span className={"acs-xero-box" + (ticked.has(a.id) ? " is-on" : "")} aria-hidden>
                    {ticked.has(a.id) && <Icon.CheckSm width={13} height={13} />}
                  </span>
                  <span className="acs-xero-code">{a.code}</span>
                  <span className="acs-xero-name">{a.name}</span>
                  {a.type_label && <span className="acs-xero-type">{a.type_label}</span>}
                </label>
              </li>
            ))}
            {q && matches.length === 0 && (
              <li className="acs-xero-none">No account matches &ldquo;{query.trim()}&rdquo;.</li>
            )}
          </ul>
        )}
        {error && (
          <p className="field-required" id="acs-xero-error" role="alert">
            {error}
          </p>
        )}
        {rows.length > 0 && (
          <div className="acs-xero-foot">
            <span>{ticked.size} selected</span>
            {hidden > 0 && (
              <button type="button" className="acs-xero-more" onClick={() => setMore(true)}>
                ⌄ Show more accounts ({hidden})
              </button>
            )}
          </div>
        )}
      </div>
      <div className="acs-notice" role="note">
        <Icon.Info width={18} height={18} />
        <div>
          <p className="acs-notice-title">Missing an account?</p>
          <p>
            Create it in Xero, then come back and press Refresh — it will show up here. Accounts you
            don&apos;t tick stay in Xero; they just won&apos;t appear in Minty.
          </p>
        </div>
      </div>
      {nav(save, saving)}
    </div>
  );
}

/** 4.5a's list under a card's Set up / Change (Figma 348:1767): the accounts of the right type,
 * then "+ Create a new account" (X4: create it in Xero instead). */
function SlotMenu({
  heading,
  options,
  current,
  xero,
  onClose,
  onPick,
  onCreate,
}: {
  heading: string;
  options: Account[];
  current: string | null;
  xero: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  onCreate: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // a tick later, so the click that opened it doesn't close it
    const t = window.setTimeout(() => document.addEventListener("mousedown", away), 0);
    document.addEventListener("keydown", esc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);
  return (
    <div className="acs-slot-pop" ref={ref} role="menu" aria-label={heading}>
      <p className="acs-slot-pop-head">{heading}</p>
      {options.length > 0 ? (
        options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="menuitemradio"
            aria-checked={current === o.id}
            className={"acs-slot-pop-item" + (current === o.id ? " is-on" : "")}
            onClick={() => onPick(o.id)}
          >
            {label(o)}
          </button>
        ))
      ) : (
        <p className="acs-slot-pop-none">No account of the right type yet.</p>
      )}
      {xero ? (
        <p className="acs-slot-pop-none is-foot">
          Missing one? Create it in Xero, then press Refresh from Xero.
        </p>
      ) : (
        <button type="button" role="menuitem" className="acs-slot-pop-create" onClick={onCreate}>
          + Create a new account
        </button>
      )}
    </div>
  );
}

function ClosingScreen({
  kicker,
  xero = false,
  onRefresh,
  setup,
  token,
  entityId,
  reload,
  nav,
  onDone,
}: {
  kicker: string;
  /** X4: the accounts come from the Xero chart, and a missing one is made in Xero. */
  xero?: boolean;
  onRefresh?: () => Promise<void>;
  setup: Setup;
  token: string;
  entityId: string;
  reload: () => Promise<void>;
  nav: (onNext: () => void, busy?: boolean) => React.ReactNode;
  onDone: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState<SlotRole | null>(null);
  const [creating, setCreating] = useState<SlotRole | null>(null);
  const [warn, setWarn] = useState(false);
  const typeLabels = Object.fromEntries(setup.types.map((t) => [t.value, t.label]));
  // The roles the API sends: a company that banks all its sales has no cash-sale one.
  const roles = SLOTS.filter((s) => s.role in setup.slots);
  const missing = roles.filter((s) => !setup.slots[s.role].account);
  const ready = roles.length - missing.length;

  const choose = async (role: SlotRole, accountId: string) => {
    const answer = await accountingApi.setSlot(token, entityId, role, accountId);
    if (!answer.ok) toast.error(answer.error);
    setOpen(null);
    await reload();
  };

  const optionsOf = (role: SlotRole) =>
    xero ? setup.slots[role].options.filter((o) => o.from_xero) : setup.slots[role].options;

  return (
    <div className="acs acs-closing">
      <div className="page-head acs-head acs-mode-head">
        <p className="acs-kicker">{kicker}</p>
        <h2>Accounts Minty uses every day</h2>
        <p>
          {xero
            ? "Daily closing needs one Xero account for each of these."
            : "Daily closing needs one account for each of these. Pick one from your list, or create it here."}
        </p>
      </div>
      {xero && onRefresh && <XeroRefresh onRefresh={onRefresh} />}
      {/* Figma 348:1384 (all ready), 348:1674 (4.5a, one missing) */}
      <div className={"acs-ready" + (missing.length ? " is-warn" : "")} role="status">
        <span className="acs-ready-badge" aria-hidden>
          {missing.length ? "!" : "✓"}
        </span>
        <div className="acs-ready-text">
          <p className="acs-ready-title">
            {missing.length === 0
              ? `All ${roles.length}${xero ? " Xero" : ""} accounts are ready for daily closing`
              : ready === 0
                ? `None of the ${roles.length} accounts is set up yet`
                : `${ready} of ${roles.length} accounts ready · ${missing.map((m) => m.title).join(", ")} ${
                    missing.length === 1 ? "has" : "have"
                  } no account yet`}
          </p>
          <p>
            {missing.length === 0
              ? "You can change any of them later in Settings."
              : "You can still continue. Minty asks again before your first daily closing."}
          </p>
        </div>
      </div>
      <ul className="acs-roles">
        {roles.map((s) => {
          const slot = setup.slots[s.role];
          const isOpen = open === s.role;
          const options = optionsOf(s.role);
          return (
            <li key={s.role} className={"acs-role" + (slot.account ? "" : " is-missing")}>
              <div className="acs-role-card">
                <span className={`acs-role-icon is-${s.role}`} aria-hidden>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/accounting/slot-${s.role}.svg`} width={37} height={37} alt="" />
                </span>
                <div className="acs-role-text">
                  <p className="acs-role-title">{s.title}</p>
                  <p className="acs-role-body">{s.body}</p>
                  <p className="acs-role-account">
                    {slot.account
                      ? `${xero ? "Xero" : "Minty"} account: ${label(slot.account)}`
                      : "No account chosen yet"}
                  </p>
                </div>
                <div className="acs-role-side">
                  <span className="acs-role-status">
                    <span className="acs-role-dot" aria-hidden>
                      {slot.account ? <Icon.CheckSm width={11} height={11} /> : "!"}
                    </span>
                    {slot.account ? "Ready" : "Not set up"}
                  </span>
                  <button
                    type="button"
                    className={slot.account ? "acs-role-change" : "acs-role-setup"}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    aria-label={`${slot.account ? "Change" : "Set up"} ${s.title.toLowerCase()}`}
                    onClick={() => {
                      setOpen(isOpen ? null : s.role);
                      setCreating(null);
                    }}
                  >
                    {slot.account ? "Change" : "Set up"}
                  </button>
                </div>
              </div>
              {isOpen && (
                <SlotMenu
                  heading={SLOT_HEADING[s.role]}
                  options={options}
                  current={slot.account?.id ?? null}
                  xero={xero}
                  onClose={() => setOpen(null)}
                  onPick={(id) => void choose(s.role, id)}
                  onCreate={() => {
                    setOpen(null);
                    setCreating(s.role);
                  }}
                />
              )}
              {creating === s.role && (
                <div className="acs-role-create">
                  <AccountForm
                    idPrefix={`acs-slot-new-${s.role}`}
                    title={`New account for ${s.title.toLowerCase()}`}
                    types={SLOT_TYPES[s.role]}
                    typeLabels={typeLabels}
                    nextCode={setup.next_code}
                    submitLabel="Create and use"
                    onCancel={() => setCreating(null)}
                    onSave={async (input) => {
                      const answer = await accountingApi.create(token, entityId, {
                        ...input,
                        role: s.role,
                      });
                      if (answer.ok) {
                        setCreating(null);
                        await reload();
                      }
                      return answer;
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {nav(() => (missing.length ? setWarn(true) : onDone()))}
      {warn && (
        <ModalFrame
          labelledBy="acs-warn-title"
          onDismiss={() => setWarn(false)}
          className="mw-dialog"
        >
          <div className="mw-dialog-head">
            <div className="mw-dialog-head-text">
              <h2 id="acs-warn-title" className="mw-dialog-title">
                {missing.length === 1
                  ? `${missing[0].title} still needs an account`
                  : `${missing.length} accounts for daily closing aren't set up yet`}
              </h2>
            </div>
          </div>
          <p className="mw-dialog-body">
            {`${ready === 0 ? "" : `The other ${ready} ${ready === 1 ? "is" : "are"} ready. `}Add ${
              missing.length === 1 ? "this one" : "them"
            } now, or continue and Minty will ask again before your first daily closing.`}
          </p>
          <div className="mw-dialog-actions">
            <button
              type="button"
              className="mw-dialog-btn is-grey"
              onClick={() => {
                setWarn(false);
                onDone();
              }}
            >
              Continue anyway
            </button>
            <button
              type="button"
              className="mw-dialog-btn is-teal"
              onClick={() => {
                setWarn(false);
                setOpen(missing[0].role);
              }}
            >
              {missing.length === 1 ? "Add it now" : "Add them now"}
            </button>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
