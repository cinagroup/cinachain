/**
 * Rewrites CinaAuth OIDC discovery endpoints for the same-origin proxy.
 *
 * Kept dependency-free so it is unit-testable in isolation (see
 * lib/__tests__/cinaauth-proxy-endpoints.test.ts).
 */

// Browser-fetched endpoints routed through the proxy. issuer, authorize and
// end-session stay on the issuer (JWT `iss` validation + top-level
// navigation must not be proxied).
const PROXIED_ENDPOINT_FIELDS = [
  "token_endpoint",
  "userinfo_endpoint",
  "jwks_uri",
  "revocation_endpoint",
  "introspection_endpoint",
  "registration_endpoint",
  "pushed_authorization_request_endpoint",
]

/**
 * Rewrites the issuer-origin OIDC endpoints of a discovery document to the
 * same-origin proxy base. Values not under `${issuer}/api/auth` are left
 * untouched.
 */
export function rewriteProxiedEndpoints(
  metadata: Record<string, unknown>,
  issuer: string,
  apiBaseUrl: string
): Record<string, unknown> {
  const upstreamPrefix = `${issuer}/api/auth`
  for (const field of PROXIED_ENDPOINT_FIELDS) {
    const value = metadata[field]
    if (typeof value === "string" && value.startsWith(upstreamPrefix)) {
      metadata[field] = `${apiBaseUrl}${value.slice(upstreamPrefix.length)}`
    }
  }
  return metadata
}

export function stripOfflineAccess(scope: string): string {
  return scope
    .split(" ")
    .filter((item) => item && item !== "offline_access")
    .join(" ")
}

export interface ScopeFallbackTransaction {
  scope: string
  scopeFallback: boolean
}

/**
 * True when the authorize step rejected `offline_access` (the CinaAuth
 * developer console does not check it by default) and the login has not
 * already been retried without it. `cause` is duck-typed against the OAuth
 * error shape (`error` / `error_description`) to stay dependency-free.
 */
export function shouldFallbackScope(
  cause: unknown,
  transaction: ScopeFallbackTransaction
): boolean {
  if (transaction.scopeFallback) return false
  if (!transaction.scope.includes("offline_access")) return false
  const maybeError = cause as { error?: unknown; error_description?: unknown }
  return (
    maybeError?.error === "invalid_scope" &&
    typeof maybeError?.error_description === "string" &&
    maybeError.error_description.includes("offline_access")
  )
}
