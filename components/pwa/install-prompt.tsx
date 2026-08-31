"use client"

import { useState, useEffect } from "react"
import { useI18n } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, CheckCircle, Smartphone } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWAInstallPrompt() {
  const { t } = useI18n()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // 检测是否已安装
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    // 检测移动设备
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))

    // 监听安装提示
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setIsInstalled(true)
    }

    setDeferredPrompt(null)
  }

  // 已安装或不支持 PWA 时不显示
  if (isInstalled || !isMobile) {
    return null
  }

  return (
    <Card className="shadow-vercel-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5" />
          {t("pwa.installTitle")}
        </CardTitle>
        <CardDescription>
          {t("pwa.installDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="size-4 text-success" />
            <span>{t("pwa.offline")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="size-4 text-success" />
            <span>{t("pwa.faster")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="size-4 text-success" />
            <span>{t("pwa.homeIcon")}</span>
          </div>

          <Button onClick={handleInstall} className="w-full" size="lg">
            <Download className="mr-2 size-4" />
            {t("pwa.installButton")}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {t("pwa.manual")}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
