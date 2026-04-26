import { cn } from "@/lib/utils/cn";

type TutorialImageProps = {
  src?: string;
  alt: string;
  className?: string;
};

export function TutorialImage({ src, alt, className }: TutorialImageProps) {
  return (
    <div className={cn("y2k-image-stub-wrap", className)}>
      <div className="y2k-image-stub">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} />
        ) : null}
      </div>
      <span className="y2k-image-handle y2k-image-handle-tl" aria-hidden="true" />
      <span className="y2k-image-handle y2k-image-handle-tr" aria-hidden="true" />
      <span className="y2k-image-handle y2k-image-handle-bl" aria-hidden="true" />
      <span className="y2k-image-handle y2k-image-handle-br" aria-hidden="true" />
    </div>
  );
}
