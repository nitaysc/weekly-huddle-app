// OneSignal Web SDK client wrapper.
// App ID is public (safe in client). REST API Key is server-only and lives in secrets.
export const ONESIGNAL_APP_ID = "24ce68cf-30f4-4422-a391-11b83eeb05bc";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(os: any) => void>;
    OneSignal?: any;
    median?: any;
  }
}

/** True when running inside the Median native wrapper. */
function isMedianApp(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.median !== "undefined") return true;
  const ua = navigator.userAgent || "";
  return /median|gonative/i.test(ua);
}

let injected = false;

/** Inject the OneSignal SDK script. Safe to call multiple times. */
export function initOneSignal() {
  if (typeof window === "undefined") return;
  if (injected) return;
  injected = true;

  // Inside the Median wrapper, the native OneSignal plugin handles everything.
  // Loading the web SDK would create a second, conflicting subscription.
  if (isMedianApp()) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });
    } catch (err) {
      console.warn("[OneSignal] init skipped:", err);
    }
  });

  const s = document.createElement("script");
  s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  s.defer = true;
  document.head.appendChild(s);
}

/** Tag the current user so server-side sends can target them. */
export function identifyOneSignalUser(userId: string, crewId?: string | null) {
  if (typeof window === "undefined") return;

  // Median native OneSignal plugin: set externalId via JS Bridge so the
  // native subscription is reachable via include_aliases.external_id.
  if (isMedianApp()) {
    try {
      const m = window.median;
      // The Median bridge exposes onesignal.externalUser.set
      m?.onesignal?.externalUser?.set?.({ externalId: userId });
      if (crewId) m?.onesignal?.tags?.setTags?.({ crew_id: crewId });
    } catch (err) {
      console.warn("[Median OneSignal] identify failed:", err);
    }
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.login(userId);
      if (crewId) {
        await OneSignal.User.addTag("crew_id", crewId);
      }
    } catch (err) {
      console.warn("[OneSignal] identify failed:", err);
    }
  });
}

export async function requestPushPermission() {
  if (typeof window === "undefined") return false;
  return await new Promise<boolean>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        const granted = await OneSignal.Notifications.requestPermission();
        resolve(!!granted);
      } catch {
        resolve(false);
      }
    });
  });
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}
