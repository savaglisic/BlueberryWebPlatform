import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Env } from './types'

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function teamDomain(value: string): string {
  return value.replace(/\/$/, '')
}

function keySetFor(domain: string): ReturnType<typeof createRemoteJWKSet> {
  let keySet = keySets.get(domain)
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${domain}/cdn-cgi/access/certs`))
    keySets.set(domain, keySet)
  }
  return keySet
}

function normalizedEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export async function accessEmail(request: Request, env: Env): Promise<string> {
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion')
  if (assertion) {
    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
      console.warn('Cloudflare Access assertion received without verification settings')
      return ''
    }

    try {
      const issuer = teamDomain(env.ACCESS_TEAM_DOMAIN)
      const { payload } = await jwtVerify(assertion, keySetFor(issuer), {
        issuer,
        audience: env.ACCESS_AUD,
      })
      return normalizedEmail(payload.email)
    } catch (error) {
      console.warn('Cloudflare Access assertion validation failed', error)
      return ''
    }
  }

  // Direct localhost development has no Access proxy. This value is supplied
  // only through the ignored .dev.vars file and is never deployed.
  if (env.DEV_USER_EMAIL) return normalizedEmail(env.DEV_USER_EMAIL)

  // Backward compatibility for an origin where Access injects an identity
  // header but JWT verification has not yet been configured.
  if (!env.ACCESS_AUD) {
    return normalizedEmail(request.headers.get('Cf-Access-Authenticated-User-Email'))
  }
  return ''
}
