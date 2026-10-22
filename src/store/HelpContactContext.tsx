import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../utils/apiClient";
import { normalizeWhatsApp } from "../utils/whatsapp";

// Shown on the public Contact page until/unless Superadmin edits them under
// Pengaturan. Same text the page used to hardcode.
export const CONTACT_DEFAULTS = {
  contactPhone: "021-2200-8899",
  contactEmail: "cs@gms-logistics.co.id",
  contactHours: "Senin - Sabtu, 08.00 - 18.00 WIB",
  headOffice: "Surabaya",
};

/** Digits-only, keeping a leading "+", for tel: links. */
export function toTelHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}

/** Converts a displayed Indonesian phone number (e.g. "08xx-xxxx-xxxx") into the
 * digits-only format wa.me links need, swapping the country code in for a
 * leading "0". */
export function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

interface HelpContactContextValue {
  /** WhatsApp CS exactly as typed under Pengaturan ("" until loaded / if unset). */
  helpPhoneDisplay: string;
  /** WhatsApp CS normalized for wa.me links; "" when unset or invalid. */
  helpWhatsAppNumber: string;
  contactPhone: string;
  contactEmail: string;
  contactHours: string;
  headOffice: string;
}

const HelpContactContext = createContext<HelpContactContextValue>({
  helpPhoneDisplay: "",
  helpWhatsAppNumber: "",
  ...CONTACT_DEFAULTS,
});

/**
 * WhatsApp CS (the existing "Nomor Bantuan" setting, used by Compro and the
 * public Contact page) - configurable by Superadmin
 * under Pengaturan, fetched here from the public settings endpoint (no
 * auth - both the public Contact page and the driver portal need it, and
 * neither has settings.view) and shared app-wide so an edit takes effect
 * everywhere without a redeploy.
 */
export function HelpContactProvider({ children }: { children: ReactNode }) {
  const [helpPhoneDisplay, setHelpPhoneDisplay] = useState("");
  const [contact, setContact] = useState(CONTACT_DEFAULTS);

  useEffect(() => {
    api
      .get<
        {
          helpPhoneNumber: string;
        } & Partial<typeof CONTACT_DEFAULTS>
      >("/api/public/settings", { auth: false })
      .then((res) => {
        setHelpPhoneDisplay(res.helpPhoneNumber ?? "");
        setContact({
          contactEmail: res.contactEmail || CONTACT_DEFAULTS.contactEmail,
          contactPhone: res.contactPhone || CONTACT_DEFAULTS.contactPhone,
          contactHours: res.contactHours || CONTACT_DEFAULTS.contactHours,
          headOffice: res.headOffice || CONTACT_DEFAULTS.headOffice,
        });
      })
      .catch(() => {});
  }, []);

  return (
    <HelpContactContext.Provider
      value={{ helpPhoneDisplay, helpWhatsAppNumber: normalizeWhatsApp(helpPhoneDisplay) ?? "", ...contact }}
    >
      {children}
    </HelpContactContext.Provider>
  );
}

export function useHelpContact() {
  return useContext(HelpContactContext);
}
