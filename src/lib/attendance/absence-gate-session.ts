const ABSENCE_GATE_SESSION_KEY = "absence_gate";

export function setAbsenceGateSessionHint(active: boolean) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ABSENCE_GATE_SESSION_KEY, active ? "1" : "0");
}

export function readAbsenceGateSessionHint(): boolean | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(ABSENCE_GATE_SESSION_KEY);
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

export function clearAbsenceGateSessionHint() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ABSENCE_GATE_SESSION_KEY);
}
