import { EdDSASigner } from "did-jwt"
import {
  createVerifiableCredentialJwt,
  JwtCredentialPayload,
  verifyCredential,
  JwtPresentationPayload,
  Issuer
} from "did-jwt-vc"
import {
  CredentialPayload,
  JWT,
  PresentationPayload,
  VerifiedCredential,
  VerifiedPresentation
} from "did-jwt-vc/lib/types"

import {
  verifyPresentation,
  createVerifiablePresentationJwt
} from "lib/did-jwt-vc"
import { didKeyResolver } from "lib/verity"

const did = process.env.ISSUER_DID
const secret = process.env.ISSUER_SECRET

export const issuer: Issuer = {
  did: did,
  alg: "EdDSA",
  signer: EdDSASigner(secret)
}

export function verifiablePresentationPayload(
  subject: Issuer,
  vcJwt: JWT | JWT[] = []
): JwtPresentationPayload {
  return {
    iss: subject.did,
    sub: subject.did,
    vp: {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiablePresentation"],
      holder: subject.did,
      verifiableCredential: [vcJwt].flat()
    }
  }
}

export function vcPayloadKYCFulfillment(
  subject: string,
  kycAttestation: Record<string, unknown>
): JwtCredentialPayload {
  return {
    sub: subject,
    vc: {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://centre.io/identity"
      ],
      type: ["VerifiableCredential", "KYCAMLAttestation"],
      credentialSubject: {
        KYCAMLAttestation: kycAttestation,
        id: subject
      }
    }
  }
}

/**
 * Decodes a JWT with a Verifiable Credential payload.
 */
export function decodeVc(vc: JWT): Promise<VerifiedCredential> {
  return verifyCredential(vc, didKeyResolver)
}

/**
 * Decode a JWT with a Verifiable Presentation payload.
 */
export async function decodeVp(vpJwt: JWT): Promise<VerifiedPresentation> {
  return verifyPresentation(vpJwt, didKeyResolver)
}

/**
 * Sign a VC and return a JWT
 */
export const signVc = async (
  vcPayload: JwtCredentialPayload | CredentialPayload
): Promise<JWT> => {
  return createVerifiableCredentialJwt(vcPayload, issuer)
}

/**
 * Sign a VP and return a JWT
 */
export const signVP = async (
  vcPayload: JwtPresentationPayload | PresentationPayload
): Promise<JWT> => {
  return createVerifiablePresentationJwt(vcPayload, issuer)
}
