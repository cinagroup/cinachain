# Sign-In with Ethereum - CinaChain Integration

Demo components for the [Sign-In with Ethereum](https://login.xyz/) showcase
page (`/integration/sign-in-with-ethereum`). Site sign-in itself is handled
by CinaAuth SSO (`lib/auth/cinaauth.ts`); wallet connection (Reown AppKit)
is independent and used for on-chain actions.

## Scope

- **UX-only**: the SIWE session lives in `localStorage`
  (`cinachain-siwe-session`, 24h). Signatures are verified client-side with
  viem (`lib/siwe-verify.ts` — EOA, EIP-1271 and EIP-6492 smart accounts).
  There is no server-side authentication here; privileged operations rely on
  the contracts' own access control.
- The one production use of wallet-signature auth is the `/settings` API key
  flow, which posts a SIWE-style binding message to the billing worker for
  server-side verification (`lib/hooks/use-api-keys.ts`).

## API

### Hook

`useSiwe()` (from `lib/hooks/use-siwe.ts`)
Returns `{ session, isAuthenticated, isLoading, signInError, signIn, signOut }`.
`signIn()` builds an EIP-4361 message, requests a wallet signature and
stores the session only after the signature verifies.

### Components

`IsSignedIn()` / `IsSignedOut()`
Conditionally render children based on the SIWE session.

`ButtonSIWELogin()` / `ButtonSIWELogout()`
Buttons that trigger `useSiwe().signIn()` / `signOut()`.

## File Structure

```
integrations/siwe
├─ components/
│  ├─ button-siwe-login.tsx
│  ├─ button-siwe-logout.tsx
│  ├─ is-signed-in.tsx
│  ├─ is-signed-out.tsx
├─ README.md
```
