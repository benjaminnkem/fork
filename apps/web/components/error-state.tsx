import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";

export function ErrorState({
  error,
  title = "Request failed",
}: {
  error: unknown;
  title?: string;
}) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = error instanceof ApiError ? error.code : typeof record.code === "string" ? record.code : "INTERNAL";
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : typeof record.message === "string"
          ? record.message
          : "An unexpected error occurred";
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <span className="font-mono">{code}</span>
        {": "}
        {message}
      </AlertDescription>
    </Alert>
  );
}
