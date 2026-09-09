import { createHmac, timingSafeEqual } from 'node:crypto'

interface TokenPayload {
  studentId: string
  session: string
  term: string
  exp: number // unix seconds
}

function secret() {
  const s = process.env.PRINT_TOKEN_SECRET
  if (!s) throw new Error('Missing PRINT_TOKEN_SECRET environment variable')
  return s
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

// Short-lived signed token so the chrome-less /print route can authenticate
// a Puppeteer request without a real browser session (Puppeteer carries no
// cookies/localStorage from a logged-in admin).
export function mintPrintToken(studentId: string, session: string, term: string, ttlSeconds = 60): string {
  const payload: TokenPayload = { studentId, session, term, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${sign(encoded)}`
}

export function verifyPrintToken(token: string, studentId: string, session: string, term: string): boolean {
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return false

  const expected = sign(encoded)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  let payload: TokenPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return false
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) return false
  return payload.studentId === studentId && payload.session === session && payload.term === term
}
