import { useRef, useState } from 'react';
import { formatFileSize } from '../utils/formatFileSize.js';

const acceptedFileTypes = '.csv,.doc,.docx,.pdf,.ppt,.pptx,.txt,.xls,.xlsx';

export default function UploadComponent({ onUpload, isUploading }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedFile || isUploading) {
      return;
    }

    const wasUploaded = await onUpload(selectedFile);
    if (wasUploaded) {
      setSelectedFile(null);
      inputRef.current.value = '';
    }
  }

  return (
    <section className="upload-panel" aria-labelledby="upload-title">
      <div className="section-index">01 <span>ADICIONAR</span></div>
      <h2 id="upload-title">Novo documento</h2>
      <p className="upload-description">Selecione um arquivo para guardar no seu espaço.</p>

      <form onSubmit={handleSubmit}>
        <label className={`file-picker${selectedFile ? ' file-picker-selected' : ''}`} htmlFor="document-file">
          <span className="upload-symbol" aria-hidden="true">+</span>
          <span className="picker-title">{selectedFile ? 'Arquivo selecionado' : 'Escolher arquivo'}</span>
          <span className="picker-detail">
            {selectedFile
              ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}`
              : 'PDF, Word, Excel, PowerPoint, CSV ou TXT'}
          </span>
          <input
            ref={inputRef}
            id="document-file"
            type="file"
            accept={acceptedFileTypes}
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            disabled={isUploading}
          />
        </label>

        <div className="upload-footer">
          <span className="size-hint">Limite padrão: 10 MB</span>
          <button className="primary-button" type="submit" disabled={!selectedFile || isUploading}>
            {isUploading ? 'Enviando...' : 'Enviar documento'}
          </button>
        </div>
      </form>
    </section>
  );
}