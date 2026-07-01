import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { assetUrl } from '../lib/api';

type DocumentViewerProps = {
  frontUrl: string | null;
  backUrl: string | null;
  selfieUrl?: string | null;
};

type DocumentSide = 'front' | 'back' | 'selfie';

type DocumentItem = {
  side: DocumentSide;
  label: string;
  url: string;
  alt: string;
};

function DocumentThumbnail({
  label,
  url,
  alt,
  hasError,
  onError,
  onOpen,
}: {
  label: string;
  url: string;
  alt: string;
  hasError: boolean;
  onError: () => void;
  onOpen: () => void;
}) {
  if (hasError) {
    return (
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
        </p>
        <div className="flex min-h-[160px] items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-canvas-subtle)] p-4 text-center text-sm text-[var(--color-text-muted)]">
          Could not load image.
          <a href={url} target="_blank" rel="noreferrer" className="ml-1 text-[var(--color-accent)] hover:underline">
            Open directly
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="group relative block w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-canvas-subtle)] text-left transition hover:border-[var(--color-border-strong)] hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
        aria-label={`View ${label.toLowerCase()} document in full size`}
      >
        <img
          src={url}
          alt={alt}
          onError={onError}
          className="max-h-80 w-full object-contain"
        />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
          Click to enlarge
        </span>
      </button>
    </div>
  );
}

function DocumentLightbox({
  documents,
  activeSide,
  onClose,
  onChange,
}: {
  documents: DocumentItem[];
  activeSide: DocumentSide;
  onClose: () => void;
  onChange: (side: DocumentSide) => void;
}) {
  const activeIndex = documents.findIndex((doc) => doc.side === activeSide);
  const active = documents[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < documents.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onChange(documents[activeIndex - 1].side);
  }, [activeIndex, documents, hasPrev, onChange]);

  const goNext = useCallback(() => {
    if (hasNext) onChange(documents[activeIndex + 1].side);
  }, [activeIndex, documents, hasNext, onChange]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') goPrev();
      if (event.key === 'ArrowRight') goNext();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(10,37,64,0.72)] p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${active.label} identity document`}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-[var(--color-heading)]">{active.label}</p>
            {documents.length > 1 ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                {activeIndex + 1} of {documents.length} — use arrow keys to switch
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={active.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)]"
            >
              Open in tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-canvas-subtle)] hover:text-[var(--color-heading)]"
              aria-label="Close document viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-[50vh] flex-1 items-center justify-center bg-[var(--color-canvas-subtle)] p-4 sm:p-6">
          {hasPrev ? (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-heading)] shadow-sm transition hover:bg-[var(--color-canvas-subtle)]"
              aria-label="View previous document"
            >
              <ChevronLeft size={20} />
            </button>
          ) : null}

          <img
            src={active.url}
            alt={active.alt}
            className="max-h-[calc(92vh-8rem)] w-full object-contain"
          />

          {hasNext ? (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-heading)] shadow-sm transition hover:bg-[var(--color-canvas-subtle)]"
              aria-label="View next document"
            >
              <ChevronRight size={20} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DocumentViewer({ frontUrl, backUrl, selfieUrl }: DocumentViewerProps) {
  const front = assetUrl(frontUrl);
  const back = assetUrl(backUrl);
  const selfie = assetUrl(selfieUrl);
  const [frontError, setFrontError] = useState(false);
  const [backError, setBackError] = useState(false);
  const [selfieError, setSelfieError] = useState(false);
  const [lightboxSide, setLightboxSide] = useState<DocumentSide | null>(null);

  const documents: DocumentItem[] = [
    front && !frontError
      ? { side: 'front', label: 'ID front', url: front, alt: 'Document front' }
      : null,
    selfie && !selfieError
      ? { side: 'selfie', label: 'Selfie', url: selfie, alt: 'Customer selfie' }
      : null,
    back && !backError
      ? { side: 'back', label: 'ID back', url: back, alt: 'Document back' }
      : null,
  ].filter((doc): doc is DocumentItem => doc !== null);

  if (!front && !back && !selfie) {
    return <p className="text-sm text-[var(--color-text-muted)]">No documents uploaded.</p>;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {front ? (
          <DocumentThumbnail
            label="ID front"
            url={front}
            alt="Document front"
            hasError={frontError}
            onError={() => setFrontError(true)}
            onOpen={() => setLightboxSide('front')}
          />
        ) : null}
        {selfie ? (
          <DocumentThumbnail
            label="Selfie"
            url={selfie}
            alt="Customer selfie"
            hasError={selfieError}
            onError={() => setSelfieError(true)}
            onOpen={() => setLightboxSide('selfie')}
          />
        ) : null}
        {back ? (
          <DocumentThumbnail
            label="ID back"
            url={back}
            alt="Document back"
            hasError={backError}
            onError={() => setBackError(true)}
            onOpen={() => setLightboxSide('back')}
          />
        ) : null}
      </div>

      {lightboxSide && documents.length > 0 ? (
        <DocumentLightbox
          documents={documents}
          activeSide={lightboxSide}
          onClose={() => setLightboxSide(null)}
          onChange={setLightboxSide}
        />
      ) : null}
    </>
  );
}
