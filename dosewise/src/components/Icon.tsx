import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const HomeIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" /><path d="M10 21V14h4v7" /></svg>
);

export const ShieldIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 3l8 4v6c0 4.4-3.4 7.5-8 8-4.6-.5-8-3.6-8-8V7l8-4z" /><path d="M9 12l2 2 4-4" /></svg>
);

export const PillIcon = (p: IconProps) => (
  <svg {...base} {...p}><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-30 12 12)" /><path d="M8.5 7.5l7 7" transform="rotate(-30 12 12)" /></svg>
);

export const ReceiptIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M5 3h14v18l-3-2-3 2-3-2-3 2-2-2V3z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></svg>
);

export const BookIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z" /><path d="M4 4v14a2 2 0 0 0 2 2" /></svg>
);

export const HeartPulseIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 12h4l2-4 4 8 2-4h6" /><path d="M20 8.5a4.5 4.5 0 0 0-8-2.8 4.5 4.5 0 0 0-8 2.8c0 5 8 9.5 8 9.5s.7-.4 1.7-1" /></svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M5 12l4 4L19 6" /></svg>
);

export const XIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M6 6l12 12" /><path d="M18 6l-12 12" /></svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M5 12h14" /><path d="M13 5l7 7-7 7" /></svg>
);

export const SparklesIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" /><path d="M19 16l.7 2.1L22 19l-2.3.9L19 22l-.7-2.1L16 19l2.3-.9z" /></svg>
);

export const AlertIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z" /></svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);

export const FlameIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 2c1 4 5 5 5 10a5 5 0 1 1-10 0c0-2 1-3 2-4-1 4 3 4 3 1 0-3-2-4 0-7z" /></svg>
);

export const UploadIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M5 20h14" /></svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
);

export const StethoscopeIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M6 3v5a4 4 0 0 0 8 0V3" /><path d="M10 14a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="10" r="2" /></svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M4 20V8" /><path d="M10 20V4" /><path d="M16 20v-8" /><path d="M22 20H2" /></svg>
);

export const SunIcon = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
);

export const CoffeeIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" /><path d="M17 9h2a3 3 0 0 1 0 6h-2" /><path d="M7 2v3M11 2v3M15 2v3" /></svg>
);

export const TagIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M20.6 13.4L13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" /></svg>
);

export const CopyIcon = (p: IconProps) => (
  <svg {...base} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
);

export const StoreIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 9l1.5-5h15L21 9" /><path d="M3 9v11h18V9" /><path d="M3 9c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3c0 2 1.5 3 3 3s3-1 3-3" /></svg>
);

export const DollarIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 3v18" /><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
);

export const MicIcon = (p: IconProps) => (
  <svg {...base} {...p}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /><path d="M9 21h6" /></svg>
);

export const MicOffIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 3l18 18" /><path d="M9 9v3a3 3 0 0 0 4.5 2.6" /><path d="M15 9.3V6a3 3 0 0 0-6-.6" /><path d="M5 11a7 7 0 0 0 11.5 5.4" /><path d="M19 11v1" /><path d="M12 18v3" /></svg>
);

export const VolumeIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M5 9v6h4l5 4V5L9 9z" /><path d="M16 9c1.5 1 1.5 5 0 6" /><path d="M19 6c3 2 3 10 0 12" /></svg>
);

export const CubeIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M12 3l9 5v8l-9 5-9-5V8z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v9" /></svg>
);

export const BodyIcon = (p: IconProps) => (
  <svg {...base} {...p}><circle cx="12" cy="5" r="2.5" /><path d="M12 8v6" /><path d="M7 11l5-1 5 1" /><path d="M9 21l1.5-7M15 21l-1.5-7" /></svg>
);

export const CameraIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="4" /></svg>
);

export const ScanIcon = (p: IconProps) => (
  <svg {...base} {...p}><path d="M3 8V5a2 2 0 0 1 2-2h3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M21 16v3a2 2 0 0 1-2 2h-3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M3 12h18" /></svg>
);
