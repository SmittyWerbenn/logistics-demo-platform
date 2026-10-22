import { useRef, useState } from "react";
import type { CaptchaHandle } from "../components/Captcha";
import { useLanguage } from "../store/LanguageContext";
import { CAPTCHA_MESSAGES, TRACKING_CAPTCHA_ENABLED, captchaFailureOf, getHumanPass, verifyTrackingCaptcha } from "./captchaApi";
import { fetchPublicShipment, HumanCheckRequiredError, type PublicShipmentResult } from "./publicTracking";

/**
 * Anti-bot gate for the public tracking lookup. The server issues a short-lived
 * "human pass" after a CAPTCHA is solved and refuses AWB lookups without one;
 * this hook just drives that: it asks for the code only when no valid pass is held.
 */
export function useTrackingGate() {
  const { language } = useLanguage();
  const captchaRef = useRef<CaptchaHandle>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [needsCaptcha, setNeedsCaptcha] = useState(() => TRACKING_CAPTCHA_ENABLED && getHumanPass() === null);

  /** Verifies (if needed) and looks the AWB up. `blocked` = CAPTCHA step failed. */
  async function lookup(awb: string): Promise<PublicShipmentResult | null | "blocked"> {
    setError("");
    if (TRACKING_CAPTCHA_ENABLED && !getHumanPass()) {
      const c = code.trim();
      if (!c) {
        setNeedsCaptcha(true);
        setError(CAPTCHA_MESSAGES.required[language]);
        captchaRef.current?.focus();
        return "blocked";
      }
      try {
        await verifyTrackingCaptcha(captchaRef.current?.id() ?? "", c);
        setNeedsCaptcha(false);
      } catch (err) {
        const kind = captchaFailureOf(err) ?? "server";
        setError(CAPTCHA_MESSAGES[kind][language]);
        captchaRef.current?.refresh();
        return "blocked";
      }
    }
    try {
      return await fetchPublicShipment(awb);
    } catch (err) {
      if (err instanceof HumanCheckRequiredError) {
        setNeedsCaptcha(true);
        setCode("");
        captchaRef.current?.refresh();
        return "blocked";
      }
      throw err;
    }
  }

  return { captchaRef, code, setCode: (v: string) => { setCode(v); if (v) setError(""); }, error, needsCaptcha, lookup };
}
