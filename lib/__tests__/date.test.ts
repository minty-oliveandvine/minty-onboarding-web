// lib/date's toIsoDate (the local-vs-UTC calendar day) and the shared day format the flow
// shows.
//
// `toIsoDate` was written out four separate times across three components before it
// was consolidated here (twice inside the same function, 71 lines apart), so the
// point of these tests is to pin the behaviour that consolidation settled on.

import { afterEach, describe, expect, it } from "vitest";
import { formatDay, formatInstantDay, todayIso } from "@minty/shared/dates";
import { toIsoDate } from "../date";

/** Run `fn` as if the machine were in `tz`. Node re-reads process.env.TZ on change. */
function withTz(tz: string, fn: () => void) {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    // Deleting rather than assigning undefined: `process.env.TZ = undefined` stores
    // the STRING "undefined", which Node then fails to parse and falls back to UTC --
    // so a restore bug here would silently move every later test's timezone.
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

describe("the day format the flow shows (@minty/shared/dates)", () => {
  // owner 2026-10-21: one shared module (@minty/shared/dates). lib/date's formatDate and
  // formatToday are gone: the flow's dates (Xero "Last connected", the trial end) are
  // formatDay / formatInstantDay. Was "12 SEP 2026" (an upper-case month, today in the
  // browser's zone) and, for the trial end, "1 Sep 2026" in the browser's zone.

  it('writes "12 Sep 2026": a two-digit day and a three-letter, title-case month', () => {
    expect(formatDay("2026-09-12")).toBe("12 Sep 2026");
    expect(formatDay("2026-09-01")).toBe("01 Sep 2026");
    expect(formatDay("2026-06-12")).toBe("12 Jun 2026");
  });

  it('gives every month exactly three letters (never "Sept")', () => {
    for (let m = 1; m <= 12; m += 1) {
      const out = formatDay(`2026-${String(m).padStart(2, "0")}-01`);
      expect(out, `month ${m}`).toMatch(/^01 [A-Z][a-z]{2} 2026$/);
    }
  });

  it("reads an instant's day in Hong Kong, not the browser's zone", () => {
    // 2026-09-12 20:00 UTC is already 13 September in Hong Kong.
    expect(formatInstantDay(new Date(Date.UTC(2026, 8, 12, 20, 0)))).toBe("13 Sep 2026");
    // A date-only trial end parses as UTC midnight: the same day in Hong Kong.
    expect(formatInstantDay(new Date("2026-11-21"))).toBe("21 Nov 2026");
  });

  it("formats today as Hong Kong's day", () => {
    expect(formatDay(todayIso())).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4}$/);
    expect(todayIso()).toBe(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(new Date()),
    );
  });

  it("shows nothing for an unreadable value", () => {
    expect(formatDay("not a date")).toBe("");
    expect(formatInstantDay(new Date("nonsense"))).toBe("");
  });
});

describe("toIsoDate", () => {
  it("pads single-digit months and days", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toIsoDate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("accepts a parseable string as well as a Date", () => {
    expect(toIsoDate("2026-06-12T10:00:00")).toBe("2026-06-12");
  });

  it("returns an empty string for an unparseable value", () => {
    // The wizard renders the result straight into a date input, so the failure mode
    // has to be an empty field rather than the literal text "Invalid Date".
    expect(toIsoDate("not a date")).toBe("");
    expect(toIsoDate(new Date("nonsense"))).toBe("");
  });

  it("handles a leap day", () => {
    expect(toIsoDate(new Date(2028, 1, 29))).toBe("2028-02-29");
  });

  describe("reads the calendar day LOCALLY, not in UTC", () => {
    // This is the bug the function exists to avoid, and it is invisible on a machine
    // running in UTC -- so both directions are forced here rather than trusting
    // whatever timezone the test happened to run in.
    afterEach(() => {
      expect(process.env.TZ === undefined || typeof process.env.TZ === "string").toBe(true);
    });

    it("east of Greenwich: an early-morning date does not roll BACK a day", () => {
      withTz("Asia/Hong_Kong", () => {
        const d = new Date(2026, 5, 12, 0, 30); // 12 June, 00:30 local (= 11 June UTC)
        expect(d.toISOString().slice(0, 10)).toBe("2026-06-11"); // the wrong answer
        expect(toIsoDate(d)).toBe("2026-06-12"); // the right one
      });
    });

    it("west of Greenwich: a late-evening date does not roll FORWARD a day", () => {
      withTz("America/New_York", () => {
        const d = new Date(2026, 5, 12, 23, 30); // 12 June, 23:30 local (= 13 June UTC)
        expect(d.toISOString().slice(0, 10)).toBe("2026-06-13"); // the wrong answer
        expect(toIsoDate(d)).toBe("2026-06-12"); // the right one
      });
    });

    it("survives a DST spring-forward boundary", () => {
      withTz("America/New_York", () => {
        // 2026-03-08 is the US spring-forward date; 02:00 does not exist locally and
        // the Date constructor normalises it to 03:00. The calendar day is unchanged,
        // which is what the wizard cares about.
        expect(toIsoDate(new Date(2026, 2, 8, 2, 0))).toBe("2026-03-08");
        expect(toIsoDate(new Date(2026, 10, 1, 1, 30))).toBe("2026-11-01");
      });
    });
  });
});
