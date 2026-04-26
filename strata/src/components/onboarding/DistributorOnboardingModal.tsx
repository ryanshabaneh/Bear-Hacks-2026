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
    windowTitle: "join-the-sky.exe",
    title: "Join the Sky.",
    body: (
      <p>
        Lend cycles your browser is doing nothing with. Strata pays per slice
        your Node runs. Leave any time.
      </p>
    ),
    imageAsset: "/assets/crescent.svg",
    imageAlt: "Moon and star sky mark",
  },
  {
    windowTitle: "how-earning-works.exe",
    title: "How earning works.",
    body: (
      <p>
        Nodes earn per slice processed. Earnings show in your dashboard live.
        Payouts run weekly above one dollar.
      </p>
    ),
    imageAsset: "/assets/flower.svg",
    imageAlt: "Bloom of earnings",
  },
  {
    windowTitle: "whats-safe.exe",
    title: "What's safe.",
    body: (
      <p>
        Each Node sees only the slice it was assigned. Slice content wipes on
        completion. Sandboxed in a browser tab. Stop any time.
      </p>
    ),
    imageAsset: "/assets/moonl.svg",
    imageAlt: "Calm moon for sandboxed safety",
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
    <Modal
      open={open}
      ariaLabel="Strata distributor onboarding"
      closeOnBackdrop={false}
      title={step.windowTitle}
      titleBarTone="lavender"
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
