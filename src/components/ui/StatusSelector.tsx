"use client";

import { useTranslations } from "next-intl";
import type { MediaStatus } from "@/types/media";
import { cn } from "@/lib/utils/index";

export interface StatusSelectorProps {
  value: MediaStatus | undefined;
  onChange: (status: MediaStatus) => void;
  className?: string;
}

const STATUS_OPTIONS: MediaStatus[] = [
  "completed",
  "in_progress",
  "pending",
  "abandoned",
];

const statusColorClasses: Record<MediaStatus, string> = {
  completed: "text-green-400",
  in_progress: "text-blue-400",
  pending: "text-yellow-400",
  abandoned: "text-red-400",
};

export function StatusSelector({
  value,
  onChange,
  className,
}: StatusSelectorProps) {
  const t = useTranslations("status");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value as MediaStatus;
    if (newValue) {
      onChange(newValue);
    }
  };

  return (
    <select
      value={value ?? ""}
      onChange={handleChange}
      className={cn(
        "bg-surface2 border border-border rounded-md px-3 py-2 text-sm",
        "focus:outline-none focus:border-accent",
        value ? statusColorClasses[value] : "text-muted",
        "cursor-pointer transition-colors",
        className
      )}
    >
      {!value && (
        <option value="" disabled>
          Añadir a biblioteca
        </option>
      )}
      {STATUS_OPTIONS.map((status) => (
        <option key={status} value={status} className="text-text bg-surface2">
          {t(status)}
        </option>
      ))}
    </select>
  );
}
