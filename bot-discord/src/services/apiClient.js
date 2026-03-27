import { env } from '../config/env.js'

async function parseJson(res) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

export async function postPrivateApi(path, payload) {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-discord-shared-secret': env.sharedSecret,
    },
    body: JSON.stringify(payload),
  })

  const json = await parseJson(res)
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`)
    err.status = res.status
    err.payload = json
    throw err
  }
  return json
}
