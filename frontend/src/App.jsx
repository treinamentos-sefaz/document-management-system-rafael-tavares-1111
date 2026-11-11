import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import {
  downloadDocument,
  listDocuments,
  uploadDocument,
} from './services/documentsApi.js';
import './App.css';

const userId = import.meta.env.VITE_USER_ID?.trim() || 'demo-user';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let isCurrent = true;

    async function refreshDocuments() {
      setIsLoading(true);
      setListError(null);
      try {
        const result = await listDocuments(userId);
        if (isCurrent) {
          setDocuments(result);
        }
      } catch (error) {
        if (isCurrent) {
          setListError(error.message);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    refreshDocuments();
    return () => {
      isCurrent = false;
    };
  }, [refreshToken]);

  async function handleUpload(file) {
    setIsUploading(true);
    setNotice(null);

    try {
      await uploadDocument(file, userId);
      setNotice({ type: 'success', message: 'Documento enviado com sucesso.' });
      setRefreshToken((current) => current + 1);
      return true;
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(document) {
    setDownloadingId(document.id);
    setNotice(null);

    try {
      await downloadDocument(document, userId);
      setNotice({ type: 'success', message: `Download iniciado: ${document.originalName}` });
    } catch (error) {
      setNotice({ type: 'error', message: error.message });
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="DMS, início">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span>DMS<span className="brand-period">.</span></span>
        </a>
        <div className="identity" title="Identificador de demonstração, não autenticado">
          <span className="identity-dot" aria-hidden="true" />
          <span>{userId}</span>
          <span className="identity-label">DEMO</span>
        </div>
      </header>

      <section className="page-heading" id="inicio">
        <div>
          <p className="eyebrow">ARQUIVO PESSOAL</p>
          <h1>Seus documentos<span className="heading-period">.</span></h1>
          <p className="page-description">Envie, organize e recupere seus arquivos em um só lugar.</p>
        </div>
        <div className="document-total" aria-live="polite">
          <strong>{isLoading ? '—' : documents.length.toString().padStart(2, '0')}</strong>
          <span>ARQUIVOS</span>
        </div>
      </section>

      {notice && (
        <div className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <span>{notice.message}</span>
          <button
            className="notice-dismiss"
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="content-grid">
        <aside className="upload-column">
          <UploadComponent onUpload={handleUpload} isUploading={isUploading} />
          <p className="demo-note">
            Espaço de demonstração. O identificador de usuário não substitui autenticação.
          </p>
        </aside>

        <DocumentList
          documents={documents}
          isLoading={isLoading}
          error={listError}
          downloadingId={downloadingId}
          onDownload={handleDownload}
          onRefresh={() => setRefreshToken((current) => current + 1)}
        />
      </div>
      <footer className="page-footer">
        <span>DOCUMENT MANAGEMENT SYSTEM</span>
        <span>ARMAZENAMENTO LOCAL</span>
      </footer>
    </main>
  );
}
