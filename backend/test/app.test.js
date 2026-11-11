const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const jwt = require('jsonwebtoken');
const { createUserRepository } = require('../src/repositories/userRepository');
const secret = 'segredo-de-teste-com-mais-de-32-bytes';
process.env.JWT_SECRET = secret;
const app = require('../src/app');
const { createApp } = app;
const { createDocumentRepository } = require('../src/repositories/documentRepository');

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

async function startTestServer(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  const storageDirectory = path.join(directory, 'storage');
  const dataDirectory = path.join(directory, 'data');
  const users = createUserRepository(dataDirectory);
  await users.create({ id: ownerId, email: 'owner@example.com', passwordHash: 'hash' });
  await users.create({ id: otherOwnerId, email: 'other@example.com', passwordHash: 'hash' });
  const server = createApp({ storageDirectory, dataDirectory, jwtSecret: secret, maxFileSizeBytes: 16, ...options }).listen(0);
  await once(server, 'listening');

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(directory, { recursive: true, force: true });
  });

  return {
    storageDirectory,
    dataDirectory,
    url: `http://127.0.0.1:${server.address().port}`,
  };
}

const ownerId = 'c0d0e112-3ba9-44d1-8101-c9e430263889';
const otherOwnerId = 'f60496a9-f5b7-41e9-969b-983f3c62ba25';

function authorization(id = ownerId) {
  return { Authorization: `Bearer ${jwt.sign({}, secret, { subject: id, expiresIn: '1h' })}` };
}

function createUploadBody(name, content, mimeType = 'text/plain') {
  const body = new FormData();
  body.append('file', new Blob([content], { type: mimeType }), name);
  return body;
}

test('faz upload, lista e baixa um documento somente para seu owner', async (t) => {
  const { storageDirectory, url } = await startTestServer(t);
  const owner = ownerId;
  const uploadResponse = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: authorization(owner),
    body: createUploadBody('notas.txt', 'conteudo'),
  });

  assert.strictEqual(uploadResponse.status, 201);
  const { document } = await uploadResponse.json();
  assert.deepStrictEqual(Object.keys(document).sort(), [
    'id', 'originalName', 'owner', 'size', 'uploadedAt',
  ]);
  assert.strictEqual(document.originalName, 'notas.txt');
  assert.strictEqual(document.size, 8);
  assert.strictEqual(document.owner, owner);
  assert.ok(Number.isFinite(Date.parse(document.uploadedAt)));

  const storedFiles = await fs.readdir(storageDirectory);
  assert.strictEqual(storedFiles.length, 1);
  assert.notStrictEqual(storedFiles[0], document.originalName);

  const listResponse = await fetch(`${url}/documents`, {
    headers: authorization(owner),
  });
  assert.strictEqual(listResponse.status, 200);
  assert.deepStrictEqual(await listResponse.json(), { documents: [document] });

  const otherOwnerList = await fetch(`${url}/documents`, {
    headers: authorization(otherOwnerId),
  });
  assert.deepStrictEqual(await otherOwnerList.json(), { documents: [] });

  const deniedDownload = await fetch(`${url}/documents/${document.id}/download`, {
    headers: authorization(otherOwnerId),
  });
  assert.strictEqual(deniedDownload.status, 404);

  const downloadResponse = await fetch(`${url}/documents/${document.id}/download`, {
    headers: authorization(owner),
  });
  assert.strictEqual(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /attachment/);
  assert.strictEqual(downloadResponse.headers.get('content-type'), 'text/plain');
  assert.strictEqual(await downloadResponse.text(), 'conteudo');

  const secondUpload = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: { ...authorization(otherOwnerId), 'X-User-Id': owner },
    body: createUploadBody('outro.txt', 'privado'),
  });
  assert.strictEqual(secondUpload.status, 201);
  const secondDocument = (await secondUpload.json()).document;
  assert.strictEqual(secondDocument.owner, otherOwnerId);
  const firstUserList = await fetch(`${url}/documents`, { headers: authorization(owner) });
  const secondUserList = await fetch(`${url}/documents`, { headers: authorization(otherOwnerId) });
  assert.deepStrictEqual(await firstUserList.json(), { documents: [document] });
  assert.deepStrictEqual(await secondUserList.json(), { documents: [secondDocument] });
  const secondDownload = await fetch(`${url}/documents/${secondDocument.id}/download`, { headers: authorization(otherOwnerId) });
  assert.strictEqual(await secondDownload.text(), 'privado');
  const firstDenied = await fetch(`${url}/documents/${secondDocument.id}/download`, { headers: authorization(owner) });
  assert.strictEqual(firstDenied.status, 404);
});

test('valida owner, tipo de arquivo, arquivo vazio e limite de tamanho', async (t) => {
  const { url } = await startTestServer(t);
  const missingOwner = await fetch(`${url}/documents`);
  assert.strictEqual(missingOwner.status, 401);

  const unsupportedType = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: authorization(),
    body: createUploadBody('script.exe', 'conteudo', 'application/octet-stream'),
  });
  assert.strictEqual(unsupportedType.status, 415);

  const emptyFile = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: authorization(),
    body: createUploadBody('vazio.txt', ''),
  });
  assert.strictEqual(emptyFile.status, 400);

  const oversizedFile = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: authorization(),
    body: createUploadBody('grande.txt', 'conteudo maior que dezesseis bytes'),
  });
  assert.strictEqual(oversizedFile.status, 413);
});

test('retorna 404 para documento inexistente e 400 para identificador inválido', async (t) => {
  const { url } = await startTestServer(t);
  const invalidId = await fetch(`${url}/documents/invalido/download`, {
    headers: authorization(),
  });
  assert.strictEqual(invalidId.status, 400);

  const missingDocument = await fetch(`${url}/documents/9eac7a70-4604-4dc3-96b9-7f2abf7f0ad2/download`, {
    headers: authorization(),
  });
  assert.strictEqual(missingDocument.status, 404);
});

test('exige segredo e expiração válidos', () => {
  assert.throws(() => createApp({ jwtSecret: '' }), /JWT_SECRET/);
  assert.throws(() => createApp({ jwtSecret: secret, jwtExpiresIn: 'inválido' }), /JWT_EXPIRES_IN/);
});

test('ignora identidade forjada no cabeçalho', async (t) => {
  const { url } = await startTestServer(t);
  const missingToken = await fetch(`${url}/documents`, { headers: { 'X-User-Id': ownerId } });
  assert.strictEqual(missingToken.status, 401);
  const response = await fetch(`${url}/documents`, {
    headers: { ...authorization(), 'X-User-Id': otherOwnerId },
  });

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(await response.json(), { documents: [] });
});

test('rejeita campos multipart além do arquivo permitido', async (t) => {
  const { url } = await startTestServer(t);
  const body = createUploadBody('notas.txt', 'conteudo');
  body.append('extra', 'campo não permitido');

  const response = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: authorization(),
    body,
  });

  assert.strictEqual(response.status, 400);
});

test('limita a taxa de uploads por IP', async (t) => {
  const { url } = await startTestServer(t, { maxUploadsPerMinute: 1 });
  const firstUpload = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: authorization(),
    body: createUploadBody('primeiro.txt', 'ok'),
  });
  const limitedUpload = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: authorization(),
    body: createUploadBody('segundo.txt', 'ok'),
  });

  assert.strictEqual(firstUpload.status, 201);
  assert.strictEqual(limitedUpload.status, 429);
  assert.ok(Number(limitedUpload.headers.get('retry-after')) > 0);
});

test('rejeita nomes de arquivo internos que não sejam UUIDs', () => {
  const repository = createDocumentRepository('/tmp/dms-storage');

  assert.throws(
    () => repository.getFilePath('../../etc/passwd'),
    /Nome interno de arquivo inválido/,
  );
});

test('cadastra usuário local e autentica após recriar a aplicação', async (t) => {
  const { url, dataDirectory } = await startTestServer(t);
  const credentials = { email: '  Nova@Example.com ', password: 'senha-segura' };
  const post = (base, endpoint, body) => fetch(`${base}${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const registration = await post(url, '/auth/register', credentials);
  assert.strictEqual(registration.status, 201);
  const { user } = await registration.json();
  assert.deepStrictEqual(Object.keys(user).sort(), ['email', 'id']);
  assert.strictEqual(user.email, 'nova@example.com');
  const stored = JSON.parse(await fs.readFile(path.join(dataDirectory, 'users.json'), 'utf8'));
  assert.notStrictEqual(stored.find((entry) => entry.id === user.id).passwordHash, credentials.password);
  assert.strictEqual((await post(url, '/auth/register', credentials)).status, 409);
  assert.strictEqual((await post(url, '/auth/register', null)).status, 400);
  assert.strictEqual((await post(url, '/auth/register', { ...credentials, password: 'á'.repeat(37) })).status, 400);
  assert.strictEqual((await post(url, '/auth/login', { ...credentials, password: 'senha-errada' })).status, 401);
  assert.strictEqual((await post(url, '/auth/login', { ...credentials, email: 'ninguem@example.com' })).status, 401);

  const restartedServer = createApp({ dataDirectory, jwtSecret: secret }).listen(0);
  await once(restartedServer, 'listening');
  t.after(() => new Promise((resolve) => restartedServer.close(resolve)));
  const restartedUrl = `http://127.0.0.1:${restartedServer.address().port}`;
  const login = await post(restartedUrl, '/auth/login', credentials);
  assert.strictEqual(login.status, 200);
  const session = await login.json();
  assert.deepStrictEqual(session.user, user);
  assert.strictEqual((await fetch(`${restartedUrl}/documents`, { headers: { Authorization: `Bearer ${session.token}` } })).status, 200);
});

test('rejeita tokens inválidos e upload não autenticado sem gravar arquivos', async (t) => {
  const { url, storageDirectory } = await startTestServer(t);
  const tokens = [
    'malformado',
    jwt.sign({}, 'outro-segredo-com-mais-de-32-bytes', { subject: ownerId, expiresIn: '1h' }),
    jwt.sign({}, secret, { subject: ownerId, expiresIn: -1 }),
    jwt.sign({}, secret, { subject: ownerId }),
    jwt.sign({}, secret, { subject: 'inválido', expiresIn: '1h' }),
    jwt.sign({}, secret, { subject: '261b460f-68c5-4588-a6f1-baf04550f3de', expiresIn: '1h' }),
    jwt.sign({}, secret, { algorithm: 'HS384', subject: ownerId, expiresIn: '1h' }),
  ];
  for (const token of tokens) {
    const response = await fetch(`${url}/documents`, { headers: { Authorization: `Bearer ${token}` } });
    assert.strictEqual(response.status, 401);
  }
  const response = await fetch(`${url}/upload`, {
    method: 'POST', headers: { 'X-User-Id': ownerId }, body: createUploadBody('a.txt', 'ok'),
  });
  assert.strictEqual(response.status, 401);
  await assert.rejects(fs.stat(storageDirectory), { code: 'ENOENT' });
  assert.strictEqual((await fetch(`${url}/health`)).status, 200);
});

test('limita tentativas de autenticação', async (t) => {
  const { url } = await startTestServer(t, { maxAuthAttempts: 1 });
  const request = () => fetch(`${url}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'missing@example.com', password: 'senha-errada' }),
  });
  assert.strictEqual((await request()).status, 401);
  const limited = await request();
  assert.strictEqual(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});
