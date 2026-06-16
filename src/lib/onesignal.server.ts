// Server-only OneSignal sender. Imported lazily from .functions.ts handlers.
const ONESIGNAL_APP_ID = "24ce68cf-30f4-4422-a391-11b83eeb05bc";
const SITE_ORIGIN = "https://weekly-huddle-app.lovable.app";

interface SendArgs {
  /** Supabase user IDs to target (mapped to OneSignal external_id) */
  externalUserIds: string[];
  headings: string;
  contents: string;
  /** Path or absolute URL. Relative paths are resolved against the production origin. */
  url?: string;
  data?: Record<string, unknown>;
  /** Collapse key — newer notifications replace older ones with the same key */
  collapseId?: string;
  /** Send only to native app subscriptions so taps open the Median APK, not browser web push. */
  nativeOnly?: boolean;
}

function normalizeRestApiKey(value: string) {
  return value
    .trim()
    .replace(/^Authorization:\s*/i, "")
    .replace(/^Key\s+/i, "")
    .trim();
}

function absoluteUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return SITE_ORIGIN + (url.startsWith("/") ? url : "/" + url);
}

export async function sendOneSignalToUsers(args: SendArgs): Promise<{
  ok: boolean;
  status: number;
  body: string;
  recipients?: number;
  invalidAliases?: number;
}> {
  const rawKey = process.env.ONESIGNAL_REST_API_KEY;
  const key = rawKey ? normalizeRestApiKey(rawKey) : "";
  if (!key) throw new Error("ONESIGNAL_REST_API_KEY missing");
  const externalUserIds = [...new Set(args.externalUserIds.filter(Boolean))];
  if (externalUserIds.length === 0) {
    return { ok: true, status: 0, body: "no-targets", recipients: 0 };
  }

  const launchUrl = args.url ? absoluteUrl(args.url) : undefined;

  const payload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: { external_id: externalUserIds },
    target_channel: "push",
    headings: { en: args.headings },
    contents: { en: args.contents },
    priority: 10,
    ttl: 86400,
    chrome_web_icon: `${SITE_ORIGIN}/favicon.ico`,
    chrome_web_badge: `${SITE_ORIGIN}/favicon.ico`,
  };
  if (args.nativeOnly) {
    payload.isAndroid = true;
    payload.isIos = true;
    payload.isAnyWeb = false;
  }
  // Median opens tapped notifications from Additional Data `targetUrl` inside the
  // app's webview. Any top-level `url`/`web_url`/`app_url` on the OneSignal payload
  // causes the OS to open the link externally in the browser instead — so we
  // intentionally omit them and rely on `targetUrl` only.
  const notificationData: Record<string, unknown> = { ...(args.data ?? {}) };
  if (launchUrl) notificationData.targetUrl = launchUrl;
  if (Object.keys(notificationData).length > 0) payload.data = notificationData;
  if (args.collapseId) {
    payload.web_push_topic = args.collapseId;
    payload.collapse_id = args.collapseId;
  }

  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${key}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.text();

  let recipients: number | undefined;
  let invalidAliases: number | undefined;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.recipients === "number") recipients = parsed.recipients;
    const ia = parsed?.errors?.invalid_aliases?.external_ids;
    if (Array.isArray(ia)) invalidAliases = ia.length;
  } catch {
    // body wasn't JSON
  }

  if (!res.ok) {
    console.error("[OneSignal] send failed", res.status, body, { keyLength: key.length });
  } else if (invalidAliases) {
    console.warn("[OneSignal] some recipients had no subscription", { invalidAliases, recipients });
  }

  // Only treat HTTP failure as failure. invalid_aliases is a partial-delivery warning,
  // not a failure — other recipients still received the push.
  return { ok: res.ok, status: res.status, body, recipients, invalidAliases };
}
