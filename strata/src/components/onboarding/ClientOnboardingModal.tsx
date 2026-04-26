"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Stepper } from "@/components/ui/Stepper";
import { Button } from "@/components/ui/Button";

type Step = {
  label: string;
  title: string;
  body: React.ReactNode;
};

const STEPS: Step[] = [
  {
    label: "Welcome",
    title: "Welcome to Strata.",
    body: (
      <>
        <p>
          Strata is a compute marketplace. You post a Forecast. The Sky catches
          it. Results return to your Catchment.
        </p>
        <p className="opacity-70">This walkthrough takes about ninety seconds.</p>
      </>
    ),
  },
  {
    label: "How a Forecast runs",
    title: "How a Forecast runs.",
    body: (
      <>
        <p>
          When you cast a Forecast, Strata splits the input into slices. Audio
          becomes thirty-second chunks. Each slice is dispatched to a Node — one
          device contributing compute to the Sky.
        </p>
        <p>
          The Node processes the slice in a sandboxed browser tab and returns
          the result. Strata reassembles the pieces and hands you the
          Catchment.
        </p>
      </>
    ),
  },
  {
    label: "Where the Sky comes from",
    title: "Where the Sky comes from.",
    body: (
      <>
        <p>
          Nodes are individuals, schools, and partner organizations who run a
          Strata-compatible browser tab in exchange for compensation. They opt
          into the categories of work they accept.
        </p>
        <p>
          Each Node sees only the slice it was given, never your full Forecast.
          Slice content is wiped from Node memory when the slice completes.
        </p>
      </>
    ),
  },
  {
    label: "What you pay",
    title: "What you pay.",
    body: (
      <>
        <p>
          You're charged per CPU-second of compute used. For most Forecasts,
          the total runs eighty to ninety-five percent below the same workload
          on AWS, Google, or Azure.
        </p>
        <p className="opacity-70">
          The savings come from using compute that was already running.
        </p>
      </>
    ),
  },
  {
    label: "You're in",
    title: "You're in.",
    body: (
      <>
        <p>
          You start with five dollars in free credits. Try a sample Forecast,
          or upload your own audio. There's no plan to choose.
        </p>
        <p className="opacity-70">Open the dashboard whenever you're ready.</p>
      </>
    ),
  },
];

export function ClientOnboardingModal() {
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
    <Modal open={open} ariaLabel="Strata onboarding" closeOnBackdrop={false}>
      <div className="flex flex-col gap-2">
        <Stepper total={STEPS.length} current={stepIdx + 1} />
      </div>

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
