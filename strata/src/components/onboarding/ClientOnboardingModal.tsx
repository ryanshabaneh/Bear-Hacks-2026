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
  imageAsset?: string;
  imageAlt: string;
};

const STEPS: Step[] = [
  {
    windowTitle: "strata.exe",
    title: "Hi. I'm Strata.",
    body: (
      <p>
        Your stratosphere orchestrator, the transcriber. Drop audio or video
        into your queue and I&apos;ll get it transcribed clean. Eighty to
        ninety-five percent under what the clouds charge.
      </p>
    ),
    imageAsset: "/assets/orb.svg",
    imageAlt: "Strata orb mark",
  },
  {
    windowTitle: "the-sky.exe",
    title: "How a cast runs.",
    body: (
      <p>
        Every Forecast splits into thirty-second slices. I dispatch them
        across the Sky and your transcript comes back in real time. The
        queue is your staging zone. Cast on demand, or let me run it
        hands-free.
      </p>
    ),
    imageAsset: "/assets/twin-star.svg",
    imageAlt: "Slices dispatching across the Sky",
  },
  {
    windowTitle: "controls.exe",
    title: "Two switches you'll want.",
    body: (
      <p>
        Auto-queue adds dropped files straight to the line. Auto-cast fires
        the queue without waiting for you. Flip both for hands-free, or
        leave them off to review before each cast.
      </p>
    ),
    imageAsset: "/assets/clover.svg",
    imageAlt: "Three-blade switch motif",
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

        <TutorialImage src={step.imageSrc} asset={step.imageAsset} alt={step.imageAlt} />

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
