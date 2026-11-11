const fs = require('node:fs/promises');
const path = require('node:path');

function createDocumentRepository(storageDirectory) {
  const documents = new Map();

  function getFilePath(storageName) {
    if (typeof storageName !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storageName)) {
      throw new Error('Nome interno de arquivo inválido.');
    }

    return path.join(storageDirectory, storageName);
  }

  return {
    save(document) {
      if (documents.has(document.id)) {
        throw new Error('Já existe um documento com esse identificador.');
      }

      documents.set(document.id, document);
      return document;
    },

    findAllByOwner(owner) {
      return Array.from(documents.values())
        .filter((document) => document.owner === owner)
        .sort((first, second) => {
          const dateOrder = second.uploadedAt.localeCompare(first.uploadedAt);
          return dateOrder || first.id.localeCompare(second.id);
        });
    },

    findByIdAndOwner(id, owner) {
      const document = documents.get(id);
      return document?.owner === owner ? document : undefined;
    },

    getFilePath,

    async removeFile(storageName) {
      try {
        await fs.unlink(getFilePath(storageName));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    },
  };
}

module.exports = { createDocumentRepository };