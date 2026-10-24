const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const crypto = require('node:crypto');

const testMongoUri = process.env.TEST_MONGODB_URI;
if (!testMongoUri) {
  throw new Error('Set TEST_MONGODB_URI to a dedicated test database (its database name must contain "test"). Never use your production database.');
}
const dbName = new URL(testMongoUri).pathname.replace(/^\//, '').toLowerCase();
if (!dbName.includes('test')) {
  throw new Error('Safety check: TEST_MONGODB_URI database name must contain "test".');
}
process.env.MONGODB_URI = testMongoUri;
process.env.SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV = 'test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const {
  app,
  User,
  Document,
  Audit,
  PasswordReset,
  sessionStore,
} = require('../server');
let server;
let baseUrl;

before(async () => {
  await mongoose.connect(testMongoUri);
  await Promise.all([User.deleteMany({}), Document.deleteMany({}), Audit.deleteMany({}), PasswordReset.deleteMany({})]);
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});



after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  await sessionStore.close();
  await mongoose.disconnect();
});



async function registerAndLogin({ name, email, password, role }) {
  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  assert.equal(register.status, 201, `Registration failed for ${email}`);
  if (role) await User.updateOne({ email }, { $set: { role } });
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, `Login failed for ${email}`);
  const cookies = login.headers.getSetCookie();
  const cookie = cookies.map(value => value.split(';')[0]).find(value => value.startsWith('trustvault.sid='));
  assert.ok(cookie, 'Login must issue the HTTP-only session cookie');
  return { cookie, user: (await login.json()).user };
}

test('a different account cannot list, download, edit, or delete another owner’s document', async () => {
  const suffix = crypto.randomUUID();
  const ownerEmail = `owner-${suffix}@example.test`;
  const viewerEmail = `viewer-${suffix}@example.test`;
  const password = 'Secure-Test-Password!2026';
  const owner = await registerAndLogin({ name: 'Test Owner', email: ownerEmail, password, role: 'owner' });
  const viewer = await registerAndLogin({ name: 'Test Viewer', email: viewerEmail, password, role: 'viewer' });

  const form = new FormData();
  form.append('file', new Blob(['%PDF-1.7\nTrustVault authorization test'], { type: 'application/pdf' }), 'private.pdf');
  form.append('name', 'Private authorization test');
  form.append('category', 'Test');
  const upload = await fetch(`${baseUrl}/api/documents`, { method: 'POST', headers: { Cookie: owner.cookie }, body: form });
  assert.equal(upload.status, 201, 'Owner should be able to upload a test document');
  const { document } = await upload.json();

  const listing = await fetch(`${baseUrl}/api/documents`, { headers: { Cookie: viewer.cookie } });
  assert.equal(listing.status, 200);
  const listed = await listing.json();
  assert.equal((listed.documents || []).some(item => String(item.id) === String(document.id)), false, 'Document must not appear in another user’s list');

  const download = await fetch(`${baseUrl}/api/documents/${document.id}/download`, { headers: { Cookie: viewer.cookie } });
  assert.equal(download.status, 403, 'Cross-account download must be forbidden');

  const edit = await fetch(`${baseUrl}/api/documents/${document.id}`, {
    method: 'PATCH', headers: { Cookie: viewer.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauthorized edit' }),
  });
  assert.equal(edit.status, 403, 'Cross-account edit must be forbidden');

  const deletion = await fetch(`${baseUrl}/api/documents/${document.id}`, { method: 'DELETE', headers: { Cookie: viewer.cookie } });
  assert.equal(deletion.status, 403, 'Cross-account deletion must be forbidden');

  assert.ok(await Document.findById(document.id), 'Unauthorized requests must not delete the document');
});
