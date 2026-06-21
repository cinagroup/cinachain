// Gitcoin Passport API 配置
export const GITCOIN_PASSPORT_API_URL = "https://api.scorer.gitcoin.co"

export interface PassportScore {
  address: string
  score: number | null
  last_score_timestamp: string
  status: "ERROR" | "DONE" | "PROCESSING" | null
  evidence: {
    type: string
    rawScore: string
    threshold: string
  } | null
  expiration_date: string | null
}

export interface StampCredential {
  provider: string
  credential: {
    type: string[]
    proof: {
      type: string
      proofPurpose: string
      verificationMethod: string
      created: string
      jws: string
    }
    issuer: string
    issuanceDate: string
    expirationDate: string
    credentialSubject: {
      id: string
      hash: string
      provider: string
    }
  }
}

export async function getPassportScore(
  address: string,
  scorerId: string,
  apiKey: string
): Promise<PassportScore> {
  const response = await fetch(
    `${GITCOIN_PASSPORT_API_URL}/registry/score/${scorerId}/${address}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch passport score: ${response.statusText}`)
  }

  return response.json()
}

export async function submitPassport(
  address: string,
  scorerId: string,
  apiKey: string
): Promise<PassportScore> {
  const response = await fetch(
    `${GITCOIN_PASSPORT_API_URL}/registry/submit-passport`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        address,
        scorer_id: scorerId,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to submit passport: ${response.statusText}`)
  }

  return response.json()
}

// 推荐的最低分数阈值
export const RECOMMENDED_SCORE_THRESHOLD = 20
