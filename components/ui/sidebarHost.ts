"use client";

/**
 * The ONE app-specific file the packaged sidebar (`@minty/shared/sidebar`) reads of this app -
 * the same host minty-web, minty-payment-request-web and minty-petty-cash-web each write.
 *
 * What differs here:
 *
 * - The token, the company and the person are React state in OnboardingApp, not a cookie. The
 *   wizard hands them over with `setSidebarSession` whenever they change; the host only reads.
 * - No company is reported until "All Set" (step 9). The package draws the module sections and
 *   Settings only inside a company, so through onboarding the menu holds the person, Select
 *   Entity, Manage subscriptions and Logout - the old drawer's "Logout-only until the end" rule,
 *   as far as the shared menu allows (owner, 2026-11-03).
 * - No My Profile sheet (owner, 2026-11-03): Flask's `/api/me/profile` and subscription-api's
 *   `/api/me/subscriptions` do not admit this origin. The person block links to minty-web's, and
 *   the person comes from what the wizard already knows - no read of its own.
 */

import { usePathname } from "next/navigation";

import { moduleClaims } from "@minty/shared/auth";
import { settingsSectionUrl, billsUrl } from "@minty/shared/companyRef";
import { hubHandoffUrl, logoutUrl, mintyEntryUrl } from "@minty/shared/handoff";
import { setSidebarHost, type SidebarHost, type Viewer } from "@minty/shared/sidebar";

import { FLASK_BASE } from "@/lib/flaskBase";

export type SidebarSession = {
  token: string;
  entityId: string;
  entityName: string;
  /** Onboarding is finished ("All Set"): only now is the company the menu's. */
  finished: boolean;
  viewer: Viewer | null;
};

let session: SidebarSession | null = null;

/** OnboardingApp's hand-over; null forgets it. */
export function setSidebarSession(next: SidebarSession | null): void {
  session = next;
}

let navigate = (url: string) => {
  window.location.href = url;
};

/** Test seam: jsdom cannot follow a navigation, so a test watches it instead. Null restores. */
export function _setNavigateForTests(fn: ((url: string) => void) | null): void {
  navigate =
    fn ??
    ((url: string) => {
      window.location.href = url;
    });
}

const companyId = () => (session?.finished ? session.entityId : "");
const companyName = () => (session?.finished ? session.entityName : "");

/** Into Minty for the company with the token the wizard holds; Flask's entity list without one. */
const enter = (next?: string) =>
  mintyEntryUrl({ mintyBase: FLASK_BASE, entityId: companyId(), token: session?.token, next }) ??
  `${FLASK_BASE}/entity`;

export const sidebarHost: SidebarHost = {
  app: "minty-onboarding-web",
  entityId: companyId,
  entityName: companyName,
  moduleAccess: () => moduleClaims(session?.token),
  links: {
    /** Flask's `/entity` - minty-web's entity list - as the wizard's own exit does. */
    entities: () => `${FLASK_BASE}/entity`,
    subscriptions: () => hubHandoffUrl(FLASK_BASE, "/subscription", companyId()),
    pettyCashDashboard: () => enter(),
    pettyCashReports: (id) => enter(`/entity/${id}/petty-cash/reports`),
    bills: () => (companyId() ? billsUrl(FLASK_BASE, companyId()) : `${FLASK_BASE}/entity`),
    /** This app has no settings page: minty-web's module settings for the new company. */
    settings: () =>
      companyId()
        ? settingsSectionUrl(FLASK_BASE, companyId(), companyName(), "modules")
        : `${FLASK_BASE}/entity`,
  },
  usePathname: () => usePathname() ?? "",
  /** The wizard is one page, and none of the menu's items is it. */
  currentOf: () => null,
  lockScroll: () => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  },
  /** Flask's `/logout` ends the session everywhere, as the old drawer's Logout did. */
  logOut: (onLeaving) => {
    onLeaving?.();
    session = null;
    navigate(logoutUrl(FLASK_BASE));
  },
  currentToken: () => session?.token ?? "",
  loadViewer: async () => session?.viewer ?? null,
};

setSidebarHost(sidebarHost);
