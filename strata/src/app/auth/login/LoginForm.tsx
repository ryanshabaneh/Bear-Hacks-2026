"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
      const res = await fetch("/api/auth/stub", {
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Sign-in failed");
        return;
      }
      const body = (await res.json()) as { role: "distributor" | "client" };
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
      <fieldset className="flex gap-2 cirrus-text-body-sm">
        <label
          className={`cirrus-card px-3 py-2 cursor-pointer flex-1 text-center transition-colors ${
            role === "client" ? "ring-2 ring-coral-500/40" : ""
          }`}
        >
          <input
            type="radio"
            name="role"
            value="client"
            className="sr-only"
            checked={role === "client"}
            onChange={() => setRole("client")}
          />
          Client
        </label>
        <label
          className={`cirrus-card px-3 py-2 cursor-pointer flex-1 text-center transition-colors ${
            role === "distributor" ? "ring-2 ring-coral-500/40" : ""
          }`}
        >
          <input
            type="radio"
            name="role"
            value="distributor"
            className="sr-only"
            checked={role === "distributor"}
            onChange={() => setRole("distributor")}
          />
          Distributor
        </label>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="cirrus-text-unit">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-3 py-2 rounded-md cirrus-card cirrus-text-body bg-transparent"
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
            onChange={(e) => setDisplayName(e.target.value)}
            className="px-3 py-2 rounded-md cirrus-card cirrus-text-body bg-transparent"
            placeholder={role === "distributor" ? "Lighthouse Studio" : "Maya Aran"}
          />
        </label>
      ) : null}

      {error ? (
        <p className="cirrus-text-body-sm" style={{ color: "var(--color-coral-700)" }}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2.5 rounded-md cirrus-text-body transition-colors disabled:opacity-60"
        style={{ background: "var(--color-ink-900)", color: "var(--color-cream)" }}
      >
        {pending
          ? "Working…"
          : isSignup
            ? `Create ${role} account →`
            : `Sign in as ${role} →`}
      </button>
    </form>
  );
}
