type QrCodeProps = {
  value: string;
  size?: number;
  className?: string;
};

const QR_SERVICE_BASE = "https://chart.googleapis.com/chart";

export default function QrCode({ value, size = 140, className }: QrCodeProps) {
  const encoded = encodeURIComponent(value);
  const src = `${QR_SERVICE_BASE}?cht=qr&chs=${size}x${size}&chl=${encoded}`;

  return (
    <img
      src={src}
      alt="QR code"
      width={size}
      height={size}
      className={`rounded-xl bg-white p-2 ${className ?? ""}`.trim()}
      loading="lazy"
    />
  );
}
