"use client";

import { Pencil, Plus, Trash2, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";
import { parseEmployeeListApiResponse } from "@/lib/employee";
import { fetchPublicIpv4FromBrowser } from "@/lib/network-access/ip";
import type { OfficeNetwork, RemoteAccessEmployee } from "@/lib/network-access/types";

type EmployeeOption = {
  sheetRow: number;
  employeeId: string;
  name: string;
};

export default function NetworkAccessSettingsPage() {
  const { user } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [restrictionEnabled, setRestrictionEnabled] = useState(false);
  const [networks, setNetworks] = useState<OfficeNetwork[]>([]);
  const [remoteEmployees, setRemoteEmployees] = useState<RemoteAccessEmployee[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [clientIp, setClientIp] = useState("");
  const [serverClientIp, setServerClientIp] = useState("");

  const [label, setLabel] = useState("");
  const [ip, setIp] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [remoteSheetRow, setRemoteSheetRow] = useState("");

  const remoteSheetRows = useMemo(
    () => new Set(remoteEmployees.map((row) => row.employeeSheetRow)),
    [remoteEmployees],
  );

  const availableEmployees = useMemo(
    () => employees.filter((row) => !remoteSheetRows.has(row.sheetRow)),
    [employees, remoteSheetRows],
  );

  const loadAll = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      const [networksRes, settingsRes, employeesRes, publicIp] = await Promise.all([
        fetch("/api/network-access/office-networks", { credentials: "include", cache: "no-store" }),
        fetch("/api/network-access/settings", { credentials: "include", cache: "no-store" }),
        fetch("/api/employee?pageSize=200&status=Active", {
          credentials: "include",
          cache: "no-store",
        }),
        fetchPublicIpv4FromBrowser().catch(() => ""),
      ]);

      const networksJson = (await networksRes.json()) as {
        success: boolean;
        message?: string;
        networks?: OfficeNetwork[];
        clientIp?: string;
      };
      const settingsJson = (await settingsRes.json()) as {
        success: boolean;
        message?: string;
        settings?: { restrictionEnabled?: boolean };
        remoteEmployees?: RemoteAccessEmployee[];
      };
      const employeesJson = await employeesRes.json();

      if (!networksJson.success) {
        throw new Error(networksJson.message ?? "Failed to load office networks");
      }
      if (!settingsJson.success) {
        throw new Error(settingsJson.message ?? "Failed to load network settings");
      }

      setNetworks(networksJson.networks ?? []);
      setServerClientIp(networksJson.clientIp?.trim() ?? "");
      setClientIp(publicIp || networksJson.clientIp?.trim() || "");
      setRestrictionEnabled(Boolean(settingsJson.settings?.restrictionEnabled));
      setRemoteEmployees(settingsJson.remoteEmployees ?? []);
      setEmployees(
        parseEmployeeListApiResponse(employeesJson)
          .map((row) => ({
            sheetRow: Number(row.sheetRow),
            employeeId: row.employeeId,
            name: row.name,
          }))
          .filter((row) => Number.isInteger(row.sheetRow) && row.sheetRow >= 2 && row.name.trim())
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load network access settings");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial / refresh load
    void loadAll();
  }, [loadAll]);

  const resetIpForm = () => {
    setEditingId(null);
    setLabel("");
    setIp("");
  };

  const startEdit = (network: OfficeNetwork) => {
    setEditingId(network.id);
    setLabel(network.label);
    setIp(network.ip);
    setMessage(null);
    setError(null);
  };

  const saveNetwork = async (opts?: { useCurrentIp?: boolean; labelOverride?: string }) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const useCurrentIp = Boolean(opts?.useCurrentIp);
      const nextLabel = (opts?.labelOverride ?? label).trim();
      let nextIp = ip.trim();

      // Resolve public IP in the browser — localhost has no x-forwarded-for on the server.
      if (useCurrentIp && !editingId) {
        nextIp = clientIp || (await fetchPublicIpv4FromBrowser());
      }

      const payload = editingId
        ? { id: editingId, label: nextLabel, ip: nextIp }
        : {
            label: nextLabel || (useCurrentIp ? "Office Wi‑Fi" : ""),
            ip: nextIp,
          };

      const res = await fetch("/api/network-access/office-networks", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message ?? "Failed to save network");

      resetIpForm();
      setMessage(editingId ? "Office IP updated." : "Office IP added.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save network");
    } finally {
      setSaving(false);
    }
  };

  const deleteNetwork = async (network: OfficeNetwork) => {
    if (!window.confirm(`Remove “${network.label}” (${network.ip}) from the allowlist?`)) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/network-access/office-networks", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: network.id }),
      });
      const json = (await res.json()) as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message ?? "Failed to delete network");
      if (editingId === network.id) resetIpForm();
      setMessage("Office IP removed.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete network");
    } finally {
      setSaving(false);
    }
  };

  const toggleRestriction = async (enabled: boolean) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/network-access/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restrictionEnabled: enabled }),
      });
      const json = (await res.json()) as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message ?? "Failed to update setting");
      setRestrictionEnabled(enabled);
      setMessage(enabled ? "Office Wi‑Fi restriction enabled." : "Restriction disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setSaving(false);
    }
  };

  const addRemoteEmployee = async () => {
    const sheetRow = Number(remoteSheetRow);
    const employee = employees.find((row) => row.sheetRow === sheetRow);
    if (!employee) {
      setError("Select an employee");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/network-access/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeSheetRow: employee.sheetRow,
          employeeId: employee.employeeId,
          employeeName: employee.name,
        }),
      });
      const json = (await res.json()) as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message ?? "Failed to add remote employee");
      setRemoteSheetRow("");
      setMessage(`${employee.name} can now access from any network.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add remote employee");
    } finally {
      setSaving(false);
    }
  };

  const removeRemoteEmployee = async (row: RemoteAccessEmployee) => {
    if (!window.confirm(`Remove remote access for ${row.employeeName}?`)) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/network-access/settings", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id }),
      });
      const json = (await res.json()) as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message ?? "Failed to remove remote employee");
      setMessage("Remote access removed.");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove remote employee");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="LAN / Wi‑Fi Restriction"
          description="Only HR can manage network access."
        />
        <p className="text-ex-muted text-sm">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LAN / Wi‑Fi Restriction"
        description="Allow the portal only from office router public IPs. Work-from-home employees can be exempted. HR and Super Admin always bypass this check so you can update IPs after a power cut."
        actions={
          <Badge variant={restrictionEnabled ? "warning" : "accent"}>
            {restrictionEnabled ? "Restriction on" : "Restriction off"}
          </Badge>
        }
      />

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="border-ex-border bg-ex-elevated text-ex-primary rounded-lg border px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Restriction</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-ex-primary text-sm font-medium">Require Office Wi‑Fi</p>
            <p className="text-ex-muted text-xs">
              When enabled, employees must use an IP from the Office Wi‑Fi list below (unless they
              are on the remote access list). Your public IP:{" "}
              <span className="text-ex-primary font-mono">{clientIp || "detecting…"}</span>
              {serverClientIp && serverClientIp !== clientIp ? (
                <>
                  {" "}
                  (server headers: <span className="font-mono">{serverClientIp || "none"}</span>)
                </>
              ) : null}
              .
            </p>
          </div>
          <Button
            type="button"
            variant={restrictionEnabled ? "outline" : "primary"}
            disabled={loading || saving}
            onClick={() => void toggleRestriction(!restrictionEnabled)}
          >
            {restrictionEnabled ? "Disable Restriction" : "Enable Restriction"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Office Wi‑Fi IPs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="network-label">Label</Label>
                <Input
                  id="network-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Router 1 / Floor 2"
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="network-ip">Public IPv4</Label>
                <Input
                  id="network-ip"
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="203.0.113.10"
                  disabled={saving}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={saving || loading || !label.trim() || !ip.trim()}
                onClick={() => void saveNetwork()}
              >
                {editingId ? "Update IP" : "Add IP"}
              </Button>
              {!editingId ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || loading || !clientIp}
                  onClick={() =>
                    void saveNetwork({
                      useCurrentIp: true,
                      labelOverride: label.trim() || "Office Wi‑Fi",
                    })
                  }
                >
                  <Wifi className="mr-1.5 size-4" />
                  Add my current IP
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled={saving} onClick={resetIpForm}>
                  Cancel edit
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {loading ? (
                <p className="text-ex-muted text-sm">Loading…</p>
              ) : networks.length === 0 ? (
                <p className="text-ex-muted text-sm">
                  No office IPs yet. Connect to each office Wi‑Fi and use “Add my current IP”.
                </p>
              ) : (
                networks.map((network) => (
                  <div
                    key={network.id}
                    className="border-ex-border bg-ex-elevated flex items-center gap-3 rounded-xl border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-ex-primary truncate text-sm font-medium">
                        {network.label}
                      </p>
                      <p className="text-ex-muted mt-0.5 font-mono text-xs">{network.ip}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      disabled={saving}
                      aria-label={`Edit ${network.label}`}
                      onClick={() => startEdit(network)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      disabled={saving}
                      aria-label={`Delete ${network.label}`}
                      onClick={() => void deleteNetwork(network)}
                    >
                      <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work from home (unrestricted)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-ex-muted text-xs">
              These employees can sign in from any network even when restriction is on.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="remote-employee">Employee</Label>
                <Select
                  id="remote-employee"
                  value={remoteSheetRow}
                  onChange={(e) => setRemoteSheetRow(e.target.value)}
                  disabled={saving || loading}
                >
                  <option value="">Select</option>
                  {availableEmployees.map((employee) => (
                    <option key={employee.sheetRow} value={String(employee.sheetRow)}>
                      {employee.name}
                      {employee.employeeId ? ` (${employee.employeeId})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="button"
                disabled={saving || loading || !remoteSheetRow}
                onClick={() => void addRemoteEmployee()}
              >
                <Plus className="mr-1 size-4" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {loading ? (
                <p className="text-ex-muted text-sm">Loading…</p>
              ) : remoteEmployees.length === 0 ? (
                <p className="text-ex-muted text-sm">No remote employees yet.</p>
              ) : (
                remoteEmployees.map((row) => (
                  <div
                    key={row.id}
                    className="border-ex-border bg-ex-elevated flex items-center gap-3 rounded-xl border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-ex-primary truncate text-sm font-medium">
                        {row.employeeName}
                      </p>
                      <p className="text-ex-muted mt-0.5 text-xs">
                        {row.employeeId || `Row ${row.employeeSheetRow}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0"
                      disabled={saving}
                      aria-label={`Remove remote access for ${row.employeeName}`}
                      onClick={() => void removeRemoteEmployee(row)}
                    >
                      <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
