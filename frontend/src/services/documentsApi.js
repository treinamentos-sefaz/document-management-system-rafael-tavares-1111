const apiPrefix = '/api';

async function readError(response) {
  try {
    const body = await response.json();
    return body.error?.message || 'Não foi possível concluir a solicitação.';
  } catch {
    return 'Não foi possível concluir a solicitação.';
  }
}

async function request(path, token, options = {}) {
  const response = await fetch(`${apiPrefix}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const error = new Error(await readError(response));
    error.status = response.status;
    throw error;
  }

  return response;
}

export async function register(credentials) {
  const response = await request('/auth/register', null, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
  });
  return response.json();
}

export async function login(credentials) {
  const response = await request('/auth/login', null, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
  });
  return response.json();
}

export async function listDocuments(token, signal) {
  const response = await request('/documents', token, { signal });
  const body = await response.json();
  return body.documents;
}

export async function uploadDocument(file, token, signal) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', token, {
    method: 'POST',
    body: formData,
    signal,
  });

  const body = await response.json();
  return body.document;
}

export async function downloadDocument(document, token, signal) {
  const response = await request(
    `/documents/${encodeURIComponent(document.id)}/download`,
    token,
    { signal },
  );
  const file = await response.blob();
  if (signal?.aborted) return;
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