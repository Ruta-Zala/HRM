// app/api/sheet/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
    readSheet,
    appendSheetRow,
    updateSheetRow,
    clearSheetRange,
} from "@/lib/googleSheet";

/**
 * GET
 * Read sheet data
 *
 * Example:
 * /api/sheet?range=Sheet1!A1:E20
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const range =
            searchParams.get("range") || "Sheet1!A1:Z1000";

        const data = await readSheet(range);

        return NextResponse.json(
            {
                success: true,
                data,
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("GET Sheet Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to fetch sheet data",
            },
            { status: 500 }
        );
    }
}

/**
 * POST
 * Append new row
 *
 * Body:
 * {
 *   "values": [
 *     ["RK", "Developer", "India"]
 *   ]
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const { values } = body;

        if (!values || !Array.isArray(values)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "values array is required",
                },
                { status: 400 }
            );
        }

        const response = await appendSheetRow(values);

        return NextResponse.json(
            {
                success: true,
                data: response,
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("POST Sheet Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to append row",
            },
            { status: 500 }
        );
    }
}

/**
 * PUT
 * Update specific range
 *
 * Body:
 * {
 *   "range": "Sheet1!A2:C2",
 *   "values": [
 *     ["Updated", "Data", "Here"]
 *   ]
 * }
 */
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();

        const { range, values } = body;

        if (!range) {
            return NextResponse.json(
                {
                    success: false,
                    message: "range is required",
                },
                { status: 400 }
            );
        }

        if (!values || !Array.isArray(values)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "values array is required",
                },
                { status: 400 }
            );
        }

        const response = await updateSheetRow(range, values);

        return NextResponse.json(
            {
                success: true,
                data: response,
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("PUT Sheet Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to update sheet",
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE
 * Clear sheet range
 *
 * Body:
 * {
 *   "range": "Sheet1!A2:C10"
 * }
 */
export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();

        const { range } = body;

        if (!range) {
            return NextResponse.json(
                {
                    success: false,
                    message: "range is required",
                },
                { status: 400 }
            );
        }

        const response = await clearSheetRange(range);

        return NextResponse.json(
            {
                success: true,
                data: response,
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("DELETE Sheet Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to clear range",
            },
            { status: 500 }
        );
    }
}