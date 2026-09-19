import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function parseWerkzeugHash(stored: string): { n: number; r: number; p: number; salt: string; expected: Uint8Array } | null {
  const [method, salt, hex] = stored.split('$')
  const match = /^scrypt:(\d+):(\d+):(\d+)$/.exec(method ?? '')
  if (!match || !salt || !hex) return null
  return { n: Number(match[1]), r: Number(match[2]), p: Number(match[3]), salt, expected: Uint8Array.from(hex.match(/.{2}/g) ?? [], (value) => Number.parseInt(value, 16)) }
}

export function verifyPassword(stored: string, password: string): boolean {
  const parsed = parseWerkzeugHash(stored)
  if (!parsed) return false
  const actual = scryptSync(password, parsed.salt, parsed.expected.length, {
    N: parsed.n,
    r: parsed.r,
    p: parsed.p,
    maxmem: 128 * parsed.n * parsed.r * 2,
  })
  return actual.length === parsed.expected.length && timingSafeEqual(actual, parsed.expected)
}

export function hashPassword(password: string): string {
  const n = 32768
  const r = 8
  const p = 1
  const salt = hex(randomBytes(16))
  const hash = scryptSync(password, salt, 64, { N: n, r, p, maxmem: 128 * n * r * 2 })
  return `scrypt:${n}:${r}:${p}$${salt}$${hex(hash)}`
}
