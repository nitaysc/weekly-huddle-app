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

const WEB_PUSH_HOST = "weekly-huddle-app.lovable.app";
let lastIdentifiedUser: { userId: string; crewId?: string | null } | null = null;

/** True when running inside the Median native wrapper. */
function isMedianApp(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.median !== "undefined") return true;
  const ua = navigator.userAgent || "";
  return /median|gonative/i.test(ua);
}

function canUseWebPushHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === WEB_PUSH_HOST || window.location.hostname === "localhost";
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

  // OneSignal web push is bound to the published domain configured in OneSignal.
  // Preview/editor domains throw "Can only be used on..." and prevent clean setup.
  if (!canUseWebPushHost()) return;

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
  lastIdentifiedUser = { userId, crewId };

  // Median native OneSignal plugin: login() sets the externalId used by server sends.
  if (isMedianApp()) {
    try {
      const m = window.median;
      m?.onesignal?.login?.(userId);
      m?.onesignal?.externalUserId?.set?.({ externalId: userId });
      if (crewId) m?.onesignal?.tags?.setTags?.({ tags: { crew_id: crewId } });
    } catch (err) {
      console.warn("[Median OneSignal] identify failed:", err);
    }
    return;
  }

  if (!canUseWebPushHost()) return;
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

export function logoutOneSignalUser() {
  if (typeof window === "undefined") return;
  lastIdentifiedUser = null;

  if (isMedianApp()) {
    try {
      window.median?.onesignal?.logout?.();
      window.median?.onesignal?.externalUserId?.remove?.();
    } catch (err) {
      console.warn("[Median OneSignal] logout failed:", err);
    }
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.logout();
    } catch {}
  });
}

export async function requestPushPermission() {
  if (typeof window === "undefined") return false;

  if (isMedianApp()) {
    try {
      const os = window.median?.onesignal;
      os?.userPrivacyConsent?.grant?.();
      os?.register?.();
      if (lastIdentifiedUser) {
        os?.login?.(lastIdentifiedUser.userId);
        os?.externalUserId?.set?.({ externalId: lastIdentifiedUser.userId });
        if (lastIdentifiedUser.crewId) os?.tags?.setTags?.({ tags: { crew_id: lastIdentifiedUser.crewId } });
      }
      return true;
    } catch (err) {
      console.warn("[Median OneSignal] permission request failed:", err);
      return false;
    }
  }

  if (!canUseWebPushHost()) return false;
  return await new Promise<boolean>((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        const granted = await OneSignal.Notifications.requestPermission();
        if (granted && lastIdentifiedUser) {
          await OneSignal.login(lastIdentifiedUser.userId);
          if (lastIdentifiedUser.crewId) await OneSignal.User.addTag("crew_id", lastIdentifiedUser.crewId);
        }
        resolve(!!granted);
      } catch {
        resolve(false);
      }
    });
  });
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (isMedianApp()) return "default";
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}
