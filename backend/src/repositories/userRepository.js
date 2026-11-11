const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function createUserRepository(dataDirectory) {
  const filePath = path.join(dataDirectory, 'users.json');
  let pendingWrite = Promise.resolve();

  async function readUsers() {
    let contents;
    try {
      contents = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }

    const users = JSON.parse(contents);
    if (!Array.isArray(users)) throw new Error('Arquivo de usuários inválido.');
    return users;
  }

  async function saveUsers(users) {
    await fs.mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    const temporaryPath = path.join(dataDirectory, `.users-${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(users, null, 2), { mode: 0o600, flag: 'wx' });
      await fs.rename(temporaryPath, filePath);
    } finally {
      await fs.unlink(temporaryPath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }

  return {
    async findByEmail(email) {
      return (await readUsers()).find((user) => user.email === email);
    },
    async findById(id) {
      return (await readUsers()).find((user) => user.id === id);
    },
    create(user) {
      const operation = pendingWrite.then(async () => {
        const users = await readUsers();
        if (users.some((existing) => existing.email === user.email)) return undefined;
        users.push(user);
        await saveUsers(users);
        return user;
      });
      pendingWrite = operation.catch(() => {});
      return operation;
    },
  };
}

module.exports = { createUserRepository };