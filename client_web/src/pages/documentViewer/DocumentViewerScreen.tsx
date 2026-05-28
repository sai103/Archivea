import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { Link, useParams } from 'react-router';
import {
  fetchDocuments,
  fetchZipPages,
  getContentUrl,
  getPageContentUrl,
  isSampleDocument,
  type DocumentItem,
  type ZipPageItem,
} from '../../api/documents';
import './DocumentViewerScreen.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type ViewerState =
  | { status: 'loading' }
  | { status: 'success'; document: DocumentItem; pages?: ZipPageItem[] }
  | { status: 'error'; message: string };

function isImageDocument(document: DocumentItem) {
  return document.mimeType.startsWith('image/');
}

function getDocumentKindLabel(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return 'PDF';
  }

  if (mimeType === 'application/zip') {
    return 'ZIP画像';
  }

  if (mimeType === 'application/epub+zip') {
    return 'EPUB';
  }

  if (mimeType.startsWith('image/')) {
    return '画像';
  }

  return mimeType;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

interface SamplePagePreviewProps {
  document: DocumentItem;
  pageNumber: number;
  isCompact?: boolean;
}

function SamplePagePreview({ document, pageNumber, isCompact = false }: SamplePagePreviewProps) {
  const kind = getDocumentKindLabel(document.mimeType);
  const pageTone = ['sample-page-green', 'sample-page-blue', 'sample-page-ink', 'sample-page-red'][
    pageNumber % 4
  ];

  return (
    <article className={`sample-page ${pageTone}${isCompact ? ' sample-page-compact' : ''}`}>
      <div className="sample-page-cover">
        <span>{kind}</span>
        <strong>{document.title}</strong>
      </div>
      <div className="sample-page-lines" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <footer className="sample-page-footer">
        <span>{document.genre ?? '未分類'}</span>
        <span>{pageNumber + 1}</span>
      </footer>
    </article>
  );
}

interface SampleReaderProps {
  document: DocumentItem;
  pages?: ZipPageItem[];
  selectedPageIndex: number;
  onChangePage: (pageIndex: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

interface PdfReaderProps {
  document: DocumentItem;
  selectedPageIndex: number;
  spreadMode: 'single' | 'double';
  isFullscreen: boolean;
  onChangePage: (pageIndex: number) => void;
  onChangeSpreadMode: (mode: 'single' | 'double') => void;
  onToggleFullscreen: () => void;
}

interface PdfPageCanvasProps {
  pdfDocument: PDFDocumentProxy;
  pageIndex: number;
}

interface ReaderControlsProps {
  pageCount: number;
  selectedPageIndex: number;
  spreadMode: 'single' | 'double';
  onChangePage: (pageIndex: number) => void;
  onChangeSpreadMode: (mode: 'single' | 'double') => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

function ReaderControls({
  pageCount,
  selectedPageIndex,
  spreadMode,
  onChangePage,
  onChangeSpreadMode,
  isFullscreen,
  onToggleFullscreen,
}: ReaderControlsProps) {
  const pageStep = spreadMode === 'double' ? 2 : 1;
  const canGoPrevious = selectedPageIndex > 0;
  const visibleLastPageIndex = Math.min(pageCount - 1, selectedPageIndex + pageStep - 1);
  const canGoNext = visibleLastPageIndex < pageCount - 1;
  const normalizePageIndex = (pageIndex: number) => {
    if (spreadMode === 'single') {
      return pageIndex;
    }

    return Math.max(0, pageIndex - (pageIndex % pageStep));
  };

  const handlePrevious = () => {
    onChangePage(Math.max(0, selectedPageIndex - pageStep));
  };

  const handleNext = () => {
    onChangePage(Math.min(pageCount - 1, selectedPageIndex + pageStep));
  };

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    onChangePage(normalizePageIndex(Number(event.target.value)));
  };

  return (
    <div className="reader-controls">
      <div className="reader-page-counter">
        {selectedPageIndex + 1} / {pageCount}
      </div>
      <input
        type="range"
        min="0"
        max={Math.max(0, pageCount - 1)}
        value={selectedPageIndex}
        onChange={handleSeek}
        className="reader-seek"
        aria-label="ページ位置"
      />
      <div className="reader-control-actions">
        <button type="button" onClick={handlePrevious} disabled={!canGoPrevious}>
          前へ
        </button>
        <button type="button" onClick={handleNext} disabled={!canGoNext}>
          次へ
        </button>
        <button
          type="button"
          className={spreadMode === 'single' ? 'reader-mode-active' : undefined}
          onClick={() => onChangeSpreadMode('single')}
        >
          1ページ
        </button>
        <button
          type="button"
          className={spreadMode === 'double' ? 'reader-mode-active' : undefined}
          onClick={() => onChangeSpreadMode('double')}
        >
          2ページ
        </button>
        {isFullscreen && (
          <button type="button" onClick={onToggleFullscreen}>
            全画面を解除
          </button>
        )}
      </div>
    </div>
  );
}

function PdfPageCanvas({ pdfDocument, pageIndex }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderState, setRenderState] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let isActive = true;
    let renderTask: ReturnType<PDFPageProxy['render']> | undefined;

    setRenderState('loading');

    pdfDocument
      .getPage(pageIndex + 1)
      .then((page: PDFPageProxy) => {
        if (!isActive || !canvasRef.current) {
          return;
        }

        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('PDF描画コンテキストを取得できませんでした');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });

        return renderTask.promise;
      })
      .then(() => {
        if (isActive) {
          setRenderState('success');
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        const isCancelled =
          typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          error.name === 'RenderingCancelledException';
        if (!isCancelled) {
          setRenderState('error');
        }
      });

    return () => {
      isActive = false;
      renderTask?.cancel();
    };
  }, [pageIndex, pdfDocument]);

  return (
    <div className="pdf-page">
      {renderState === 'loading' && <p className="pdf-page-status">読み込み中</p>}
      {renderState === 'error' && <p className="pdf-page-status">PDFページを描画できませんでした</p>}
      <canvas
        ref={canvasRef}
        className={renderState === 'success' ? 'pdf-page-canvas' : 'pdf-page-canvas pdf-page-canvas-hidden'}
      />
    </div>
  );
}

function PdfReader({
  document,
  selectedPageIndex,
  spreadMode,
  isFullscreen,
  onChangePage,
  onChangeSpreadMode,
  onToggleFullscreen,
}: PdfReaderProps) {
  const [pdfState, setPdfState] = useState<
    | { status: 'loading' }
    | { status: 'success'; pdfDocument: PDFDocumentProxy; pageCount: number }
    | { status: 'error'; message: string }
  >({ status: 'loading' });

  useEffect(() => {
    let isActive = true;
    const loadingTask = pdfjsLib.getDocument(getContentUrl(document.id));

    setPdfState({ status: 'loading' });

    loadingTask.promise
      .then((pdfDocument) => {
        if (isActive) {
          setPdfState({
            status: 'success',
            pdfDocument,
            pageCount: pdfDocument.numPages,
          });
          onChangePage(0);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          const message = error instanceof Error ? error.message : 'PDFを読み込めませんでした';
          setPdfState({ status: 'error', message });
        }
      });

    return () => {
      isActive = false;
      loadingTask.destroy();
    };
  }, [document.id, onChangePage]);

  if (pdfState.status === 'loading') {
    return <p className="viewer-status">PDFを読み込み中です</p>;
  }

  if (pdfState.status === 'error') {
    return (
      <p className="viewer-status viewer-status-error" role="alert">
        {pdfState.message}
      </p>
    );
  }

  const secondPageIndex =
    spreadMode === 'double' && selectedPageIndex + 1 < pdfState.pageCount
      ? selectedPageIndex + 1
      : undefined;

  return (
    <div className="paged-reader">
      <div className={secondPageIndex === undefined ? 'page-spread' : 'page-spread page-spread-double'}>
        <PdfPageCanvas pdfDocument={pdfState.pdfDocument} pageIndex={selectedPageIndex} />
        {secondPageIndex !== undefined && (
          <PdfPageCanvas pdfDocument={pdfState.pdfDocument} pageIndex={secondPageIndex} />
        )}
      </div>
      <ReaderControls
        pageCount={pdfState.pageCount}
        selectedPageIndex={selectedPageIndex}
        spreadMode={spreadMode}
        onChangePage={onChangePage}
        onChangeSpreadMode={onChangeSpreadMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    </div>
  );
}

function SampleReader({
  document,
  pages,
  selectedPageIndex,
  onChangePage,
  isFullscreen,
  onToggleFullscreen,
}: SampleReaderProps) {
  const [spreadMode, setSpreadMode] = useState<'single' | 'double'>('single');
  const pageCount = pages?.length ?? document.pageCount ?? 1;
  const secondPageIndex =
    spreadMode === 'double' && selectedPageIndex + 1 < pageCount ? selectedPageIndex + 1 : undefined;

  return (
    <div className="sample-reader">
      <aside className="viewer-details" aria-label="ファイル情報">
        <dl>
          <div>
            <dt>種類</dt>
            <dd>{getDocumentKindLabel(document.mimeType)}</dd>
          </div>
          <div>
            <dt>ジャンル</dt>
            <dd>{document.genre ?? '未分類'}</dd>
          </div>
          <div>
            <dt>作成日時</dt>
            <dd>{formatCreatedAt(document.createdAt)}</dd>
          </div>
          <div>
            <dt>ページ数</dt>
            <dd>{pageCount}</dd>
          </div>
        </dl>
        {document.summary && <p>{document.summary}</p>}
      </aside>

      <section className="sample-reader-main" aria-label="仮ビューア">
        <div className={secondPageIndex === undefined ? 'page-spread' : 'page-spread page-spread-double'}>
          <SamplePagePreview document={document} pageNumber={selectedPageIndex} />
          {secondPageIndex !== undefined && (
            <SamplePagePreview document={document} pageNumber={secondPageIndex} />
          )}
        </div>

        <ReaderControls
          pageCount={pageCount}
          selectedPageIndex={selectedPageIndex}
          spreadMode={spreadMode}
          onChangePage={onChangePage}
          onChangeSpreadMode={setSpreadMode}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
        />

        {pages && pages.length > 0 && (
          <nav className="zip-pages" aria-label="ZIPページ">
            {pages.map((page) => (
              <button
                key={page.index}
                type="button"
                className={
                  page.index === selectedPageIndex
                    ? 'zip-page-button zip-page-button-active'
                    : 'zip-page-button'
                }
                onClick={() => onChangePage(page.index)}
              >
                {page.filename}
              </button>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}

export function DocumentViewerScreen() {
  const { documentId } = useParams();
  const parsedDocumentId = Number(documentId);
  const viewerLayoutRef = useRef<HTMLElement>(null);
  const [viewerState, setViewerState] = useState<ViewerState>({ status: 'loading' });
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zipSpreadMode, setZipSpreadMode] = useState<'single' | 'double'>('single');

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
          setZipSpreadMode('single');
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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewerLayoutRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const selectedPage = useMemo(() => {
    if (viewerState.status !== 'success' || !viewerState.pages) {
      return undefined;
    }

    return viewerState.pages[selectedPageIndex];
  }, [selectedPageIndex, viewerState]);

  const handleToggleFullscreen = async () => {
    if (!viewerLayoutRef.current) {
      return;
    }

    if (document.fullscreenElement === viewerLayoutRef.current) {
      await document.exitFullscreen();
      return;
    }

    await viewerLayoutRef.current.requestFullscreen();
  };

  return (
    <main className="viewer-shell">
      <section className="viewer-layout" aria-labelledby="viewer-title" ref={viewerLayoutRef}>
        <header className="viewer-header">
          <div>
            <p className="app-name">Archivea</p>
            <h1 id="viewer-title">
              {viewerState.status === 'success' ? viewerState.document.title : '閲覧'}
            </h1>
          </div>
          <div className="viewer-actions">
            {viewerState.status === 'success' && (
              <button
                type="button"
                className="viewer-action-button"
                onClick={() => {
                  void handleToggleFullscreen();
                }}
              >
                {isFullscreen ? '全画面を解除' : '全画面表示'}
              </button>
            )}
            <Link to="/documents" className="viewer-back-link">
              閲覧メニューへ戻る
            </Link>
          </div>
        </header>

        {viewerState.status === 'loading' && <p className="viewer-status">読み込み中です</p>}

        {viewerState.status === 'error' && (
          <p className="viewer-status viewer-status-error" role="alert">
            {viewerState.message}
          </p>
        )}

        {viewerState.status === 'success' && isImageDocument(viewerState.document) && (
          isSampleDocument(viewerState.document) ? (
            <SampleReader
              document={viewerState.document}
              selectedPageIndex={selectedPageIndex}
              onChangePage={setSelectedPageIndex}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                void handleToggleFullscreen();
              }}
            />
          ) : (
            <div className="single-viewer">
                <div className="page-spread">
                  <img
                    src={getContentUrl(viewerState.document.id)}
                    alt={viewerState.document.title}
                    className="reader-image"
                  />
                </div>
              <ReaderControls
                pageCount={1}
                selectedPageIndex={0}
                spreadMode="single"
                onChangePage={setSelectedPageIndex}
                onChangeSpreadMode={setZipSpreadMode}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => {
                  void handleToggleFullscreen();
                }}
              />
            </div>
          )
        )}

        {viewerState.status === 'success' && viewerState.document.mimeType === 'application/pdf' && (
          isSampleDocument(viewerState.document) ? (
            <SampleReader
              document={viewerState.document}
              selectedPageIndex={selectedPageIndex}
              onChangePage={setSelectedPageIndex}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                void handleToggleFullscreen();
              }}
            />
          ) : (
            <div className="single-viewer">
              <PdfReader
                document={viewerState.document}
                selectedPageIndex={selectedPageIndex}
                spreadMode={zipSpreadMode}
                isFullscreen={isFullscreen}
                onChangePage={setSelectedPageIndex}
                onChangeSpreadMode={setZipSpreadMode}
                onToggleFullscreen={() => {
                  void handleToggleFullscreen();
                }}
              />
            </div>
          )
        )}

        {viewerState.status === 'success' && viewerState.document.mimeType === 'application/zip' && (
          isSampleDocument(viewerState.document) ? (
            <SampleReader
              document={viewerState.document}
              pages={viewerState.pages}
              selectedPageIndex={selectedPageIndex}
              onChangePage={setSelectedPageIndex}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                void handleToggleFullscreen();
              }}
            />
          ) : (
            <div className="zip-viewer">
              {viewerState.pages && viewerState.pages.length > 0 && selectedPage ? (
                <>
                  <div
                    className={
                      zipSpreadMode === 'double' && selectedPageIndex + 1 < viewerState.pages.length
                        ? 'page-spread page-spread-double'
                        : 'page-spread'
                    }
                  >
                    <img
                      src={getPageContentUrl(selectedPage.contentUrl)}
                      alt={`${viewerState.document.title} ${selectedPage.filename}`}
                      className="reader-image"
                    />
                    {zipSpreadMode === 'double' && viewerState.pages[selectedPageIndex + 1] && (
                      <img
                        src={getPageContentUrl(viewerState.pages[selectedPageIndex + 1].contentUrl)}
                        alt={`${viewerState.document.title} ${viewerState.pages[selectedPageIndex + 1].filename}`}
                        className="reader-image"
                      />
                    )}
                  </div>

                  <ReaderControls
                    pageCount={viewerState.pages.length}
                    selectedPageIndex={selectedPageIndex}
                    spreadMode={zipSpreadMode}
                    onChangePage={setSelectedPageIndex}
                    onChangeSpreadMode={setZipSpreadMode}
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={() => {
                      void handleToggleFullscreen();
                    }}
                  />

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
          )
        )}

        {viewerState.status === 'success' &&
          viewerState.document.mimeType === 'application/epub+zip' &&
          (isSampleDocument(viewerState.document) ? (
            <SampleReader
              document={viewerState.document}
              selectedPageIndex={selectedPageIndex}
              onChangePage={setSelectedPageIndex}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                void handleToggleFullscreen();
              }}
            />
          ) : (
            <div className="viewer-status-group">
              <p className="viewer-status">EPUBビューアは未実装です</p>
              <aside className="viewer-details viewer-details-standalone" aria-label="ファイル情報">
                <dl>
                  <div>
                    <dt>種類</dt>
                    <dd>{getDocumentKindLabel(viewerState.document.mimeType)}</dd>
                  </div>
                  <div>
                    <dt>ジャンル</dt>
                    <dd>{viewerState.document.genre ?? '未分類'}</dd>
                  </div>
                  <div>
                    <dt>作成日時</dt>
                    <dd>{formatCreatedAt(viewerState.document.createdAt)}</dd>
                  </div>
                </dl>
              </aside>
            </div>
          ))}
      </section>
    </main>
  );
}
