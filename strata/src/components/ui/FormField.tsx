import { cn } from "@/lib/utils/cn";
import type { InputHTMLAttributes, ReactNode } from "react";

type FormFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

export function FormField({
  label,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="cirrus-text-unit">{label}</span>
      {children}
      {error ? (
        <span
          className="cirrus-text-body-sm"
          style={{ color: "var(--color-coral-700)" }}
        >
          {error}
        </span>
      ) : hint ? (
        <span className="cirrus-text-body-sm opacity-60">{hint}</span>
      ) : null}
    </label>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, ...rest }: TextInputProps) {
  return (
    <input
      {...rest}
      className={cn(
        "px-3 py-2.5 rounded-md cirrus-card cirrus-text-body bg-transparent",
        "placeholder:opacity-40",
        className,
      )}
    />
  );
}
