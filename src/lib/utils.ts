import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount === null || amount === undefined) return "—";
  const cur = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${cur}`;
  }
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function detectFileKind(
  mimeType: string,
  fileName: string,
): "pdf" | "image" | "csv" | "txt" | "unknown" {
  const lowerName = fileName.toLowerCase();
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "text/csv" || lowerName.endsWith(".csv")) return "csv";
  if (mimeType === "text/plain" || lowerName.endsWith(".txt")) return "txt";
  return "unknown";
}
