// What /auth hands /auth/confirm: the email the code went to, the invite token, the names,
// and the Terms answer.
//
// It used to travel in /auth/confirm's query string (?invite=&email=&fn=&ln=&ta=&tv=), so
// the invite token - a secret that joins its holder to a company - sat in the address bar,
// the browser history and every request log on the way. sessionStorage keeps it to this
// tab, and it is cleared once the code is verified.

export type ConfirmContext = {
  email: string;
  invite: string;
  firstName: string;
  lastName: string;
  termsAccepted: boolean;
  termsVersion: string;
};

const KEY = 'minty_auth_confirm';

/** False when the browser refused storage; the caller then has no way to hand over. */
export function saveConfirmContext(context: ConfirmContext): boolean {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(context));
    return true;
  } catch {
    return false;
  }
}

export function readConfirmContext(): ConfirmContext | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ConfirmContext> | null;
    if (!data || typeof data.email !== 'string' || !data.email) return null;
    return {
      email: data.email,
      invite: typeof data.invite === 'string' ? data.invite : '',
      firstName: typeof data.firstName === 'string' ? data.firstName : '',
      lastName: typeof data.lastName === 'string' ? data.lastName : '',
      termsAccepted: data.termsAccepted === true,
      termsVersion: typeof data.termsVersion === 'string' ? data.termsVersion : '',
    };
  } catch {
    return null;
  }
}

export function clearConfirmContext(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* best-effort */
  }
}
