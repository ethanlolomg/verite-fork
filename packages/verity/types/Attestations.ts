import type { Person } from "schema-dts"

export type KYCAMLAttestation = {
  "@type": "KYCAMLAttestation"
  authorityId: string
  approvalDate: string
  expirationDate?: string
  authorityName?: string
  authorityUrl?: string
  authorityCallbackUrl?: string
  serviceProviders?: KYCAMLProvider[]
}

export type KYCAMLProvider = {
  "@type": "KYCAMLProvider"
  name?: string
  score?: number
  completionDate?: string
  comment?: string
}

export type CreditScoreAttestation = {
  "@type": "CreditScoreAttestation"
  score: number
  scoreType: string
  provider: string
  historyStartDate?: string
  paymentHistoryPercentage?: string
  openAccounts?: number
  utilization?: number
  chainAddressOwner?: ChainAddressOwner[]
}

export type ChainAddressOwner = {
  "@type": "ChainAddressOwner"
  chain: string
  address: string
  proof: string
}

export type CounterpartyPerson = Person & {
  accountNumber: string
  accountSource: string
}