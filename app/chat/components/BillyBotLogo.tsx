import { useId } from "react";

export type BillyBotLogoProps = {
  className?: string;
};

export default function BillyBotLogo({ className }: BillyBotLogoProps) {
  const gid = useId();
  const gradientId = `tbBlue-${gid}`;

  return (
    <svg
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="66" r="16" fill="none" stroke={`url(#${gradientId})`} strokeWidth="10" />
      <g fill={`url(#${gradientId})`}>
        <rect x="45" y="34" width="6" height="14" rx="3" />
        <rect x="45" y="34" width="6" height="14" rx="3" transform="rotate(45 48 66)" />
        <rect x="45" y="34" width="6" height="14" rx="3" transform="rotate(90 48 66)" />
        <rect x="45" y="34" width="6" height="14" rx="3" transform="rotate(135 48 66)" />
        <rect x="45" y="34" width="6" height="14" rx="3" transform="rotate(180 48 66)" />
        <rect x="45" y="34" width="6" height="14" rx="3" transform="rotate(225 48 66)" />
        <rect x="45" y="34" width="6" height="14" rx="3" transform="rotate(270 48 66)" />
        <rect x="45" y="34" width="6" height="14" rx="3" transform="rotate(315 48 66)" />
      </g>
      <circle cx="48" cy="66" r="8" fill="#0B0F1A" />
      <path
        d="M20 52c0-15 12-26 28-26s26 10 28 24v8H20v-6z"
        fill={`url(#${gradientId})`}
        stroke="#1E3A8A"
        strokeWidth="2"
      />
      <path d="M44 28h12a3 3 0 0 1 3 3v4H44z" fill="#1E3A8A" />
      <rect x="62" y="54" width="22" height="6" rx="3" fill="#1E3A8A" />
    </svg>
  );
}
