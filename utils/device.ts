export const isDesktop = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(min-width: 1024px)").matches;
};

export const isIOS = (userAgent?: string) => {
  const ua =
    userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /iPad|iPhone|iPod/i.test(ua);
};
