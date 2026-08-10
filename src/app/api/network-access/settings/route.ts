import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import {
  addRemoteAccessEmployee,
  clearNetworkAccessCaches,
  getNetworkAccessSettings,
  listRemoteAccessEmployees,
  removeRemoteAccessEmployee,
  setNetworkRestrictionEnabled,
} from "@/lib/network-access/repository";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";

export const dynamic = "force-dynamic";

export const GET = withActiveSession(async (_req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const [settings, remoteEmployees] = await Promise.all([
      getNetworkAccessSettings(),
      listRemoteAccessEmployees(),
    ]);
    return NextResponse.json({ success: true, settings, remoteEmployees });
  } catch (error) {
    console.error("GET Network Access Settings Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to load network settings"),
      },
      { status: 500 },
    );
  }
});

export const PATCH = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.restrictionEnabled !== "boolean") {
      return NextResponse.json(
        { success: false, message: "restrictionEnabled (boolean) is required" },
        { status: 400 },
      );
    }

    const settings = await setNetworkRestrictionEnabled(body.restrictionEnabled);
    clearNetworkAccessCaches();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("PATCH Network Access Settings Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to update network settings"),
      },
      { status: 500 },
    );
  }
});

export const POST = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const employeeSheetRow = Number(body.employeeSheetRow);
    const employeeId = String(body.employeeId ?? "").trim();
    const employeeName = String(body.employeeName ?? "").trim();

    if (!Number.isInteger(employeeSheetRow) || employeeSheetRow < 2 || !employeeName) {
      return NextResponse.json(
        { success: false, message: "Valid employeeSheetRow and employeeName are required" },
        { status: 400 },
      );
    }

    const remoteEmployee = await addRemoteAccessEmployee({
      employeeSheetRow,
      employeeId,
      employeeName,
    });
    clearNetworkAccessCaches();
    return NextResponse.json({ success: true, remoteEmployee }, { status: 201 });
  } catch (error) {
    console.error("POST Remote Access Employee Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to add remote employee"),
      },
      { status: 500 },
    );
  }
});

export const DELETE = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }

    const deleted = await removeRemoteAccessEmployee(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Remote employee not found" },
        { status: 404 },
      );
    }

    clearNetworkAccessCaches();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Remote Access Employee Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to remove remote employee"),
      },
      { status: 500 },
    );
  }
});
