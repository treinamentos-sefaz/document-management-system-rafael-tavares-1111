const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createUserRepository } = require('../src/repositories/userRepository');

test('persiste usuários e impede cadastros concorrentes duplicados', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-users-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const repository = createUserRepository(directory);
  const user = { id: 'id-1', email: 'user@example.com', passwordHash: 'hash' };
  const results = await Promise.all([repository.create(user), repository.create({ ...user, id: 'id-2' })]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(await createUserRepository(directory).findByEmail(user.email), user);
  assert.deepEqual(await repository.findById(user.id), user);
  assert.equal((await fs.stat(path.join(directory, 'users.json'))).mode & 0o777, 0o600);
});

test('não sobrescreve arquivo de usuários inválido', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-users-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'users.json');
  await fs.writeFile(filePath, '{invalid');
  await assert.rejects(createUserRepository(directory).create({ email: 'user@example.com' }));
  assert.equal(await fs.readFile(filePath, 'utf8'), '{invalid');
});

test('propaga falhas de acesso ao armazenamento', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-users-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'not-a-directory');
  await fs.writeFile(filePath, 'dados');
  const repository = createUserRepository(filePath);
  await assert.rejects(repository.create({ email: 'user@example.com' }), { code: 'ENOTDIR' });
  assert.equal(await fs.readFile(filePath, 'utf8'), 'dados');
});