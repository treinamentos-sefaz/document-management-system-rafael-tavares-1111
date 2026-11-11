function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function createDocumentController(documentService) {
  return {
    async upload(req, res, next) {
      try {
        const document = await documentService.createDocument(req.file, req.owner);
        return res.status(201).json({ document });
      } catch (error) {
        return next(error);
      }
    },

    list(req, res, next) {
      try {
        const documents = documentService.listDocuments(req.owner);
        return res.status(200).json({ documents });
      } catch (error) {
        return next(error);
      }
    },

    download(req, res, next) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Identificador de documento inválido.');
      }

      try {
        const document = documentService.findDocumentForDownload(req.params.id, req.owner);
        if (!document) {
          return sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
        }

        return res.download(
          document.filePath,
          document.originalName,
          { headers: { 'Content-Type': document.mimeType } },
          (error) => {
            if (!error) {
              return;
            }

            if (res.headersSent) {
              res.destroy(error);
              return;
            }

            if (error.code === 'ENOENT') {
              sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
              return;
            }

            next(error);
          },
        );
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = { createDocumentController };