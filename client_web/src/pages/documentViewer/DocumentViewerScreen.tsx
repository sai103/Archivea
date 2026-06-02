import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { Link, useParams } from 'react-router';
import {
  fetchDocuments,
  fetchEpubChapters,
  fetchZipPages,
  getContentUrl,
  getEpubChapterContentUrl,
  getPageContentUrl,
  isSampleDocument,
  type DocumentItem,
  type EpubChapterItem,
  type ZipPageItem,
} from '../../api/documents';
import './DocumentViewerScreen.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// 閲覧画面全体の読み込み状態を表す。
type ViewerState =
  // ドキュメント情報やページ情報を取得中。
  | { status: 'loading' }
  // 取得成功。形式に応じてZIPページ一覧またはEPUB章一覧を持つ。
  | { status: 'success'; document: DocumentItem; pages?: ZipPageItem[]; chapters?: EpubChapterItem[] }
  // 取得失敗またはURLパラメータ不正。
  | { status: 'error'; message: string };

/**
 * ドキュメントが単体画像形式かどうかを判定する。
 */
function isImageDocument(document: DocumentItem) {
  return document.mimeType.startsWith('image/');
}

/**
 * MIME typeを画面表示用の形式名へ変換する。
 */
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

/**
 * APIが返す日時文字列を日本語表示用の日時へ変換する。
 */
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

interface ViewerMetadataProps {
  // メタ情報を表示する対象ドキュメント。
  document: DocumentItem;
}

/**
 * 閲覧画面のヘッダー下に表示するドキュメントメタ情報。
 * 全画面表示ではCSSで非表示にする。
 */
function ViewerMetadata({ document }: ViewerMetadataProps) {
  return (
    <aside className="viewer-metadata" aria-label="ファイル情報">
      <dl>
        <div>
          <dt>ジャンル</dt>
          <dd>{document.genre ?? '未分類'}</dd>
        </div>
        <div>
          <dt>形式</dt>
          <dd>{getDocumentKindLabel(document.mimeType)}</dd>
        </div>
        <div>
          <dt>アップロード日</dt>
          <dd>{formatCreatedAt(document.createdAt)}</dd>
        </div>
      </dl>
    </aside>
  );
}

interface SamplePagePreviewProps {
  // 仮ページとして表示する対象ドキュメント。
  document: DocumentItem;
  // 仮ページ番号。色とページ番号表示に使う。
  pageNumber: number;
  // 小さめ表示が必要な場合のフラグ。現時点では将来拡張用。
  isCompact?: boolean;
}

/**
 * API接続失敗時の仮ドキュメントをページ風に見せるプレビュー。
 */
function SamplePagePreview({ document, pageNumber, isCompact = false }: SamplePagePreviewProps) {
  // ドキュメント形式の表示名。
  const kind = getDocumentKindLabel(document.mimeType);
  // ページ番号に応じて仮ページの色を変えるCSSクラス。
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
  // 仮ビューアで表示する対象ドキュメント。
  document: DocumentItem;
  // ZIP仮データなど、複数ページを持つ場合のページ一覧。
  pages?: ZipPageItem[];
  // 現在表示している0始まりのページ番号。
  selectedPageIndex: number;
  // 表示ページを変更するためのコールバック。
  onChangePage: (pageIndex: number) => void;
  // 全画面表示中かどうか。
  isFullscreen: boolean;
  // 全画面表示を切り替えるコールバック。
  onToggleFullscreen: () => void;
}

interface PdfReaderProps {
  // PDFとして表示する対象ドキュメント。
  document: DocumentItem;
  // 現在表示している0始まりのページ番号。
  selectedPageIndex: number;
  // 1ページ表示または2ページ表示。
  spreadMode: 'single' | 'double';
  // 全画面表示中かどうか。
  isFullscreen: boolean;
  // 表示ページを変更するためのコールバック。
  onChangePage: (pageIndex: number) => void;
  // 1ページ表示/2ページ表示を変更するためのコールバック。
  onChangeSpreadMode: (mode: 'single' | 'double') => void;
  // 全画面表示を切り替えるコールバック。
  onToggleFullscreen: () => void;
}

interface EpubReaderProps {
  // EPUBのspine順に並んだ章一覧。
  chapters: EpubChapterItem[];
  // 現在表示している0始まりの章番号。
  selectedChapterIndex: number;
  // 全画面表示中かどうか。
  isFullscreen: boolean;
  // 表示章を変更するためのコールバック。
  onChangeChapter: (chapterIndex: number) => void;
  // 全画面表示を切り替えるコールバック。
  onToggleFullscreen: () => void;
}

interface PdfPageCanvasProps {
  // pdfjs-distが読み込んだPDFドキュメント。
  pdfDocument: PDFDocumentProxy;
  // 描画対象の0始まりページ番号。
  pageIndex: number;
  // 全画面表示中かどうか。全画面では表示枠に合わせて再描画する。
  isFullscreen: boolean;
}

interface ReaderControlsProps {
  // 操作対象の総ページ数または総章数。
  pageCount: number;
  // 現在選択されている0始まりのページ番号。
  selectedPageIndex: number;
  // ページ送り単位を決める表示モード。
  spreadMode: 'single' | 'double';
  // 1ページ/2ページ切替ボタンを表示するかどうか。
  isSpreadModeEnabled?: boolean;
  // 表示ページを変更するためのコールバック。
  onChangePage: (pageIndex: number) => void;
  // 表示モードを変更するためのコールバック。
  onChangeSpreadMode: (mode: 'single' | 'double') => void;
  // 全画面表示中かどうか。
  isFullscreen: boolean;
  // 全画面表示を切り替えるコールバック。
  onToggleFullscreen: () => void;
}

/**
 * PDF、ZIP画像、EPUBで共通利用するページ操作UI。
 */
function ReaderControls({
  pageCount,
  selectedPageIndex,
  spreadMode,
  isSpreadModeEnabled = true,
  onChangePage,
  onChangeSpreadMode,
  isFullscreen,
  onToggleFullscreen,
}: ReaderControlsProps) {
  // 2ページ表示時はページ送りも2ページ単位にする。
  const pageStep = spreadMode === 'double' ? 2 : 1;
  // 前ページへ移動可能かどうか。
  const canGoPrevious = selectedPageIndex > 0;
  // 現在の表示で見えている最後のページ番号。
  const visibleLastPageIndex = Math.min(pageCount - 1, selectedPageIndex + pageStep - 1);
  // 次ページへ移動可能かどうか。
  const canGoNext = visibleLastPageIndex < pageCount - 1;
  // 全画面中のホイール連続発火をページ単位に抑えるための直近操作時刻。
  const lastWheelNavigationTimeRef = useRef(0);
  // 2ページ表示時にスライダー値を偶数ページ開始へ揃える。
  const normalizePageIndex = (pageIndex: number) => {
    if (spreadMode === 'single') {
      return pageIndex;
    }

    return Math.max(0, pageIndex - (pageIndex % pageStep));
  };

  // 前ページボタン押下時のページ移動処理。
  const handlePrevious = useCallback(() => {
    if (!canGoPrevious) {
      return;
    }

    onChangePage(Math.max(0, selectedPageIndex - pageStep));
  }, [canGoPrevious, onChangePage, pageStep, selectedPageIndex]);

  // 次ページボタン押下時のページ移動処理。
  const handleNext = useCallback(() => {
    if (!canGoNext) {
      return;
    }

    onChangePage(Math.min(pageCount - 1, selectedPageIndex + pageStep));
  }, [canGoNext, onChangePage, pageCount, pageStep, selectedPageIndex]);

  // ページ位置スライダー変更時のページ移動処理。
  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    onChangePage(normalizePageIndex(Number(event.target.value)));
  };

  // 全画面表示中だけ、マウスホイールと左右キーでページ移動できるようにする。
  useEffect(() => {
    if (!isFullscreen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'Left') {
        event.preventDefault();
        handlePrevious();
        return;
      }

      if (event.key === 'ArrowRight' || event.key === 'Right') {
        event.preventDefault();
        handleNext();
      }
    };

    const handleWheel = (event: WheelEvent) => {
      const primaryDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(primaryDelta) < 30) {
        return;
      }

      event.preventDefault();

      const now = Date.now();
      if (now - lastWheelNavigationTimeRef.current < 320) {
        return;
      }

      lastWheelNavigationTimeRef.current = now;
      if (primaryDelta > 0) {
        handleNext();
        return;
      }

      handlePrevious();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [handleNext, handlePrevious, isFullscreen]);

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
        {isSpreadModeEnabled && (
          <>
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
          </>
        )}
        {isFullscreen && (
          <button type="button" onClick={onToggleFullscreen}>
            全画面を解除
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * PDFの1ページをcanvasへ描画するコンポーネント。
 */
function PdfPageCanvas({ pdfDocument, pageIndex, isFullscreen }: PdfPageCanvasProps) {
  // PDFページ表示枠の実寸を測るための要素。
  const pageRef = useRef<HTMLDivElement>(null);
  // PDF描画先のcanvas要素。
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // PDFページ描画の状態。
  const [renderState, setRenderState] = useState<'loading' | 'success' | 'error'>('loading');
  // 全画面時にPDFページを収めるための表示枠サイズ。
  const [pageBoxSize, setPageBoxSize] = useState({ width: 0, height: 0 });

  // 全画面表示中は、ページ表示枠のリサイズに合わせてPDF canvasを再描画する。
  useEffect(() => {
    if (!isFullscreen || !pageRef.current) {
      setPageBoxSize({ width: 0, height: 0 });
      return undefined;
    }

    const pageElement = pageRef.current;
    const updatePageBoxSize = (width: number, height: number) => {
      const nextWidth = Math.floor(width);
      const nextHeight = Math.floor(height);
      setPageBoxSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    updatePageBoxSize(pageElement.clientWidth, pageElement.clientHeight);

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      updatePageBoxSize(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(pageElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isFullscreen]);

  // pageIndexが変わるたびにpdfjsで対象ページを読み込み、canvasへ再描画する。
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

        const baseViewport = page.getViewport({ scale: 1 });
        const fullscreenScale =
          isFullscreen && pageBoxSize.width > 0 && pageBoxSize.height > 0
            ? Math.min(pageBoxSize.width / baseViewport.width, pageBoxSize.height / baseViewport.height)
            : undefined;
        const displayScale = Math.max(0.1, fullscreenScale ?? 1.6);
        const outputScale = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: displayScale * outputScale });
        const displayWidth = Math.floor(baseViewport.width * displayScale);
        const displayHeight = Math.floor(baseViewport.height * displayScale);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('PDF描画コンテキストを取得できませんでした');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

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
  }, [isFullscreen, pageBoxSize.height, pageBoxSize.width, pageIndex, pdfDocument]);

  return (
    <div className="pdf-page" ref={pageRef}>
      {renderState === 'loading' && <p className="pdf-page-status">読み込み中</p>}
      {renderState === 'error' && <p className="pdf-page-status">PDFページを描画できませんでした</p>}
      <canvas
        ref={canvasRef}
        className={renderState === 'success' ? 'pdf-page-canvas' : 'pdf-page-canvas pdf-page-canvas-hidden'}
      />
    </div>
  );
}

/**
 * PDFドキュメントをページ単位で表示するリーダー。
 */
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

  // PDF本文URLをpdfjsで読み込み、ページ数を取得する。
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
        <PdfPageCanvas
          pdfDocument={pdfState.pdfDocument}
          pageIndex={selectedPageIndex}
          isFullscreen={isFullscreen}
        />
        {secondPageIndex !== undefined && (
          <PdfPageCanvas
            pdfDocument={pdfState.pdfDocument}
            pageIndex={secondPageIndex}
            isFullscreen={isFullscreen}
          />
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

/**
 * EPUBの章をiframeで表示するリーダー。
 */
function EpubReader({
  chapters,
  selectedChapterIndex,
  isFullscreen,
  onChangeChapter,
  onToggleFullscreen,
}: EpubReaderProps) {
  // 現在表示するEPUB章。
  const selectedChapter = chapters[selectedChapterIndex];

  if (!selectedChapter) {
    return <p className="viewer-status">EPUBに表示できる章がありません</p>;
  }

  return (
    <div className="epub-reader">
      <div className="page-spread">
        <iframe
          title={selectedChapter.title}
          src={getEpubChapterContentUrl(selectedChapter.contentUrl)}
          className="epub-frame"
          sandbox=""
        />
      </div>

      <ReaderControls
        pageCount={chapters.length}
        selectedPageIndex={selectedChapterIndex}
        spreadMode="single"
        isSpreadModeEnabled={false}
        onChangePage={onChangeChapter}
        onChangeSpreadMode={() => undefined}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />

      <nav className="epub-chapters" aria-label="EPUB章">
        {chapters.map((chapter) => (
          <button
            key={chapter.index}
            type="button"
            className={
              chapter.index === selectedChapterIndex
                ? 'epub-chapter-button epub-chapter-button-active'
                : 'epub-chapter-button'
            }
            onClick={() => onChangeChapter(chapter.index)}
          >
            {chapter.title}
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * APIに接続できない場合の仮データ用リーダー。
 */
function SampleReader({
  document,
  pages,
  selectedPageIndex,
  onChangePage,
  isFullscreen,
  onToggleFullscreen,
}: SampleReaderProps) {
  // 仮リーダー内の1ページ/2ページ表示モード。
  const [spreadMode, setSpreadMode] = useState<'single' | 'double'>('single');
  // 仮データが持つ総ページ数。
  const pageCount = pages?.length ?? document.pageCount ?? 1;
  // 2ページ表示時に右側へ表示するページ番号。
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

/**
 * ドキュメント閲覧画面。
 * URLのdocumentIdから対象ドキュメントを取得し、形式別ビューアへ振り分ける。
 */
export function DocumentViewerScreen() {
  // URLパラメータとして渡されるドキュメントID文字列。
  const { documentId } = useParams();
  // 数値化したドキュメントID。API取得と対象検索に使う。
  const parsedDocumentId = Number(documentId);
  // Fullscreen APIの対象にする閲覧レイアウト要素。
  const viewerLayoutRef = useRef<HTMLElement>(null);
  // 閲覧画面全体の読み込み状態。
  const [viewerState, setViewerState] = useState<ViewerState>({ status: 'loading' });
  // 現在表示しているページ番号またはEPUB章番号。
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  // Fullscreen API上で閲覧レイアウトが全画面表示中かどうか。
  const [isFullscreen, setIsFullscreen] = useState(false);
  // PDF/ZIP画像本で使う1ページ/2ページ表示モード。
  const [zipSpreadMode, setZipSpreadMode] = useState<'single' | 'double'>('single');

  // documentIdが変わった時に対象ドキュメントと形式別の補助データを読み込む。
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

        if (document.mimeType === 'application/epub+zip') {
          const chapters = await fetchEpubChapters(document.id);
          return { document, chapters };
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

  // ブラウザの全画面状態変更をReact stateへ反映する。
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewerLayoutRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // ZIP画像本で現在表示する左側ページを取得する。
  const selectedPage = useMemo(() => {
    if (viewerState.status !== 'success' || !viewerState.pages) {
      return undefined;
    }

    return viewerState.pages[selectedPageIndex];
  }, [selectedPageIndex, viewerState]);

  /**
   * 閲覧領域の全画面表示を切り替える。
   */
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

        {viewerState.status === 'success' && <ViewerMetadata document={viewerState.document} />}

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
            <EpubReader
              chapters={viewerState.chapters ?? []}
              selectedChapterIndex={selectedPageIndex}
              isFullscreen={isFullscreen}
              onChangeChapter={setSelectedPageIndex}
              onToggleFullscreen={() => {
                void handleToggleFullscreen();
              }}
            />
          ))}
      </section>
    </main>
  );
}
