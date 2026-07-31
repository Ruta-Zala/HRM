import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { getClientIp, isValidIpv4, normalizeIp } from "@/lib/network-access/ip";
import {
  createOfficeNetwork,
  deleteOfficeNetwork,
  listOfficeNetworks,
  updateOfficeNetwork,
} from "@/lib/network-access/office-networks-sheets";
import { clearNetworkAccessCaches } from "@/lib/network-access/settings-sheets";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";

export const dynamic = "force-dynamic";

export const GET = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const networks = await listOfficeNetworks();
    return NextResponse.json({
      success: true,
      networks,
      clientIp: getClientIp(req),
    });
  } catch (error) {
    console.error("GET Office Networks Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to load office networks"),
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
    const label = String(body.label ?? "").trim();
    const ip = normalizeIp(String(body.ip ?? ""));

    if (!label) {
      return NextResponse.json({ success: false, message: "Label is required" }, { status: 400 });
    }
    if (!isValidIpv4(ip)) {
      return NextResponse.json(
        { success: false, message: "A valid IPv4 address is required" },
        { status: 400 },
      );
    }

    const network = await createOfficeNetwork({ label, ip });
    clearNetworkAccessCaches();
    return NextResponse.json({ success: true, network }, { status: 201 });
  } catch (error) {
    console.error("POST Office Network Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to add office network"),
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
    const id = String(body.id ?? "").trim();
    const label = String(body.label ?? "").trim();
    const ip = normalizeIp(String(body.ip ?? ""));

    if (!id || !label || !isValidIpv4(ip)) {
      return NextResponse.json(
        { success: false, message: "id, label, and a valid IPv4 are required" },
        { status: 400 },
      );
    }

    const network = await updateOfficeNetwork({ id, label, ip });
    if (!network) {
      return NextResponse.json({ success: false, message: "Network not found" }, { status: 404 });
    }

    clearNetworkAccessCaches();
    return NextResponse.json({ success: true, network });
  } catch (error) {
    console.error("PATCH Office Network Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to update office network"),
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

    const deleted = await deleteOfficeNetwork(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Network not found" }, { status: 404 });
    }

    clearNetworkAccessCaches();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Office Network Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to delete office network"),
      },
      { status: 500 },
    );
  }
});
