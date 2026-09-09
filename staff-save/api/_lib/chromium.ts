import chromium from '@sparticuz/chromium'
import puppeteer, { type Browser } from 'puppeteer-core'

// @sparticuz/chromium's bundled binary is Linux-only (built for Vercel's
// runtime) — this will not run under `vercel dev` locally. Test PDF export
// against a Preview Deployment instead.
export async function launchChromium(): Promise<Browser> {
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}
