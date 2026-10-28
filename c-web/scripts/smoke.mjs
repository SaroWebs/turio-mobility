import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const root = resolve(process.cwd(), 'dist')
const port = 4179

// Bundle/route smoke checks; these do not replace a rendered-browser test.
const routes = [
  ['/', ['Tours & attractions', 'Featured Attractions', 'Find tours']],
  ['/tours', ['Find your next tour', 'Travellers', 'More choices', 'Tour difficulty', 'Price per person']],
  ['/tours/1/checkout', ['Tour details', 'Check total amount', 'Confirm booking']],
  ['/rentals', ['Car rentals', 'Driver included with every car.']],
  ['/rentals/1/checkout', ['Rental details', 'Pickup date', 'Return date']],
  ['/rides', ['Fast rides', 'Check fare', 'Find a driver']],
  ['/bookings', ['Booking history', 'Share tour']],
  ['/shared-tour', ['Invited mobile number', 'Verify mobile number', 'Day-by-day plan']],
  ['/bookings/tours/1/share', ['Share tour with family or friends', 'Stop sharing']],
  ['/support', ['Get help with trips']],
]

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
}

if (!existsSync(join(root, 'index.html'))) {
  throw new Error('dist/index.html not found. Run npm run build before smoke tests.')
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname
  const assetPath = join(root, pathname)
  const filePath = existsSync(assetPath) && extname(assetPath) ? assetPath : join(root, 'index.html')
  const extension = extname(filePath)

  try {
    const body = await readFile(filePath)
    response.writeHead(200, { 'Content-Type': mimeTypes[extension] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

await new Promise((resolveStart) => server.listen(port, '127.0.0.1', resolveStart))

try {
  const indexHtml = await fetch(`http://127.0.0.1:${port}/`).then((response) => response.text())
  const scriptMatches = [...indexHtml.matchAll(/<script[^>]+src="([^"]+)"/g)]
  const scriptUrls = scriptMatches.map((match) => match[1])
  const scripts = await Promise.all(
    scriptUrls.map((src) => fetch(`http://127.0.0.1:${port}${src}`).then((response) => response.text())),
  )
  const appText = `${indexHtml}\n${scripts.join('\n')}`

  for (const [route, expectedTexts] of routes) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`)

    if (!response.ok) {
      throw new Error(`${route} returned ${response.status}`)
    }

    for (const expectedText of expectedTexts) {
      if (!appText.includes(expectedText)) {
        throw new Error(`${route} missing expected text: ${expectedText}`)
      }
    }
  }

  console.log(`Smoke tests passed for ${routes.length} customer-web routes.`)
} finally {
  await new Promise((resolveClose) => server.close(resolveClose))
}
