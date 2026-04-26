"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Stepper } from "@/components/ui/Stepper";
import { Button } from "@/components/ui/Button";
import { TutorialImage } from "@/components/ui/TutorialImage";

type Step = {
  windowTitle: string;
  title: string;
  body: React.ReactNode;
  imageSrc?: string;
  imageAlt: string;
};

const STEPS: Step[] = [
  {
    windowTitle: "welcome.exe",
    title: "Welcome to Strata.",
    body: (
      <p>
        Post a Forecast. The Sky catches it. Your Catchment lands ready to read.
        Eighty to ninety-five percent under cloud rates.
      </p>
    ),
    imageAlt: "Strata sky illustration",
  },
  {
    windowTitle: "how-it-works.exe",
    title: "How a Forecast runs.",
    body: (
      <p>
        Your audio splits into thirty-second slices. Each slice runs on a
        sandboxed Node and returns. Strata reassembles the pieces into one
        Catchment.
      </p>
    ),
    imageAlt: "Forecast flow diagram",
  },
  {
    windowTitle: "youre-in.exe",
    title: "You're in.",
    body: (
      <p>
        Five dollars in free credits. No plan to choose. Try a sample Forecast
        or upload your own audio.
      </p>
    ),
    imageAlt: "Open dashboard preview",
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
    <Modal
      open={open}
      ariaLabel="Strata onboarding"
      closeOnBackdrop={false}
      title={step.windowTitle}
      titleBarTone="pink"
      size="md"
    >
      <div className="flex flex-col gap-4">
        <Stepper variant="y2k" total={STEPS.length} current={stepIdx + 1} />

        <TutorialImage src={step.imageSrc} alt={step.imageAlt} />

        <div className="flex flex-col gap-2">
          <h2 className="y2k-mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--y2k-border)" }}>
            {step.title}
          </h2>
          <div
            className="y2k-mono"
            style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--y2k-border)" }}
          >
            {step.body}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1">
          <Button variant="y2k" onClick={back} disabled={stepIdx === 0}>
            ← back
          </Button>
          <Button variant="y2k-primary" onClick={next} disabled={pending}>
            {pending ? "opening..." : isLast ? "open dashboard" : "next →"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
