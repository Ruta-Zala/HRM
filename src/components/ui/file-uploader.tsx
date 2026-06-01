import { getDocumentDisplayName } from "@/lib/employee/documents";
import { UploadIcon } from "lucide-react";
import { Input } from "./input";
import { Label } from "./label";

export type DocumentField = "pancard" | "aadharCard" | "marksheet" | "profileImage";

export function FileUploaderField({
  id,
  fileName,
  onChange,
}: {
  id: DocumentField;
  fileName: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const displayName = getDocumentDisplayName(id, fileName);

  return (
    <div className="relative space-y-2">
      <Input
        id={id}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={onChange}
        className="sr-only"
      />
      <Label
        htmlFor={id}
        className="border-ex-border bg-ex-bg hover:border-ex-ring hover:bg-ex-surface flex cursor-pointer items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm transition-colors"
      >
        <span className={displayName ? "text-ex-text" : "text-ex-muted"}>
          {displayName || "Upload file..."}
        </span>
        <span className="text-ex-muted inline-flex items-center gap-1 text-xs">
          <UploadIcon className="size-4" />
          Browse
        </span>
      </Label>
    </div>
  );
}
