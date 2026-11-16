import { useSyncExternalStore } from "react";
import type { User } from "../lib/session/types";
type State = {
  token: string | null;
  expiresAt: number | null;
  sessionExpiresAt: string | null;
  sessionAbsoluteExpiresAt: string | null;
  user: User | null;
  status: "booting" | "ready" | "unavailable";
  reconnecting: boolean;
  idleWarning: {
    cutoff: number;
    cannotExtend: boolean;
    busy: boolean;
    dismissed: boolean;
  } | null;
};
let state: State = {
  token: null,
  expiresAt: null,
  sessionExpiresAt: null,
  sessionAbsoluteExpiresAt: null,
  user: null,
  status: "booting",
  reconnecting: false,
  idleWarning: null,
};
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const useAuthStore = Object.assign(
  <T>(selector: (value: State) => T): T =>
    selector(useSyncExternalStore(subscribe, () => state)),
  {
    getState: () => state,
    setState: (update: Partial<State>) => {
      state = { ...state, ...update };
      for (const listener of listeners) listener();
    },
    subscribe,
  },
);
