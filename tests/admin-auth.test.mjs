import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createSchema } from '../app/lib/server/schema.mjs'
process.env.TURSO_DATABASE_URL = `file:/tmp/dahab-auth-${process.pid}.db`
process.env.ADMIN_USER = 'first-admin'
process.env.ADMIN_PASS = 'first-password'
process.env.ADMIN_USER_2 = 'second-admin'
process.env.ADMIN_PASS_2 = 'second-password'
process.env.ADMIN_TOKEN_SECRET = 'a'.repeat(32)
const { db } = await import('../app/lib/server/db.ts')
await createSchema(db)
const auth = await import('../app/lib/server/auth.ts')
const { POST } = await import('../app/api/[[...path]]/route.ts')

test('both admins log in with their own password and identity', async () => {
  const tokens = []
  for (const [username, password] of [['first-admin', 'first-password'], ['second-admin', 'second-password']]) {
    const response = await POST(new Request('https://localhost/api/admin/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password })
    }), { params: Promise.resolve({ path: ['admin', 'login'] }) })
    assert.equal(response.status, 200)
    const cookie = response.headers.get('set-cookie')
    assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/)
    const token = decodeURIComponent(cookie.match(/dahab_admin_token=([^;]+)/)[1])
    assert.equal(auth.parseAdminToken(token).sub, username)
    assert.equal(await auth.isValidAdminToken(token), true)
    tokens.push(token)
  }
  await auth.revokeAdminToken(tokens[1])
  assert.equal(await auth.isValidAdminToken(tokens[1]), false)
  assert.equal(await auth.isValidAdminToken(tokens[0]), true)
})
test('cross-account passwords and unknown or malformed accounts are rejected', () => {
  assert.equal(auth.verifyAdminCredentials('first-admin', 'second-password'), false)
  assert.equal(auth.verifyAdminCredentials('second-admin', 'first-password'), false)
  assert.equal(auth.verifyAdminCredentials('unknown', 'second-password'), false)
  assert.equal(auth.verifyAdminCredentials({}, 'second-password'), false)
})
test('cannot issue a session for an unknown admin', async () => {
  await assert.rejects(auth.createAdminToken('unknown'), /Unknown admin/)
})
test.after(() => {
  db.close()
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`/tmp/dahab-auth-${process.pid}.db${suffix}`, { force: true })
})
