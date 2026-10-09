import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiResponse } from "../../../auth";
import { adminLessonMaterialsApi, lessonMaterialsApi } from "./api";

const denied = (code = "TOKEN_MISSING", status = 401) =>
  new Response(
    JSON.stringify({ error: { code, message: "Synthetic error" } }),
    { status, headers: { "Content-Type": "application/json" } },
  );
const json = (data: unknown) =>
  new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
let cookie: { cookie: string };
beforeEach(() => {
  cookie = { cookie: "edu_csrf=before-refresh" };
  vi.stubGlobal("document", cookie);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("material requests share cookie-session refresh", () => {
  it("preserves binary bytes, MIME and Unicode filename after refresh", async () => {
    const bytes = new Uint8Array([0, 255, 128, 10]);
    let refreshed = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/auth/refresh")) {
          refreshed = true;
          return json({});
        }
        return refreshed
          ? new Response(bytes, {
              headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("ملف.pdf")}`,
              },
            })
          : denied("TOKEN_INVALID");
      }),
    );
    const result = await lessonMaterialsApi.downloadResource("resource");
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes);
    expect(result.fileName).toBe("ملف.pdf");
    expect(result.mimeType).toBe("application/pdf");
  });

  it("retries resource FormData only after auth rejection, with fresh CSRF", async () => {
    const forms: FormData[] = [];
    const csrf: string[] = [];
    let refreshed = false;
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        cookie.cookie = "edu_csrf=after-refresh";
        refreshed = true;
        return json({});
      }
      if (url.endsWith("/auth/me")) return refreshed ? json({}) : denied();
      const headers = new Headers(init.headers);
      expect(headers.has("Content-Type")).toBe(false); // Browser owns multipart boundary.
      forms.push(init.body as FormData);
      csrf.push(headers.get("x-csrf-token")!);
      return refreshed ? json({ resource: { id: "resource" } }) : denied();
    });
    vi.stubGlobal("fetch", fetcher);
    await adminLessonMaterialsApi.uploadResource(
      "lesson",
      { labelAr: "ملف", labelEn: "File" },
      new File(["code"], "test.js", { type: "application/javascript" }),
    );
    expect(await (forms[1].get("file") as File).text()).toBe("code");
    expect(JSON.parse(forms[1].get("metadata") as string)).toEqual({
      labelAr: "ملف",
      labelEn: "File",
    });
    expect(forms).toHaveLength(2);
    expect(forms[0]).toBe(forms[1]);
    expect(csrf).toEqual(["before-refresh", "after-refresh"]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("shares one in-flight refresh between JSON, metadata and resource requests", async () => {
    let release!: () => void;
    let started!: () => void;
    let refreshed = false;
    const barrier = new Promise<void>((r) => {
      release = r;
    });
    const pending = new Promise<void>((r) => {
      started = r;
    });
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        started();
        await barrier;
        refreshed = true;
        return json({});
      }
      if (!refreshed) return denied();
      return url.endsWith("/auth/me")
        ? json({ user: { role: "STUDENT" } })
        : url.endsWith("/materials")
          ? json({ lessonId: "lesson", resources: [] })
          : new Response("content");
    });
    vi.stubGlobal("fetch", fetcher);
    const requests = Promise.all([
      apiFetch("/auth/me"),
      lessonMaterialsApi.getLessonMaterials("lesson"),
      lessonMaterialsApi.downloadResource("r"),
    ]);
    await pending;
    await new Promise((r) => setTimeout(r, 10));
    release();
    await requests;
    expect(
      fetcher.mock.calls.filter((c) => c[0].endsWith("/auth/refresh")),
    ).toHaveLength(1);
  });

  it.each([
    ["SUBSCRIPTION_EXPIRED", 403],
    ["PLAYBACK_SESSION_EXPIRED", 401],
    ["SESSION_REVOKED", 401],
    ["CSRF_INVALID", 403],
    ["MATERIAL_INVALID", 400],
    ["internal_error", 500],
  ])("never refreshes or replays %s", async (code, status) => {
    const fetcher = vi.fn(async () => denied(code, status));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      adminLessonMaterialsApi.uploadResource(
        "l",
        { labelAr: "ع", labelEn: "File" },
        new File(["a"], "a.txt"),
      ),
    ).rejects.toMatchObject({ code, status });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not retry a failed network upload", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("network");
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(
      adminLessonMaterialsApi.uploadResource(
        "l",
        { labelAr: "ع", labelEn: "E" },
        new File(["x"], "x.txt"),
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    "stops after one refresh when refresh succeeds=%s",
    async (succeeds) => {
      const fetcher = vi.fn(async (url: string) =>
        url.endsWith("/auth/refresh") && succeeds ? json({}) : denied(),
      );
      vi.stubGlobal("fetch", fetcher);
      await expect(
        lessonMaterialsApi.getLessonMaterials("lesson"),
      ).rejects.toMatchObject({ code: "TOKEN_MISSING" });
      expect(fetcher).toHaveBeenCalledTimes(succeeds ? 4 : 3);
    },
  );

  it("refreshes authentication before resource removal retry", async () => {
    let refreshed = false;
    const methods: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith("/auth/refresh")) {
          refreshed = true;
          return json({});
        }
        if (url.endsWith("/auth/me")) return refreshed ? json({}) : denied();
        methods.push(init.method!);
        return refreshed ? json({ removed: true }) : denied();
      }),
    );
    expect(await adminLessonMaterialsApi.deleteResource("r")).toEqual({
      removed: true,
    });
    expect(methods).toEqual(["DELETE", "DELETE"]);
  });

  it("keeps the default mutation no-retry policy for other API callers", async () => {
    const fetcher = vi.fn(async () => denied());
    vi.stubGlobal("fetch", fetcher);
    await expect(
      apiFetch("/auth/logout", { method: "POST" }),
    ).rejects.toMatchObject({ code: "TOKEN_MISSING" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bootstraps missing CSRF before a multipart mutation", async () => {
    cookie.cookie = "";
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/csrf")) {
        cookie.cookie = "edu_csrf=bootstrap";
        return json({});
      }
      expect(new Headers(init.headers).get("x-csrf-token")).toBe("bootstrap");
      return json({});
    });
    vi.stubGlobal("fetch", fetcher);
    await apiResponse("/admin/learning/lessons/l/resources", {
      method: "POST",
      body: new FormData(),
      retryOnAuth: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
