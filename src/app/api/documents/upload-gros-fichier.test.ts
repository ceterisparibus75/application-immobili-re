/**
 * Tests d'upload d'un fichier de 12 Mo dans la GED via le protocole TUS.
 *
 * Flux testé :
 *   1. POST /api/storage/tus-create  → initialise la session TUS (Upload-Length = 12 Mo)
 *   2. POST /api/storage/tus-patch   × 4 → envoie 4 chunks (3 × 3,5 Mo + 1 × ~1,5 Mo)
 *   3. POST /api/documents/register  → enregistre le document en base
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { prismaMock } from "@/test/mocks/prisma"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { createAuditLog } from "@/lib/audit"

// ── Mocks hoistés ─────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({ cookies: vi.fn() }))
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))

// ── Imports des routes (après les mocks) ─────────────────────────────────────

import { POST as tusCreate } from "@/app/api/storage/tus-create/route"
import { POST as tusPatch } from "@/app/api/storage/tus-patch/route"
import { POST as registerDocument } from "@/app/api/documents/register/route"

// ── Constantes ────────────────────────────────────────────────────────────────

const FILE_12MB = 12 * 1024 * 1024          // 12 582 912 octets
const CHUNK_SIZE = 3_670_016                 // 3,5 Mo — taille utilisée par le form
const EXPECTED_CHUNKS = Math.ceil(FILE_12MB / CHUNK_SIZE) // 4 chunks

const SOCIETY_ID = "society-1"
const TUS_URL = "https://test.supabase.co/storage/v1/upload/resumable/abc123"
const STORAGE_PATH = `documents/${SOCIETY_ID}/general/1700000000000_test-12mb.pdf`
const SIGNED_URL = "https://test.supabase.co/storage/v1/object/sign/documents/test.pdf?token=xyz"
const DOC_ID = "doc-12mb-1"

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockActiveCookies(societyId = SOCIETY_ID) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === "active-society-id" ? { name, value: societyId } : undefined,
  } as ReturnType<typeof cookies> extends Promise<infer T> ? T : never)
}

function mockSupabaseClient() {
  vi.mocked(createClient).mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: SIGNED_URL },
          error: null,
        }),
      }),
    },
  } as unknown as ReturnType<typeof createClient>)
}

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function chunkRequest(offset: number, size: number): NextRequest {
  return new NextRequest("http://localhost/api/storage/tus-patch", {
    method: "POST",
    body: new Uint8Array(size),
    headers: {
      "Content-Type": "application/octet-stream",
      "x-tus-url": TUS_URL,
      "x-upload-offset": String(offset),
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)("Upload fichier 12 Mo dans la GED", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
    process.env.SUPABASE_STORAGE_BUCKET = "documents"
    process.env.AUTH_URL = "http://localhost:3000"
    process.env.CRON_SECRET = "test-cron"
  })

  // ── 1. tus-create ────────────────────────────────────────────────────────────

  describe("Étape 1 — Initialisation de la session TUS (tus-create)", () => {
    it("retourne 401 si non authentifié", async () => {
      mockUnauthenticated()
      const res = await tusCreate(
        jsonRequest("http://localhost/api/storage/tus-create", {
          filename: "test-12mb.pdf",
          mimeType: "application/pdf",
          fileSize: FILE_12MB,
          entityFolder: "general",
        })
      )
      expect(res.status).toBe(401)
    })

    it("retourne 401 si aucun cookie société actif", async () => {
      mockAuthSession()
      vi.mocked(cookies).mockResolvedValue({
        get: () => undefined,
      } as ReturnType<typeof cookies> extends Promise<infer T> ? T : never)

      const res = await tusCreate(
        jsonRequest("http://localhost/api/storage/tus-create", {
          filename: "test-12mb.pdf",
          mimeType: "application/pdf",
          fileSize: FILE_12MB,
          entityFolder: "general",
        })
      )
      expect(res.status).toBe(401)
    })

    it("retourne 503 si Supabase n'est pas configuré", async () => {
      mockAuthSession()
      mockActiveCookies()
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      const res = await tusCreate(
        jsonRequest("http://localhost/api/storage/tus-create", {
          filename: "test-12mb.pdf",
          mimeType: "application/pdf",
          fileSize: FILE_12MB,
          entityFolder: "general",
        })
      )
      expect(res.status).toBe(503)
    })

    it("envoie Upload-Length = 12 Mo à Supabase TUS et retourne tusUrl + storagePath", async () => {
      mockAuthSession()
      mockActiveCookies()

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { Location: "/storage/v1/upload/resumable/abc123" },
        })
      )

      const res = await tusCreate(
        jsonRequest("http://localhost/api/storage/tus-create", {
          filename: "test-12mb.pdf",
          mimeType: "application/pdf",
          fileSize: FILE_12MB,
          entityFolder: "general",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json() as { tusUrl: string; storagePath: string; bucket: string }
      expect(body.tusUrl).toContain("supabase")
      expect(body.storagePath).toContain("test-12mb.pdf")
      expect(body.storagePath).toContain(SOCIETY_ID)

      // Vérifie que Upload-Length = 12 582 912 a bien été envoyé à Supabase
      const [, options] = fetchSpy.mock.calls[0]
      const headers = options?.headers as Record<string, string>
      expect(headers["Upload-Length"]).toBe(String(FILE_12MB))

      fetchSpy.mockRestore()
    })
  })

  // ── 2. tus-patch ─────────────────────────────────────────────────────────────

  describe("Étape 2 — Envoi des chunks (tus-patch)", () => {
    it(`12 Mo nécessite exactement ${EXPECTED_CHUNKS} chunks de ${CHUNK_SIZE} octets max`, () => {
      const chunks: { offset: number; size: number }[] = []
      let offset = 0
      while (offset < FILE_12MB) {
        const size = Math.min(CHUNK_SIZE, FILE_12MB - offset)
        chunks.push({ offset, size })
        offset += size
      }
      expect(chunks).toHaveLength(4)
      expect(chunks[0]).toEqual({ offset: 0,            size: 3_670_016 })
      expect(chunks[1]).toEqual({ offset: 3_670_016,    size: 3_670_016 })
      expect(chunks[2]).toEqual({ offset: 7_340_032,    size: 3_670_016 })
      expect(chunks[3]).toEqual({ offset: 11_010_048,   size: 1_572_864 })
      const total = chunks.reduce((s, c) => s + c.size, 0)
      expect(total).toBe(FILE_12MB)
    })

    it("retourne 401 si non authentifié", async () => {
      mockUnauthenticated()
      const res = await tusPatch(chunkRequest(0, CHUNK_SIZE))
      expect(res.status).toBe(401)
    })

    it("retourne 400 si x-tus-url absent", async () => {
      mockAuthSession()
      const req = new NextRequest("http://localhost/api/storage/tus-patch", {
        method: "POST",
        body: new Uint8Array(CHUNK_SIZE),
        headers: {
          "Content-Type": "application/octet-stream",
          "x-upload-offset": "0",
          // x-tus-url intentionnellement absent
        },
      })
      const res = await tusPatch(req)
      expect(res.status).toBe(400)
    })

    it("upload chunk 1/4 (offset 0, 3,5 Mo) → retourne le nouvel offset", async () => {
      mockAuthSession()
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "Upload-Offset": String(CHUNK_SIZE) },
        })
      )

      const res = await tusPatch(chunkRequest(0, CHUNK_SIZE))
      expect(res.status).toBe(200)
      const body = await res.json() as { offset: string }
      expect(body.offset).toBe(String(CHUNK_SIZE))

      // Vérifie les headers envoyés au serveur TUS
      const [url, options] = fetchSpy.mock.calls[0]
      expect(url).toBe(TUS_URL)
      const headers = options?.headers as Record<string, string>
      expect(headers["Upload-Offset"]).toBe("0")
      expect(headers["Content-Length"]).toBe(String(CHUNK_SIZE))

      fetchSpy.mockRestore()
    })

    it("upload chunk 4/4 (offset 11 010 048, dernier morceau) → retourne l'offset final", async () => {
      mockAuthSession()
      const lastChunkSize = FILE_12MB - 3 * CHUNK_SIZE // 1 572 864
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "Upload-Offset": String(FILE_12MB) },
        })
      )

      const res = await tusPatch(chunkRequest(3 * CHUNK_SIZE, lastChunkSize))
      expect(res.status).toBe(200)
      const body = await res.json() as { offset: string }
      expect(body.offset).toBe(String(FILE_12MB))

      const [, options] = fetchSpy.mock.calls[0]
      const headers = options?.headers as Record<string, string>
      expect(headers["Upload-Offset"]).toBe(String(3 * CHUNK_SIZE))
      expect(headers["Content-Length"]).toBe(String(lastChunkSize))

      fetchSpy.mockRestore()
    })

    it("simule les 4 appels tus-patch consécutifs et vérifie les offsets cumulés", async () => {
      mockAuthSession()

      let currentOffset = 0
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
        const nextOffset = Math.min(currentOffset + CHUNK_SIZE, FILE_12MB)
        const response = new Response(null, {
          status: 204,
          headers: { "Upload-Offset": String(nextOffset) },
        })
        currentOffset = nextOffset
        return Promise.resolve(response)
      })

      const offsets: number[] = []
      let offset = 0
      while (offset < FILE_12MB) {
        const size = Math.min(CHUNK_SIZE, FILE_12MB - offset)
        const res = await tusPatch(chunkRequest(offset, size))
        expect(res.status).toBe(200)
        const body = await res.json() as { offset: string }
        offsets.push(parseInt(body.offset))
        offset += size
      }

      expect(offsets).toHaveLength(4)
      expect(offsets[0]).toBe(3_670_016)
      expect(offsets[1]).toBe(7_340_032)
      expect(offsets[2]).toBe(11_010_048)
      expect(offsets[3]).toBe(FILE_12MB)  // 12 582 912
      expect(fetchSpy).toHaveBeenCalledTimes(4)

      fetchSpy.mockRestore()
    })

    it("retourne 500 si le serveur TUS rejette un chunk", async () => {
      mockAuthSession()
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Checksum mismatch", { status: 460 })
      )

      const res = await tusPatch(chunkRequest(0, CHUNK_SIZE))
      expect(res.status).toBe(500)
      const body = await res.json() as { error: string }
      expect(body.error).toContain("460")
    })
  })

  // ── 3. register ──────────────────────────────────────────────────────────────

  describe("Étape 3 — Enregistrement en base (register)", () => {
    it("retourne 401 si non authentifié", async () => {
      mockUnauthenticated()
      const res = await registerDocument(
        jsonRequest("http://localhost/api/documents/register", {
          fileName: "test-12mb.pdf",
          fileSize: FILE_12MB,
          mimeType: "application/pdf",
          storagePath: STORAGE_PATH,
        })
      )
      expect(res.status).toBe(401)
    })

    it("retourne 400 si fileName ou storagePath absent", async () => {
      mockAuthSession()
      mockActiveCookies()
      mockSupabaseClient()

      const res = await registerDocument(
        jsonRequest("http://localhost/api/documents/register", {
          fileSize: FILE_12MB,
          mimeType: "application/pdf",
          // fileName et storagePath manquants
        })
      )
      expect(res.status).toBe(400)
    })

    it("enregistre le document avec fileSize = 12 Mo et aiStatus = pending (PDF)", async () => {
      mockAuthSession()
      mockActiveCookies()
      mockSupabaseClient()

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("{}", { status: 200 })
      )

      prismaMock.document.create.mockResolvedValue({
        id: DOC_ID,
        societyId: SOCIETY_ID,
        fileName: "test-12mb.pdf",
        fileUrl: SIGNED_URL,
        fileSize: FILE_12MB,
        mimeType: "application/pdf",
        category: "bail",
        description: null,
        expiresAt: null,
        storagePath: STORAGE_PATH,
        aiStatus: "pending",
        aiSummary: null,
        aiTags: [],
        aiMetadata: null,
        aiAnalyzedAt: null,
        buildingId: null,
        lotId: null,
        leaseId: null,
        tenantId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      prismaMock.auditLog.create.mockResolvedValue({} as never)

      const res = await registerDocument(
        jsonRequest("http://localhost/api/documents/register", {
          fileName: "test-12mb.pdf",
          fileSize: FILE_12MB,
          mimeType: "application/pdf",
          storagePath: STORAGE_PATH,
          category: "bail",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json() as { success: boolean; document: { id: string; fileUrl: string } }
      expect(body.success).toBe(true)
      expect(body.document.id).toBe(DOC_ID)
      expect(body.document.fileUrl).toBe(SIGNED_URL)

      // Vérifie que le document est créé avec le bon fileSize
      expect(prismaMock.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fileName: "test-12mb.pdf",
            fileSize: FILE_12MB,
            mimeType: "application/pdf",
            category: "bail",
            aiStatus: "pending",   // déclenché pour les PDF
            societyId: SOCIETY_ID,
            storagePath: STORAGE_PATH,
          }),
        })
      )

      // Vérifie que l'analyse IA est déclenchée en arrière-plan
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/api/documents/${DOC_ID}/analyze`),
        expect.any(Object)
      )

      // Vérifie l'audit log
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CREATE",
          entity: "Document",
          entityId: DOC_ID,
          societyId: SOCIETY_ID,
        })
      )

      fetchSpy.mockRestore()
    })

    it("génère une URL signée via Supabase Storage pour la consultation long-terme", async () => {
      mockAuthSession()
      mockActiveCookies()
      mockSupabaseClient()
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 200 }))

      prismaMock.document.create.mockResolvedValue({
        id: DOC_ID,
        fileUrl: SIGNED_URL,
      } as never)
      prismaMock.auditLog.create.mockResolvedValue({} as never)

      await registerDocument(
        jsonRequest("http://localhost/api/documents/register", {
          fileName: "test-12mb.pdf",
          fileSize: FILE_12MB,
          mimeType: "application/pdf",
          storagePath: STORAGE_PATH,
        })
      )

      // createSignedUrl appelé avec une validité d'un an (365 jours)
      const supabaseInstance = vi.mocked(createClient).mock.results[0].value as {
        storage: { from: ReturnType<typeof vi.fn> }
      }
       
      const storageFrom = (supabaseInstance.storage.from as (...args: unknown[]) => unknown)("documents") as {
        createSignedUrl: ReturnType<typeof vi.fn>
      }
      expect(storageFrom.createSignedUrl).toHaveBeenCalledWith(
        STORAGE_PATH,
        365 * 24 * 3600
      )
    })
  })

  // ── 4. Flux complet ──────────────────────────────────────────────────────────

  describe("Flux complet — TUS create → 4 patches → register", () => {
    it("complète l'upload d'un PDF de 12 Mo en 4 chunks et retourne un document enregistré", async () => {
      mockAuthSession()
      mockActiveCookies()
      mockSupabaseClient()

      // ─ Étape 1 : tus-create ─
      const fetchSpy = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          // tus-create → Supabase crée la session
          new Response(null, {
            status: 201,
            headers: { Location: "/storage/v1/upload/resumable/flow-test-123" },
          })
        )
        .mockImplementation((url) => {
          const u = String(url)
          if (u.includes("resumable/flow-test-123")) {
            // tus-patch calls
            return Promise.resolve(new Response(null, { status: 204, headers: { "Upload-Offset": "0" } }))
          }
          // AI analyze call (fire-and-forget)
          return Promise.resolve(new Response("{}", { status: 200 }))
        })

      const createRes = await tusCreate(
        jsonRequest("http://localhost/api/storage/tus-create", {
          filename: "contrat-bail-12mb.pdf",
          mimeType: "application/pdf",
          fileSize: FILE_12MB,
          entityFolder: "general",
        })
      )
      expect(createRes.status).toBe(200)
      const { tusUrl, storagePath } = await createRes.json() as { tusUrl: string; storagePath: string }
      expect(tusUrl).toBeTruthy()
      expect(storagePath).toContain("contrat-bail-12mb.pdf")

      // ─ Étape 2 : 4 chunks tus-patch ─
      let offset = 0
      let chunkCount = 0
      while (offset < FILE_12MB) {
        const size = Math.min(CHUNK_SIZE, FILE_12MB - offset)

        // Reconfigurer fetch pour retourner le bon offset
        fetchSpy.mockResolvedValueOnce(
          new Response(null, {
            status: 204,
            headers: { "Upload-Offset": String(offset + size) },
          })
        )

        const patchRes = await tusPatch(chunkRequest(offset, size))
        expect(patchRes.status).toBe(200)
        offset += size
        chunkCount++
      }
      expect(chunkCount).toBe(4)
      expect(offset).toBe(FILE_12MB)

      // ─ Étape 3 : register ─
      prismaMock.document.create.mockResolvedValue({
        id: "doc-flow-1",
        fileUrl: SIGNED_URL,
      } as never)
      prismaMock.auditLog.create.mockResolvedValue({} as never)

      const registerRes = await registerDocument(
        jsonRequest("http://localhost/api/documents/register", {
          fileName: "contrat-bail-12mb.pdf",
          fileSize: FILE_12MB,
          mimeType: "application/pdf",
          storagePath,
          category: "bail",
        })
      )
      expect(registerRes.status).toBe(200)
      const regBody = await registerRes.json() as { success: boolean; document: { id: string } }
      expect(regBody.success).toBe(true)
      expect(regBody.document.id).toBe("doc-flow-1")

      fetchSpy.mockRestore()
    })
  })
})
