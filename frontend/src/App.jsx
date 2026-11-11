import { useEffect, useRef, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import AuthForm from './components/AuthForm.jsx';
import {
  downloadDocument,
  listDocuments,
  uploadDocument,
} from './services/documentsApi.js';
import './App.css';

export default function App() {
  const [session, setSession] = useState(null);

  if (!session) return <AuthForm onLogin={setSession} />;

  return <DocumentWorkspace key={session.token} session={session} onLogout={() => setSession((current) => current?.token === session.token ? null : current)} />;
}

function DocumentWorkspace({ session, onLogout }) {
  const pendingActions = useRef(new Set());
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const actions = pendingActions.current;
    return () => {
      for (const controller of actions) controller.abort();
    };
  }, []);

  function endSession() {
    for (const controller of pendingActions.current) controller.abort();
    onLogout();
  }

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();

    async function refreshDocuments() {
      setIsLoading(true);
      setListError(null);
      try {
        const result = await listDocuments(session.token, controller.signal);
        if (isCurrent) {
          setDocuments(result);
        }
      } catch (error) {
        if (isCurrent) {
          if (error.status === 401) endSession();
          else setListError(error.message);
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
      controller.abort();
    };
  }, [refreshToken, session.token]);

  async function handleUpload(file) {
    const controller = new AbortController();
    pendingActions.current.add(controller);
    setIsUploading(true);
    setNotice(null);

    try {
      await uploadDocument(file, session.token, controller.signal);
      setNotice({ type: 'success', message: 'Documento enviado com sucesso.' });
      setRefreshToken((current) => current + 1);
      return true;
    } catch (error) {
      if (error.status === 401) endSession();
      else if (error.name !== 'AbortError') setNotice({ type: 'error', message: error.message });
      return false;
    } finally {
      pendingActions.current.delete(controller);
      setIsUploading(false);
    }
  }

  async function handleDownload(document) {
    const controller = new AbortController();
    pendingActions.current.add(controller);
    setDownloadingId(document.id);
    setNotice(null);

    try {
      await downloadDocument(document, session.token, controller.signal);
      setNotice({ type: 'success', message: `Download iniciado: ${document.originalName}` });
    } catch (error) {
      if (error.status === 401) endSession();
      else if (error.name !== 'AbortError') setNotice({ type: 'error', message: error.message });
    } finally {
      pendingActions.current.delete(controller);
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
        <div className="identity">
          <span className="identity-dot" aria-hidden="true" />
          <span className="identity-email">{session.user.email}</span>
          <button className="logout-button" type="button" onClick={endSession}>Sair</button>
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
