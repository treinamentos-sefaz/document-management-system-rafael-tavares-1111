const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const app = require('../src/app');
const { createApp } = app;
const { createDocumentRepository } = require('../src/repositories/documentRepository');

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

async function startTestServer(t, options = {}) {
  const storageDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-test-'));
  const server = createApp({ storageDirectory, maxFileSizeBytes: 16, ...options }).listen(0);
  await once(server, 'listening');

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(storageDirectory, { recursive: true, force: true });
  });

  return {
    storageDirectory,
    url: `http://127.0.0.1:${server.address().port}`,
  };
}

function createUploadBody(name, content, mimeType = 'text/plain') {
  const body = new FormData();
  body.append('file', new Blob([content], { type: mimeType }), name);
  return body;
}

test('faz upload, lista e baixa um documento somente para seu owner', async (t) => {
  const { storageDirectory, url } = await startTestServer(t);
  const owner = 'usuario-teste';
  const uploadResponse = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': owner },
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
    headers: { 'X-User-Id': owner },
  });
  assert.strictEqual(listResponse.status, 200);
  assert.deepStrictEqual(await listResponse.json(), { documents: [document] });

  const otherOwnerList = await fetch(`${url}/documents`, {
    headers: { 'X-User-Id': 'outro-usuario' },
  });
  assert.deepStrictEqual(await otherOwnerList.json(), { documents: [] });

  const deniedDownload = await fetch(`${url}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'outro-usuario' },
  });
  assert.strictEqual(deniedDownload.status, 404);

  const downloadResponse = await fetch(`${url}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': owner },
  });
  assert.strictEqual(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-disposition'), /attachment/);
  assert.strictEqual(downloadResponse.headers.get('content-type'), 'text/plain');
  assert.strictEqual(await downloadResponse.text(), 'conteudo');
});

test('valida owner, tipo de arquivo, arquivo vazio e limite de tamanho', async (t) => {
  const { url } = await startTestServer(t);
  const missingOwner = await fetch(`${url}/documents`);
  assert.strictEqual(missingOwner.status, 400);

  const unsupportedType = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'usuario-teste' },
    body: createUploadBody('script.exe', 'conteudo', 'application/octet-stream'),
  });
  assert.strictEqual(unsupportedType.status, 415);

  const emptyFile = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'usuario-teste' },
    body: createUploadBody('vazio.txt', ''),
  });
  assert.strictEqual(emptyFile.status, 400);

  const oversizedFile = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'usuario-teste' },
    body: createUploadBody('grande.txt', 'conteudo maior que dezesseis bytes'),
  });
  assert.strictEqual(oversizedFile.status, 413);
});

test('retorna 404 para documento inexistente e 400 para identificador inválido', async (t) => {
  const { url } = await startTestServer(t);
  const invalidId = await fetch(`${url}/documents/invalido/download`, {
    headers: { 'X-User-Id': 'usuario-teste' },
  });
  assert.strictEqual(invalidId.status, 400);

  const missingDocument = await fetch(`${url}/documents/9eac7a70-4604-4dc3-96b9-7f2abf7f0ad2/download`, {
    headers: { 'X-User-Id': 'usuario-teste' },
  });
  assert.strictEqual(missingDocument.status, 404);
});

test('exige middleware de autenticação quando NODE_ENV é production', () => {
  const originalEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    assert.throws(
      () => createApp(),
      /configure um middleware de autenticação/,
    );
  } finally {
    if (originalEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnvironment;
    }
  }
});

test('usa o owner definido pelo middleware confiável em vez do cabeçalho', async (t) => {
  const authenticateOwner = (req, res, next) => {
    req.user = { id: 'usuario-autenticado' };
    next();
  };
  const { url } = await startTestServer(t, { authenticateOwner });
  const response = await fetch(`${url}/documents`, {
    headers: { 'X-User-Id': 'usuario-forjado' },
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
    headers: { 'X-User-Id': 'usuario-teste' },
    body,
  });

  assert.strictEqual(response.status, 400);
});

test('limita a taxa de uploads por IP', async (t) => {
  const { url } = await startTestServer(t, { maxUploadsPerMinute: 1 });
  const firstUpload = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'usuario-teste' },
    body: createUploadBody('primeiro.txt', 'ok'),
  });
  const limitedUpload = await fetch(`${url}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'usuario-teste' },
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
