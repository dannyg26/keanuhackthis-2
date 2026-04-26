import logoSrc from "../assets/logo.jpg";

interface LogoProps {
  size?: number;
  withText?: boolean;
  textClassName?: string;
  inverted?: boolean;
}

export default function Logo({ size = 40, withText = true, textClassName, inverted }: LogoProps) {
  const titleColor = inverted ? "text-white" : "text-ink-900";
  const subtitleColor = inverted ? "text-blush-300" : "text-brand-600";

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className="relative shrink-0 rounded-2xl bg-white shadow-soft ring-1 ring-blush-100 overflow-hidden"
        style={{ width: size, height: size }}
      >
        <img
          src={logoSrc}
          alt="Clarity mascot"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      {withText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-display font-extrabold tracking-tight ${titleColor} ${textClassName ?? "text-lg"}`}>
            Clarity
          </span>
          <span className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${subtitleColor}`}>
            Healthcare Copilot
          </span>
        </div>
      )}
    </div>
  );
}
