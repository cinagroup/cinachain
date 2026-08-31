import { env } from "@/env.mjs"
import * as oauth from "oauth4webapi"

import { rewriteProxiedEndpoints } from "@/lib/auth/cinaauth-endpoints"
import {
  CINAAUTH_POPUP_MARKER_KEY,
  CINAAUTH_POPUP_NAME_PREFIX,
  launchCinaauthPopup,
  type CinaauthLoginLaunch,
} from "@/lib/auth/cinaauth-popup"

/**
 * CinaAuth OIDC client (public client, Authorization Code + PKCE).
 *
 * CinaChain is statically exported (no Next.js server runtime), so sign-in
 * follows the public-client flow from the official cinaauth OIDC demo:
 * discovery → authorize redirect (PKCE S256 + state + nonce) → token
 * exchange on /auth/callback → userinfo. Issued tokens are used only while
 * processing the callback and are never persisted; localStorage contains a
 * non-sensitive profile snapshot and its short access-token expiry. The
 * authorization transaction lives in sessionStorage and expires after 10
 * minutes.
 *
 * The CinaAuth worker only emits CORS headers for its first-party origins,
 * so browser-side fetches (discovery, token, userinfo, JWKS) are routed
 * through the same-origin proxy worker at /api/auth/* (workers/auth-proxy).
 * The authorize and end-session endpoints are top-level navigations and go
 * to the issuer directly.
 *
 * Wallet connection (Reown AppKit) is intentionally independent of this
 * sign-in: it stays available for on-chain actions (mint, exchange, ...).
 */

export const CINAAUTH_SESSION_KEY = "cinachain-auth-session"
export const CINAAUTH_TRANSACTION_KEY = "cinachain-oidc-transaction"
export const CINAAUTH_CALLBACK_PATH = "/auth/callback"

const TRANSACTION_MAX_AGE_MS = 10 * 60 * 1000
const CINAAUTH_SCOPE = "openid profile email"

export interface CinaauthUser {
  sub: string
  name?: string
  email?: string
  emailVerified?: boolean
  picture?: string
}

export interface CinaauthSession {
  user: CinaauthUser
  expiresAt: number
  issuedAt: number
}

interface CinaauthTransaction {
  codeVerifier: string
  state: string
  nonce: string
  redirectUri: string
  /** High-entropy correlation id for this popup launch. */
  attemptId: string
  createdAt: number
}

export interface CinaauthConfig {
  issuer: string
  clientId: string
  redirectUri: string
  postLogoutRedirectUri: string
  scope: string
  /** Same-origin base for proxied OIDC API calls (no trailing slash). */
  apiBaseUrl: string
}

export function isCinaauthConfigured(): boolean {
  return env.NEXT_PUBLIC_CINAAUTH_CLIENT_ID.length > 0
}

export function getCinaauthConfig(): CinaauthConfig {
  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined
  const base = origin ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  return {
    issuer: env.NEXT_PUBLIC_CINAAUTH_ISSUER,
    clientId: env.NEXT_PUBLIC_CINAAUTH_CLIENT_ID,
    redirectUri: `${base}${CINAAUTH_CALLBACK_PATH}`,
    postLogoutRedirectUri: base,
    scope: CINAAUTH_SCOPE,
    apiBaseUrl: env.NEXT_PUBLIC_CINAAUTH_API_BASE_URL || `${base}/api/auth`,
  }
}

function getClient(config: CinaauthConfig): oauth.Client {
  return {
    client_id: config.clientId,
    token_endpoint_auth_method: "none",
    redirect_uris: [config.redirectUri],
  }
}

let authorizationServer: oauth.AuthorizationServer | null = null
let discoveryPromise: Promise<oauth.AuthorizationServer> | null = null

export async function discoverCinaauth(): Promise<oauth.AuthorizationServer> {
  if (authorizationServer) return authorizationServer
  if (!discoveryPromise) {
    discoveryPromise = (async () => {
      const config = getCinaauthConfig()
      const issuer = new URL(config.issuer)
      const discoveryUrl = `${config.apiBaseUrl}/.well-known/openid-configuration`
      const response = await fetch(discoveryUrl, {
        headers: { Accept: "application/json" },
      })
      const metadata = await oauth.processDiscoveryResponse(issuer, response)
      if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
        throw new Error("CinaAuth OIDC discovery is missing endpoints")
      }
      if (!metadata.token_endpoint_auth_methods_supported?.includes("none")) {
        throw new Error("CinaAuth does not advertise public client support")
      }
      rewriteProxiedEndpoints(
        metadata as unknown as Record<string, unknown>,
        config.issuer,
        config.apiBaseUrl
      )
      authorizationServer = metadata
      return metadata
    })().catch((cause: unknown) => {
      discoveryPromise = null
      throw cause
    })
  }
  return discoveryPromise
}

function toErrorMessage(error: unknown): string {
  if (error instanceof oauth.AuthorizationResponseError) {
    return error.error_description || `Authorization failed: ${error.error}`
  }
  if (error instanceof oauth.ResponseBodyError) {
    return error.error_description || `Token request failed: ${error.error}`
  }
  if (error instanceof Error && error.message) return error.message
  return "The sign-in request failed."
}

export { toErrorMessage as toCinaauthErrorMessage }

function saveTransaction(
  transaction: CinaauthTransaction,
  storage: Pick<Storage, "setItem"> = sessionStorage
) {
  storage.setItem(CINAAUTH_TRANSACTION_KEY, JSON.stringify(transaction))
}

function takeTransaction(): CinaauthTransaction | null {
  const raw = sessionStorage.getItem(CINAAUTH_TRANSACTION_KEY)
  sessionStorage.removeItem(CINAAUTH_TRANSACTION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CinaauthTransaction
    if (Date.now() - parsed.createdAt > TRANSACTION_MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function loadCinaauthSession(): CinaauthSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CINAAUTH_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CinaauthSession
    if (!parsed?.user?.sub || !Number.isFinite(parsed.expiresAt)) {
      localStorage.removeItem(CINAAUTH_SESSION_KEY)
      return null
    }
    if (parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(CINAAUTH_SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(CINAAUTH_SESSION_KEY)
    return null
  }
}

export function saveCinaauthSession(session: CinaauthSession) {
  localStorage.setItem(CINAAUTH_SESSION_KEY, JSON.stringify(session))
}

export function clearCinaauthSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CINAAUTH_SESSION_KEY)
  }
}

function userinfoClaimsToUser(
  claims: Record<string, unknown> & { sub: string }
): CinaauthUser {
  const optionalString = (value: unknown) =>
    typeof value === "string" && value.length > 0 ? value : undefined
  return {
    sub: claims.sub,
    name: optionalString(claims.name),
    email: optionalString(claims.email),
    emailVerified:
      typeof claims.email_verified === "boolean"
        ? claims.email_verified
        : undefined,
    picture: optionalString(claims.picture),
  }
}

async function createCinaauthAuthorization(attemptId: string) {
  const config = getCinaauthConfig()
  if (!config.clientId) {
    throw new Error(
      "CinaAuth sign-in is not configured. Set NEXT_PUBLIC_CINAAUTH_CLIENT_ID."
    )
  }
  const authorizationServer = await discoverCinaauth()
  const codeVerifier = oauth.generateRandomCodeVerifier()
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier)
  const state = oauth.generateRandomState()
  const nonce = oauth.generateRandomNonce()

  const authorizeUrl = new URL(
    authorizationServer.authorization_endpoint as string
  )
  authorizeUrl.searchParams.set("client_id", config.clientId)
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri)
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("scope", config.scope)
  authorizeUrl.searchParams.set("code_challenge", codeChallenge)
  authorizeUrl.searchParams.set("code_challenge_method", "S256")
  authorizeUrl.searchParams.set("state", state)
  authorizeUrl.searchParams.set("nonce", nonce)

  const transaction: CinaauthTransaction = {
    codeVerifier,
    state,
    nonce,
    redirectUri: config.redirectUri,
    attemptId,
    createdAt: Date.now(),
  }

  return { authorizeUrl, transaction }
}

function popupFeatures() {
  const width = 480
  const height = 720
  const left = Math.max(
    0,
    Math.round(window.screenX + (window.outerWidth - width) / 2)
  )
  const top = Math.max(
    0,
    Math.round(window.screenY + (window.outerHeight - height) / 2)
  )
  return [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",")
}

/**
 * Opens CinaAuth in a dedicated window. The blank window is created before
 * the first await so browsers treat it as a direct user gesture. Its OIDC
 * transaction is copied into that window's same-origin sessionStorage before
 * navigation; tokens are never sent through window messaging.
 */
export async function beginCinaauthPopupLogin(): Promise<CinaauthLoginLaunch> {
  const popupName = `${CINAAUTH_POPUP_NAME_PREFIX}${crypto.randomUUID()}`
  const attemptId = popupName.slice(CINAAUTH_POPUP_NAME_PREFIX.length)
  return launchCinaauthPopup({
    attemptId,
    openPopup: () => window.open("about:blank", popupName, popupFeatures()),
    configurePopup: async (popup) => {
      popup.document.title = "CinaSeek Accounts"
      const { authorizeUrl, transaction } =
        await createCinaauthAuthorization(attemptId)
      if (popup.closed) {
        throw new Error(
          "The CinaSeek sign-in window was closed before sign-in started."
        )
      }

      saveTransaction(transaction, popup.sessionStorage)
      popup.sessionStorage.setItem(CINAAUTH_POPUP_MARKER_KEY, attemptId)
      // The callback uses BroadcastChannel/storage events instead of opener,
      // preventing the cross-origin provider from navigating the parent tab.
      popup.opener = null
      popup.location.replace(authorizeUrl.href)
      popup.focus()
    },
  })
}

/**
 * Exchanges the authorization code inside the popup callback, fetches
 * userinfo, and persists only the non-sensitive profile snapshot. The
 * per-attempt marker must match before any network request or session write.
 */
export async function completeCinaauthLogin(
  expectedAttemptId: string
): Promise<{
  session: CinaauthSession
  attemptId: string
}> {
  const config = getCinaauthConfig()
  const transaction = takeTransaction()
  if (
    !transaction ||
    transaction.redirectUri !== config.redirectUri ||
    transaction.attemptId !== expectedAttemptId
  ) {
    throw new Error("The sign-in attempt is missing or expired. Try again.")
  }

  const authorizationServer = await discoverCinaauth()
  const client = getClient(config)
  const parameters: URLSearchParams = oauth.validateAuthResponse(
    authorizationServer,
    client,
    new URL(window.location.href),
    transaction.state
  )
  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    authorizationServer,
    client,
    oauth.None(),
    parameters,
    transaction.redirectUri,
    transaction.codeVerifier
  )
  const tokens = await oauth.processAuthorizationCodeResponse(
    authorizationServer,
    client,
    tokenResponse,
    { expectedNonce: transaction.nonce, requireIdToken: true }
  )
  const claims = oauth.getValidatedIdTokenClaims(tokens)
  if (!claims?.sub || !tokens.id_token) {
    throw new Error("The ID token is missing required claims.")
  }

  const userInfoResponse = await oauth.userInfoRequest(
    authorizationServer,
    client,
    tokens.access_token
  )
  const userinfo = await oauth.processUserInfoResponse(
    authorizationServer,
    client,
    claims.sub,
    userInfoResponse
  )

  const session: CinaauthSession = {
    user: userinfoClaimsToUser(userinfo),
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    issuedAt: Date.now(),
  }
  saveCinaauthSession(session)
  return {
    session,
    attemptId: transaction.attemptId,
  }
}

/** Clears the local profile snapshot without retaining an ID token for RP logout. */
export function endCinaauthSession() {
  const config = getCinaauthConfig()
  clearCinaauthSession()
  window.location.assign(config.postLogoutRedirectUri)
}
