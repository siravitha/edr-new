import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatCurrency(value: number, locale = "th-TH"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "THB", minimumFractionDigits: 0 }).format(value);
}