export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[var(--bg1)] px-6 py-10 text-[var(--text)]">
      <div className="mx-auto w-full max-w-4xl">{children}</div>
    </div>
  );
}
