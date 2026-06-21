"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount } from "wagmi"
import { getPassportScore, submitPassport, type PassportScore } from "@/lib/gitcoin-passport"

interface UseGitcoinPassportOptions {
  scorerId?: string
  apiKey?: string
  threshold?: number
  autoSubmit?: boolean
}

interface UseGitcoinPassportReturn {
  score: PassportScore | null
  isEligible: boolean
  isLoading: boolean
  error: string | null
  refreshScore: () => Promise<void>
  submitPassport: () => Promise<void>
}

export function useGitcoinPassport(options: UseGitcoinPassportOptions = {}): UseGitcoinPassportReturn {
  const { address, isConnected } = useAccount()
  const {
    scorerId = process.env.NEXT_PUBLIC_GITCOIN_SCORER_ID,
    apiKey = process.env.NEXT_PUBLIC_GITCOIN_API_KEY,
    threshold = 20,
    autoSubmit = false,
  } = options

  const [score, setScore] = useState<PassportScore | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchScore = useCallback(async () => {
    if (!address || !scorerId || !apiKey) return

    setIsLoading(true)
    setError(null)

    try {
      const passportScore = await getPassportScore(address, scorerId, apiKey)
      setScore(passportScore)

      // 如果分数为 null 且需要自动提交
      if (passportScore.score === null && autoSubmit) {
        await submitPassport(address, scorerId, apiKey)
        // 提交后重新获取
        const updatedScore = await getPassportScore(address, scorerId, apiKey)
        setScore(updatedScore)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch passport score")
    } finally {
      setIsLoading(false)
    }
  }, [address, scorerId, apiKey, autoSubmit])

  const submitPassportScore = useCallback(async () => {
    if (!address || !scorerId || !apiKey) return

    setIsLoading(true)
    setError(null)

    try {
      await submitPassport(address, scorerId, apiKey)
      await fetchScore()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit passport")
    } finally {
      setIsLoading(false)
    }
  }, [address, scorerId, apiKey, fetchScore])

  useEffect(() => {
    if (isConnected && address) {
      fetchScore()
    }
  }, [isConnected, address, fetchScore])

  return {
    score,
    isEligible: score?.score !== null && score?.score >= threshold,
    isLoading,
    error,
    refreshScore: fetchScore,
    submitPassport: submitPassportScore,
  }
}
