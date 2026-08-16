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
