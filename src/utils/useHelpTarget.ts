import { useEffect, useState } from "react";
import { useAuth } from "../store/AuthContext";
import { fetchHelpTarget, type HelpTargetInfo, type HelpTopic } from "./helpWhatsApp";

export type HelpTargetState =
  | { status: "loading" }
  | { status: "ready"; info: HelpTargetInfo }
  | { status: "error" };

/** Loads the WhatsApp destination for the signed-in user's role + `topic`
 * (re-fetched on every mount, so a number changed in Pengaturan is picked up). */
export function useHelpTarget(topic: HelpTopic): HelpTargetState {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<HelpTargetState>({ status: "loading" });

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchHelpTarget(topic)
      .then((info) => !cancelled && setState({ status: "ready", info }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, topic]);

  return state;
}
