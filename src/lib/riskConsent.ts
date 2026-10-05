export const RISK_CONSENT_KEY = "dark-control.risk-consent";

// Change only when the notice itself materially changes, not on app version bumps.
const NOTICE_VERSION = "1";

/** Read consent for the current notice without accepting it on the user's behalf. */
export function hasRiskConsent(): boolean {
  try {
    return localStorage.getItem(RISK_CONSENT_KEY) === NOTICE_VERSION;
  } catch (error: unknown) {
    console.error("Could not read risk consent", error);
    return false;
  }
}

/** Persist explicit acceptance; storage failures leave acceptance session-only. */
export function rememberRiskConsent(): void {
  try {
    localStorage.setItem(RISK_CONSENT_KEY, NOTICE_VERSION);
  } catch (error: unknown) {
    console.error("Could not save risk consent", error);
  }
}
