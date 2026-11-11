import DownloadButton from './DownloadButton.jsx';
import { formatFileSize } from '../utils/formatFileSize.js';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatUploadDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : dateFormatter.format(date);
}

export default function DocumentList({
  documents,
  isLoading,
  downloadingId,
  onDownload,
  onRefresh,
}) {
  return (
    <section className="documents-panel" aria-labelledby="documents-title">
      <div className="documents-heading">
        <div>
          <div className="section-index">02 <span>BIBLIOTECA</span></div>
          <h2 id="documents-title">Seus arquivos</h2>
        </div>
        <button
          className="refresh-button"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Atualizar lista de documentos"
          title="Atualizar lista"
        >
          <span aria-hidden="true">↻</span>
        </button>
      </div>

      {isLoading ? (
        <div className="list-state" role="status">Carregando documentos...</div>
      ) : documents.length === 0 ? (
        <div className="list-state empty-state">
          <span className="empty-mark" aria-hidden="true">—</span>
          <h3>Nenhum documento ainda</h3>
          <p>Os arquivos enviados aparecerão aqui.</p>
        </div>
      ) : (
        <>
          <div className="table-scroll">
            <table className="document-table">
              <thead>
                <tr>
                  <th scope="col">NOME</th>
                  <th scope="col">TAMANHO</th>
                  <th scope="col">ENVIADO EM</th>
                  <th scope="col"><span className="visually-hidden">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="document-name-cell">
                      <span className="document-file">
                        <span className="file-chip" aria-hidden="true">
                          {document.originalName.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'}
                        </span>
                        <span className="document-name" title={document.originalName}>
                          {document.originalName}
                        </span>
                      </span>
                    </td>
                    <td className="metadata-cell">{formatFileSize(document.size)}</td>
                    <td className="metadata-cell">{formatUploadDate(document.uploadedAt)}</td>
                    <td className="action-cell">
                      <DownloadButton
                        document={document}
                        isDownloading={downloadingId === document.id}
                        onDownload={onDownload}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="list-footnote">{documents.length} {documents.length === 1 ? 'documento' : 'documentos'} armazenados</p>
        </>
      )}
    </section>
  );
}