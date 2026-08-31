"use client"

import { useAdminCheck } from "@/lib/hooks/use-admin-check"
import { useAccount } from "wagmi"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Shield } from "lucide-react"
import Link from "next/link"
import { WalletConnect } from "@/components/blockchain/wallet-connect"
import { useI18n } from "@/lib/i18n"

interface AdminGuardProps {
  children: React.ReactNode
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const { t } = useI18n()
  const { isConnected } = useAccount()
  const { isAdmin, isLoading } = useAdminCheck()

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="mx-auto max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {t("admin.loadingStatus")}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5" />
              {t("admin.accessRequired")}
            </CardTitle>
            <CardDescription>
              {t("admin.connectToAccess")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WalletConnect />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Alert variant="destructive" className="mx-auto max-w-md">
          <AlertCircle className="size-4" />
          <AlertTitle>{t("admin.accessDenied")}</AlertTitle>
          <AlertDescription className="mb-4">
            {t("admin.notAuthorized")}
          </AlertDescription>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">{t("admin.returnHome")}</Link>
          </Button>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}
