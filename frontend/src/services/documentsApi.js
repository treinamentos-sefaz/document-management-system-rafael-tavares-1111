const apiPrefix = '/api';

async function readError(response) {
  try {
    const body = await response.json();
    return body.error?.message || 'Não foi possível concluir a solicitação.';
  } catch {
    return 'Não foi possível concluir a solicitação.';
  }
}

async function request(path, userId, options = {}) {
  const response = await fetch(`${apiPrefix}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response;
}

export async function listDocuments(userId) {
  const response = await request('/documents', userId);
  const body = await response.json();
  return body.documents;
}

export async function uploadDocument(file, userId) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', userId, {
    method: 'POST',
    body: formData,
  });

  const body = await response.json();
  return body.document;
}

export async function downloadDocument(document, userId) {
  const response = await request(
    `/documents/${encodeURIComponent(document.id)}/download`,
    userId,
  );
  const file = await response.blob();
  const objectUrl = URL.createObjectURL(file);
  const link = window.document.createElement('a');

  link.href = objectUrl;
  link.download = document.originalName;
  link.hidden = true;
  window.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}