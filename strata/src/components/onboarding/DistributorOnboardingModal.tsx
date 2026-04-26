"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Stepper } from "@/components/ui/Stepper";
import { Button } from "@/components/ui/Button";

type Step = {
  title: string;
  body: React.ReactNode;
};

const STEPS: Step[] = [
  {
    title: "Join the Sky.",
    body: (
      <>
        <p>
          Lend cycles your browser is doing nothing with. Strata pays for every
          slice your Node runs. You opt into the categories of Forecast you'll
          accept.
        </p>
        <p className="opacity-70">You can leave the Sky at any time.</p>
      </>
    ),
  },
  {
    title: "How earning works.",
    body: (
      <>
        <p>
          Nodes earn per slice processed. The rate depends on the Forecast type
          and cycles consumed. Earnings show in your dashboard in real time.
        </p>
        <p className="opacity-70">Payouts run weekly above a one-dollar threshold.</p>
      </>
    ),
  },
  {
    title: "What's safe.",
    body: (
      <>
        <p>
          Each Node only sees the slice it was assigned, never the source
          Forecast. Slice content is wiped from memory on completion.
        </p>
        <p>
          Nodes run in sandboxed browser tabs and cannot reach the rest of your
          machine. You can stop contributing at any time without penalty.
        </p>
      </>
    ),
  },
];

export function DistributorOnboardingModal() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(true);

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  function next() {
    if (!isLast) {
      setStepIdx((s) => s + 1);
      return;
    }
    start(async () => {
      await fetch("/api/onboarding/complete", { method: "POST" });
      setOpen(false);
      router.refresh();
    });
  }

  function back() {
    if (stepIdx > 0) setStepIdx((s) => s - 1);
  }

  return (
    <Modal open={open} ariaLabel="Strata distributor onboarding" closeOnBackdrop={false}>
      <Stepper total={STEPS.length} current={stepIdx + 1} />

      <div className="flex flex-col gap-3">
        <h2 className="cirrus-text-h1">{step.title}</h2>
        <div className="cirrus-text-body flex flex-col gap-3">{step.body}</div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <Button variant="ghost" size="sm" onClick={back} disabled={stepIdx === 0}>
          ← Back
        </Button>
        <Button onClick={next} disabled={pending} size="md">
          {pending
            ? "Opening…"
            : isLast
              ? "Open the dashboard →"
              : "Next →"}
        </Button>
      </div>
    </Modal>
  );
}
