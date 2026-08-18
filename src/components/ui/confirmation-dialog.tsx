import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

export function ConfirmationDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  busy = false,
  busyText,
  icon,
  iconContainerClassName = "bg-rose-600",
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: ButtonProps["variant"];
  busy?: boolean;
  busyText?: string;
  icon?: ReactNode;
  iconContainerClassName?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="border-ex-border bg-ex-elevated relative z-10 w-full max-w-md rounded-2xl border p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconContainerClassName}`}
          >
            {icon ?? <AlertTriangle className="size-5 text-white" aria-hidden />}
          </div>
          <div className="min-w-0">
            <h2 id="confirmation-dialog-title" className="text-ex-primary text-lg font-semibold">
              {title}
            </h2>
            <div className="text-ex-muted mt-1 text-sm">{description}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {cancelText}
          </Button>
          <Button type="button" variant={confirmVariant} disabled={busy} onClick={onConfirm}>
            {busy ? (busyText ?? confirmText) : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
