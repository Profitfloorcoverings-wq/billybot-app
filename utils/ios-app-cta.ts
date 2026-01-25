const IOS_APP_CTA_KEY = "bb_hide_ios_app_cta";

export const isIosAppCtaDismissed = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(IOS_APP_CTA_KEY) === "true";
};

export const setIosAppCtaDismissed = (value: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(IOS_APP_CTA_KEY, value ? "true" : "false");
};
