import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { formatDriveError, getDrive } from "@/lib/google/drive-auth";

const SHARED_DRIVE_OPTIONS = {
  supportsAllDrives: true,
} as const;

const FILE_ID_PATTERN = /^[\w-]+$/;

export const GET = withActiveSession(async (req) => {
  const fileId = req.nextUrl.searchParams.get("fileId")?.trim();

  if (!fileId || !FILE_ID_PATTERN.test(fileId)) {
    return NextResponse.json({ success: false, message: "Invalid file id" }, { status: 400 });
  }

  try {
    const drive = await getDrive();

    const meta = await drive.files.get({
      fileId,
      fields: "mimeType",
      ...SHARED_DRIVE_OPTIONS,
    });

    const mimeType = meta.data.mimeType ?? "application/octet-stream";
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "File is not an image" },
        { status: 415 },
      );
    }

    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
        ...SHARED_DRIVE_OPTIONS,
      },
      { responseType: "arraybuffer" },
    );

    return new NextResponse(response.data as ArrayBuffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const err = formatDriveError(error);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
});
