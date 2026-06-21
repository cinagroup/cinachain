"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, useSignMessage } from "wagmi"
import { SiweMessage } from "siwe"

const SESSION_KEY = "cinachain-siwe-session"

interface SiweSession {
  address: string
  nonce: string
  message: string
  signature: string
  expirationTime: string
}

export function useSiwe() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [session, setSession] = useState<SiweSession | null>(null)
  const [loading, setLoading] = useState(false)

  // 从 localStorage 加载会话
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SESSION_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          // 检查是否过期
          if (new Date(parsed.expirationTime) > new Date()) {
            setSession(parsed)
          } else {
            localStorage.removeItem(SESSION_KEY)
          }
        } catch {
          localStorage.removeItem(SESSION_KEY)
        }
      }
    }
  }, [])

  // 登录
  const signIn = useCallback(async () => {
    if (!address) return

    setLoading(true)
    try {
      // 生成 nonce
      const nonce = Math.random().toString(36).substring(2, 15)

      // 创建 SIWE 消息
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to CinaChain",
        uri: window.location.origin,
        version: "1",
        chainId: 1,
        nonce,
        expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 小时
      })

      // 签名
      const signature = await signMessageAsync({
        message: message.prepareMessage(),
      })

      // 保存会话
      const sessionData: SiweSession = {
        address,
        nonce,
        message: message.prepareMessage(),
        signature,
        expirationTime: message.expirationTime || "",
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
      setSession(sessionData)

      return true
    } catch (error) {
      console.error("SIWE sign in failed:", error)
      return false
    } finally {
      setLoading(false)
    }
  }, [address, signMessageAsync])

  // 登出
  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }, [])

  return {
    session,
    isAuthenticated: !!session && session.address === address,
    isLoading: loading,
    signIn,
    signOut,
  }
}
