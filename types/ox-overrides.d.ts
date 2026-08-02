/**
 * Module declaration overrides for transitive dependencies with type issues.
 *
 * The `ox` library (a transitive dep of viem) ships .ts source files that
 * sometimes have type regressions across minor versions. Since we can't
 * control upstream, we declare the problematic module as `any` to prevent
 * the Next.js build from failing on node_modules type errors.
 *
 * This does NOT affect runtime — ox is only used internally by viem.
 */
declare module "ox/tempo/KeyAuthorization" {
  const KeyAuthorization: unknown
  export default KeyAuthorization
}
