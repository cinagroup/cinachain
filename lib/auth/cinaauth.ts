import * as oauth from "oauth4webapi"

import {
  rewriteProxiedEndpoints,
  shouldFallbackScope,
  stripOfflineAccess,
} from "@/lib/auth/cinaauth-endpoints"
import { env } from "@/env.mjs"

/**
 * CinaAuth OIDC client (public client, Authorization Code + PKCE).
 *
 * CinaChain is statically exported (no Next.js server runtime), so sign-in
 * follows the public-client flow from the official cinaauth OIDC demo:
 * discovery → authorize redirect (PKCE S256 + state + nonce) → token
 * exchange on /auth/callback → userinfo. The session (ID/access/refresh
 * tokens + userinfo) is persisted in localStorage; the authorization
 * transaction lives in sessionStorage and expires after 10 minutes.
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
const CINAAUTH_SCOPE = "openid profile email offline_access"

export interface CinaauthUser {
  sub: string
  name?: string
  email?: string
  emailVerified?: boolean
  picture?: string
}

export interface CinaauthSession {
  user: CinaauthUser
  accessToken: string
  idToken: string
  refreshToken?: string
  tokenType: string
  expiresAt: number
  issuedAt: number
}

interface CinaauthTransaction {
  codeVerifier: string
  state: string
  nonce: string
  redirectUri: string
  returnTo: string
  /** Space-separated scope actually requested on this attempt. */
  scope: string
  /** True when the request already dropped server-rejected scopes. */
  scopeFallback: boolean
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
    apiBaseUrl:
      env.NEXT_PUBLIC_CINAAUTH_API_BASE_URL || `${base}/api/auth`,
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
      if (
        !metadata.token_endpoint_auth_methods_supported?.includes("none")
      ) {
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

function sanitizeReturnTo(value: string): string {
  // Only same-site relative paths — never protocol-relative or absolute URLs.
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard"
  return value
}

function saveTransaction(transaction: CinaauthTransaction) {
  sessionStorage.setItem(
    CINAAUTH_TRANSACTION_KEY,
    JSON.stringify(transaction)
  )
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
    if (!parsed?.user?.sub || !parsed.accessToken) {
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

/**
 * Redirects the browser to the CinaAuth authorization endpoint. The browser
 * leaves the app; the response is handled on /auth/callback.
 *
 * `scope` defaults to the configured scope; the callback path passes a
 * reduced scope when the server rejected `offline_access` (the developer
 * console does not check it by default when registering a client).
 */
export async function beginCinaauthLogin(
  returnTo = "/dashboard",
  scope?: string
) {
  const config = getCinaauthConfig()
  if (!config.clientId) {
    throw new Error(
      "CinaAuth sign-in is not configured. Set NEXT_PUBLIC_CINAAUTH_CLIENT_ID."
    )
  }
  const requestedScope = scope ?? config.scope
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
  authorizeUrl.searchParams.set("scope", requestedScope)
  authorizeUrl.searchParams.set("code_challenge", codeChallenge)
  authorizeUrl.searchParams.set("code_challenge_method", "S256")
  authorizeUrl.searchParams.set("state", state)
  authorizeUrl.searchParams.set("nonce", nonce)

  saveTransaction({
    codeVerifier,
    state,
    nonce,
    redirectUri: config.redirectUri,
    returnTo: sanitizeReturnTo(returnTo),
    scope: requestedScope,
    scopeFallback: requestedScope !== config.scope,
    createdAt: Date.now(),
  })
  window.location.assign(authorizeUrl.href)
}

/**
 * Exchanges the authorization code on the callback page for tokens and
 * userinfo, persists the session, and returns where to send the user back.
 *
 * When the server rejects `offline_access` (the developer console does not
 * check it by default), the login automatically restarts once without the
 * rejected scopes and `{ restarted: true }` is returned — the caller should
 * keep waiting, the browser is being redirected again.
 */
export async function completeCinaauthLogin(): Promise<
  | { session: CinaauthSession; returnTo: string }
  | { restarted: true }
> {
  const config = getCinaauthConfig()
  const transaction = takeTransaction()
  if (!transaction || transaction.redirectUri !== config.redirectUri) {
    throw new Error("The sign-in attempt is missing or expired. Try again.")
  }

  const authorizationServer = await discoverCinaauth()
  const client = getClient(config)
  let parameters: URLSearchParams
  try {
    parameters = oauth.validateAuthResponse(
      authorizationServer,
      client,
      new URL(window.location.href),
      transaction.state
    )
  } catch (cause) {
    if (shouldFallbackScope(cause, transaction)) {
      await beginCinaauthLogin(
        transaction.returnTo,
        stripOfflineAccess(transaction.scope)
      )
      return { restarted: true }
    }
    throw cause
  }
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

  if (!tokens.refresh_token) {
    // Without offline_access no refresh token is minted; sessions then last
    // only as long as the access token (~1h). Enable offline_access for the
    // client in the CinaAuth developer console to restore renewal.
    console.info(
      "[cinachain] CinaAuth issued no refresh token — sessions will expire with the access token. Enable the offline_access scope for this OAuth client in the developer console."
    )
  }

  const session: CinaauthSession = {
    user: userinfoClaimsToUser(userinfo),
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    issuedAt: Date.now(),
  }
  saveCinaauthSession(session)
  return { session, returnTo: sanitizeReturnTo(transaction.returnTo) }
}

/**
 * Uses the refresh token to obtain fresh access tokens. Returns null when
 * no refresh token is available; throws when the grant is rejected (the
 * caller should then drop the session).
 */
export async function refreshCinaauthSession(
  session: CinaauthSession
): Promise<CinaauthSession | null> {
  if (!session.refreshToken) return null
  const config = getCinaauthConfig()
  const authorizationServer = await discoverCinaauth()
  const client = getClient(config)
  const response = await oauth.refreshTokenGrantRequest(
    authorizationServer,
    client,
    oauth.None(),
    session.refreshToken
  )
  const tokens = await oauth.processRefreshTokenResponse(
    authorizationServer,
    client,
    response
  )
  const refreshed: CinaauthSession = {
    ...session,
    accessToken: tokens.access_token,
    idToken: tokens.id_token ?? session.idToken,
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    tokenType: tokens.token_type,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    issuedAt: Date.now(),
  }
  saveCinaauthSession(refreshed)
  return refreshed
}

/**
 * Clears the local session and redirects through the CinaAuth end-session
 * endpoint (single sign-out). Falls back to a local navigation when the
 * end-session endpoint is unavailable.
 */
export async function endCinaauthSession(session: CinaauthSession | null) {
  const config = getCinaauthConfig()
  clearCinaauthSession()
  let endSessionEndpoint: string | undefined
  try {
    const authorizationServer = await discoverCinaauth()
    endSessionEndpoint = authorizationServer.end_session_endpoint
  } catch {
    endSessionEndpoint = undefined
  }
  if (endSessionEndpoint && session?.idToken) {
    const endSessionUrl = new URL(endSessionEndpoint)
    endSessionUrl.searchParams.set("id_token_hint", session.idToken)
    endSessionUrl.searchParams.set(
      "post_logout_redirect_uri",
      config.postLogoutRedirectUri
    )
    window.location.assign(endSessionUrl.href)
    return
  }
  window.location.assign("/")
}
