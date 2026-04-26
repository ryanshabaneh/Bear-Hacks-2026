"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function LoginForm({
  presetRole,
  isSignup,
}: {
  presetRole: "distributor" | "client";
  isSignup: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<"distributor" | "client">(presetRole);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const response = await fetch("/api/auth/stub", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email")),
          role: String(form.get("role")),
          displayName:
            String(form.get("displayName")) ||
            String(form.get("email")).split("@")[0],
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Sign-in failed");
        return;
      }
      const body = (await response.json()) as { role: "distributor" | "client" };
      router.push(body.role === "distributor" ? "/distributor" : "/client");
      router.refresh();
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-4"
      aria-label={isSignup ? "Create account" : "Sign in"}
    >
      <fieldset className="flex gap-2">
        <RoleOption
          name="client"
          label="Client"
          checked={role === "client"}
          onSelect={() => setRole("client")}
        />
        <RoleOption
          name="distributor"
          label="Distributor"
          checked={role === "distributor"}
          onSelect={() => setRole("distributor")}
        />
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="cirrus-text-unit">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="y2k-mono"
          style={{
            padding: "8px 10px",
            border: "1.5px solid var(--y2k-border)",
            background: "var(--y2k-window)",
            fontSize: 13,
            color: "var(--y2k-border)",
            boxShadow: "inset 1px 1px 0 0 var(--y2k-shadow-soft)",
          }}
          placeholder="you@example.com"
        />
      </label>

      {isSignup ? (
        <label className="flex flex-col gap-1.5">
          <span className="cirrus-text-unit">Display name</span>
          <input
            name="displayName"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="y2k-mono"
            style={{
              padding: "8px 10px",
              border: "1.5px solid var(--y2k-border)",
              background: "var(--y2k-window)",
              fontSize: 13,
              color: "var(--y2k-border)",
              boxShadow: "inset 1px 1px 0 0 var(--y2k-shadow-soft)",
            }}
            placeholder={role === "distributor" ? "Northbeacon Media" : "Saltbox Studio"}
          />
        </label>
      ) : null}

      {error ? (
        <p
          className="y2k-mono"
          style={{ fontSize: 12, color: "var(--color-coral-700)" }}
        >
          {error}
        </p>
      ) : null}

      <input type="hidden" name="role" value={role} />

      <Button type="submit" disabled={pending}>
        {pending
          ? "working..."
          : isSignup
            ? `create ${role} account →`
            : `sign in as ${role} →`}
      </Button>
    </form>
  );
}

function RoleOption({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className="flex-1 text-center cursor-pointer y2k-mono"
      style={{
        padding: "10px",
        border: "1.5px solid var(--y2k-border)",
        background: checked ? "var(--y2k-titlebar-pink)" : "var(--y2k-window)",
        boxShadow: checked
          ? "inset 2px 2px 0 0 var(--y2k-shadow-soft)"
          : "2px 2px 0 0 var(--y2k-shadow)",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--y2k-border)",
        transform: checked ? "translate(1px, 1px)" : undefined,
      }}
    >
      <input
        type="radio"
        name="role"
        value={name}
        className="sr-only"
        checked={checked}
        onChange={onSelect}
      />
      {label}
    </label>
  );
}
