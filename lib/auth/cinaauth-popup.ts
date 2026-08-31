export const CINAAUTH_POPUP_CHANNEL = "cinachain-cinaauth"
export const CINAAUTH_POPUP_NAME_PREFIX = "cinachain-cinaauth-"
export const CINAAUTH_POPUP_MARKER_KEY = "cinachain-cinaauth-popup"

const CINAAUTH_POPUP_MESSAGE_SOURCE = "cinachain-cinaauth"

export type CinaauthPopupMessage =
  | {
      source: typeof CINAAUTH_POPUP_MESSAGE_SOURCE
      status: "success"
      attemptId: string
    }
  | {
      source: typeof CINAAUTH_POPUP_MESSAGE_SOURCE
      status: "error"
      attemptId: string
      message: string
    }

export type CinaauthLoginLaunch = {
  mode: "popup"
  popup: Window
  attemptId: string
}

interface LaunchCinaauthPopupOptions {
  attemptId: string
  configurePopup: (popup: Window) => Promise<void>
  openPopup: () => Window | null
}

/**
 * Keeps popup opening synchronous while leaving asynchronous authorization
 * setup independently testable. Login is intentionally popup-only: the
 * current page must never become an OAuth transition page.
 */
export async function launchCinaauthPopup({
  attemptId,
  configurePopup,
  openPopup,
}: LaunchCinaauthPopupOptions): Promise<CinaauthLoginLaunch> {
  const popup = openPopup()
  if (!popup) {
    throw new Error(
      "Your browser blocked the CinaSeek sign-in window. Allow pop-ups for this site and try again."
    )
  }

  try {
    await configurePopup(popup)
    return { mode: "popup", popup, attemptId }
  } catch (cause) {
    if (!popup.closed) popup.close()
    throw cause
  }
}

export function createCinaauthPopupMessage(
  status: "success",
  attemptId: string
): CinaauthPopupMessage
export function createCinaauthPopupMessage(
  status: "error",
  attemptId: string,
  message: string
): CinaauthPopupMessage
export function createCinaauthPopupMessage(
  status: "success" | "error",
  attemptId: string,
  message?: string
): CinaauthPopupMessage {
  if (status === "error") {
    return {
      source: CINAAUTH_POPUP_MESSAGE_SOURCE,
      status,
      attemptId,
      message: message || "The CinaSeek sign-in request failed.",
    }
  }
  return { source: CINAAUTH_POPUP_MESSAGE_SOURCE, status, attemptId }
}

const ATTEMPT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isCinaauthAttemptId(value: unknown): value is string {
  return typeof value === "string" && ATTEMPT_ID_PATTERN.test(value)
}

export function isCinaauthPopupMessage(
  value: unknown
): value is CinaauthPopupMessage {
  if (!value || typeof value !== "object") return false
  const message = value as Record<string, unknown>
  if (message.source !== CINAAUTH_POPUP_MESSAGE_SOURCE) return false
  if (!isCinaauthAttemptId(message.attemptId)) return false
  if (message.status === "success") return true
  return message.status === "error" && typeof message.message === "string"
}

export function isCinaauthPopupWindow(name: string): boolean {
  return name.startsWith(CINAAUTH_POPUP_NAME_PREFIX)
}

export function isCinaauthPopupContext(marker: string | null): marker is string {
  return isCinaauthAttemptId(marker)
}

export function publishCinaauthPopupMessage(message: CinaauthPopupMessage) {
  if (typeof BroadcastChannel === "undefined") return
  const channel = new BroadcastChannel(CINAAUTH_POPUP_CHANNEL)
  channel.postMessage(message)
  channel.close()
}
