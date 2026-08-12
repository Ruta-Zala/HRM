"use client";

import { useCallback, useEffect, useState } from "react";

import { readResponseJson } from "@/lib/api/read-response-json";
import { toUserFacingFetchError } from "@/lib/api/user-facing-error";
import { parseEmployeeListApiResponse } from "@/lib/employee";
import type { Employee } from "@/types/employee";

/**
 * Candidate list for letter forms — HR/Super Admin only. Includes every status
 * (not just Active): several letters (experience, NOC) are typically generated
 * for someone who has already left the company.
 */
export function useLetterEmployees(enabled: boolean) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employee?pageSize=200", {
        credentials: "include",
      });
      const data = await readResponseJson<{
        success?: boolean;
        message?: string;
        data?: string[][];
        sheetRows?: number[];
      }>(res, "fetch");
      const list = parseEmployeeListApiResponse(data).sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(list);
    } catch (err) {
      setError(toUserFacingFetchError(err));
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { employees, loading, error };
}
