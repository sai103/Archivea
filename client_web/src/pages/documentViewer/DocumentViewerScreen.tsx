import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  fetchDocuments,
  fetchZipPages,
  getContentUrl,
  getPageContentUrl,
  type DocumentItem,
  type ZipPageItem,
} from '../../api/documents';
import './DocumentViewerScreen.css';

type ViewerState =
  | { status: 'loading' }
  | { status: 'success'; document: DocumentItem; pages?: ZipPageItem[] }
  | { status: 'error'; message: string };

function isImageDocument(document: DocumentItem) {
  return document.mimeType.startsWith('image/');
}

export function DocumentViewerScreen() {
  const { documentId } = useParams();
  const parsedDocumentId = Number(documentId);
  const [viewerState, setViewerState] = useState<ViewerState>({ status: 'loading' });
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    if (!Number.isInteger(parsedDocumentId) || parsedDocumentId <= 0) {
      setViewerState({ status: 'error', message: 'ファイルIDが正しくありません' });
      return () => {
        isActive = false;
      };
    }

    fetchDocuments()
      .then(async (documents) => {
        const document = documents.find((item) => item.id === parsedDocumentId);
        if (!document) {
          throw new Error('ファイルが見つかりません');
        }

        if (document.mimeType === 'application/zip') {
          const pages = await fetchZipPages(document.id);
          return { document, pages };
        }

        return { document };
      })
      .then((result) => {
        if (isActive) {
          setSelectedPageIndex(0);
          setViewerState({ status: 'success', ...result });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          const message = error instanceof Error ? error.message : 'ファイルを開けませんでした';
          setViewerState({ status: 'error', message });
        }
      });

    return () => {
      isActive = false;
    };
  }, [parsedDocumentId]);

  const selectedPage = useMemo(() => {
    if (viewerState.status !== 'success' || !viewerState.pages) {
      return undefined;
    }

    return viewerState.pages[selectedPageIndex];
  }, [selectedPageIndex, viewerState]);

  return (
    <main className="viewer-shell">
      <section className="viewer-layout" aria-labelledby="viewer-title">
        <header className="viewer-header">
          <div>
            <p className="app-name">Archivea</p>
            <h1 id="viewer-title">
              {viewerState.status === 'success' ? viewerState.document.title : '閲覧'}
            </h1>
          </div>
          <Link to="/documents" className="viewer-back-link">
            閲覧メニューへ戻る
          </Link>
        </header>

        {viewerState.status === 'loading' && <p className="viewer-status">読み込み中です</p>}

        {viewerState.status === 'error' && (
          <p className="viewer-status viewer-status-error" role="alert">
            {viewerState.message}
          </p>
        )}

        {viewerState.status === 'success' && isImageDocument(viewerState.document) && (
          <div className="viewer-canvas">
            <img
              src={getContentUrl(viewerState.document.id)}
              alt={viewerState.document.title}
              className="viewer-image"
            />
          </div>
        )}

        {viewerState.status === 'success' && viewerState.document.mimeType === 'application/pdf' && (
          <iframe
            src={getContentUrl(viewerState.document.id)}
            title={viewerState.document.title}
            className="viewer-frame"
          />
        )}

        {viewerState.status === 'success' && viewerState.document.mimeType === 'application/zip' && (
          <div className="zip-viewer">
            {viewerState.pages && viewerState.pages.length > 0 && selectedPage ? (
              <>
                <div className="viewer-canvas">
                  <img
                    src={getPageContentUrl(selectedPage.contentUrl)}
                    alt={`${viewerState.document.title} ${selectedPage.filename}`}
                    className="viewer-image"
                  />
                </div>

                <nav className="zip-pages" aria-label="ZIPページ">
                  {viewerState.pages.map((page) => (
                    <button
                      key={page.index}
                      type="button"
                      className={
                        page.index === selectedPageIndex
                          ? 'zip-page-button zip-page-button-active'
                          : 'zip-page-button'
                      }
                      onClick={() => setSelectedPageIndex(page.index)}
                    >
                      {page.filename}
                    </button>
                  ))}
                </nav>
              </>
            ) : (
              <p className="viewer-status">ZIPに画像ページがありません</p>
            )}
          </div>
        )}

        {viewerState.status === 'success' &&
          viewerState.document.mimeType === 'application/epub+zip' && (
            <p className="viewer-status">EPUBビューアは未実装です</p>
          )}
      </section>
    </main>
  );
}
