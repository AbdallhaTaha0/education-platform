import { Button } from "../../../components/ui/Button";
import { PaginatedCollection } from "../../../components/ui/Pagination";
/** Entitlement-protected student lesson-file downloads. */
import { useEffect, useRef, useState } from "react";
import { LearningApiError } from "../api/client";
import { lessonMaterialsApi } from "./api";
import { formatByteSize, resourceLabel, type MaterialResource } from "./types";
import { safeDownloadName } from "./downloads";

export function ResourcesPanel({
  lang,
  loading,
  errorCode,
  resources,
  onRetry,
  onAccessLost,
}: {
  lang: "ar" | "en";
  loading: boolean;
  errorCode: string | null;
  resources: MaterialResource[];
  onRetry: () => void;
  onAccessLost?: () => void;
}): JSX.Element {
  const downloadUrls = useRef(new Set<string>());
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    return () => {
      generation.current++;
      for (const url of downloadUrls.current) URL.revokeObjectURL(url);
      downloadUrls.current.clear();
    };
  }, [resources]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function download(resource: MaterialResource): Promise<void> {
    if (downloadingId !== null) return;
    const current = generation.current;
    setDownloadingId(resource.id);
    setDownloadError(null);
    let url: string | null = null;
    try {
      const result = await lessonMaterialsApi.downloadResource(resource.id);
      if (current !== generation.current) return;
      const blobUrl = URL.createObjectURL(result.blob);
      url = blobUrl;
      downloadUrls.current.add(blobUrl);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = safeDownloadName(
        result.fileName || resource.fileName,
        `resource-${resource.id}`,
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoke shortly after the click so the link is temporary, not permanent.
      window.setTimeout(() => {
        if (url !== null) {
          URL.revokeObjectURL(url);
          downloadUrls.current.delete(url);
        }
      }, 5000);
    } catch (err) {
      if (current !== generation.current) return;
      const code = err instanceof LearningApiError ? err.code : "UNKNOWN";
      setDownloadError(code);
      if (
        [
          "SUBSCRIPTION_EXPIRED",
          "SUBSCRIPTION_REQUIRED",
          "LESSON_NOT_FOUND",
          "ASSESSMENTS_REQUIRED",
          "FORBIDDEN",
          "UNAUTHENTICATED",
        ].includes(code)
      )
        onAccessLost?.();
    } finally {
      if (current === generation.current) setDownloadingId(null);
    }
  }

  return (
    <section
      aria-label={lang === "ar" ? "ملفات الدرس" : "Lesson files"}
      data-testid="resources-panel"
      className="mt-4 rounded-card border border-border bg-surface p-4"
    >
      <h3 className="text-base font-bold">
        {lang === "ar" ? "ملفات الدرس" : "Lesson files"}
      </h3>
      {loading ? (
        <p role="status" className="mt-2 text-sm text-muted">
          {lang === "ar" ? "جارٍ تحميل الملفات…" : "Loading files…"}
        </p>
      ) : null}
      {errorCode !== null && !loading ? (
        <div className="mt-2">
          <p role="alert" className="text-sm font-semibold text-error-fg">
            {lang === "ar"
              ? "تعذّر تحميل الملفات. حاول مرة أخرى."
              : "Could not load files. Please retry."}
          </p>
          <button
            type="button"
            data-testid="resources-retry"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-[44px] items-center rounded-control border border-border px-3 text-sm font-bold"
          >
            {lang === "ar" ? "إعادة المحاولة" : "Retry"}
          </button>
        </div>
      ) : null}
      {!loading && errorCode === null && resources.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {lang === "ar"
            ? "لا توجد ملفات مرفقة لهذا الدرس."
            : "No files attached to this lesson."}
        </p>
      ) : null}
      {resources.length > 0 ? (
        <PaginatedCollection
          as="ul"
          id="lesson-resources"
          className="mt-2 space-y-2"
        >
          {resources.map((resource) => (
            <li
              key={resource.id}
              data-testid="resource-row"
              className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-canvas px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-semibold">
                  {resourceLabel(resource, lang)}
                </span>
                <span dir="ltr" className="mt-1 block text-xs text-muted">
                  {resource.fileName} · {resource.mimeType} ·{" "}
                  {formatByteSize(resource.byteSize, lang)}
                </span>
              </span>
              <Button
                unstyled
                type="button"
                data-testid={`resource-download-${resource.id}`}
                disabled={downloadingId !== null}
                onClick={() => void download(resource)}
                className="inline-flex min-h-[44px] items-center rounded-control border border-border px-3 text-sm font-bold"
              >
                {downloadingId === resource.id
                  ? lang === "ar"
                    ? "جارٍ التحميل…"
                    : "Downloading…"
                  : lang === "ar"
                    ? "تحميل"
                    : "Download"}
              </Button>
            </li>
          ))}
        </PaginatedCollection>
      ) : null}
      {downloadError !== null ? (
        <p
          role="alert"
          data-testid="resource-download-error"
          className="mt-2 text-sm font-semibold text-error-fg"
        >
          {lang === "ar"
            ? "تعذّر تحميل الملف. تحقق من الاشتراك وحاول مرة أخرى."
            : "Could not download the file. Check your subscription and retry."}
        </p>
      ) : null}
    </section>
  );
}
