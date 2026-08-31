"use client"

import { ButtonSIWELogin } from "@/integrations/siwe/components/button-siwe-login"
import { ButtonSIWELogout } from "@/integrations/siwe/components/button-siwe-logout"
import { IsSignedIn } from "@/integrations/siwe/components/is-signed-in"
import { IsSignedOut } from "@/integrations/siwe/components/is-signed-out"

export function SiweWorkbench() {
  return (
    <>
      <IsSignedIn>
        <ButtonSIWELogout />
      </IsSignedIn>
      <IsSignedOut>
        <ButtonSIWELogin />
      </IsSignedOut>
    </>
  )
}
