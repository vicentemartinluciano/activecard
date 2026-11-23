/** @jest-environment node */
import { Buffer } from "node:buffer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { emptyDocument, validateDocument } from "../../src/lib/syncDocument";
import { newCardState } from "../../src/lib/scheduler";
import { createMcpServer } from "../src/protocol";
import { loadStoredSession, resolveMcpSyncConfig, resolveSessionPath, saveStoredSession } from "../src/auth";
import { createActiveCardStore } from "../src/store";
import { createActiveCardTools } from "../src/tools";

function createMemoryRemote({ userId = "user-1", email = "martin@example.test", initialDoc = null } = {}) {
  let revision = initialDoc ? 1 : 0;
  let currentDoc = initialDoc ? structuredClone(initialDoc) : emptyDocument();
  let conflictOnce = false;

  return {
    getSession: () => ({ userId, email }),
    triggerConflictOnce() {
      conflictOnce = true;
    },
    async read() {
      return { revision, document: structuredClone(currentDoc) };
    },
    async commit(nextDoc, expectedRevision) {
      if (conflictOnce) {
        conflictOnce = false;
        revision += 1;
        return { ok: false, revision };
      }
      if (expectedRevision !== revision) {
        return { ok: false, revision };
      }
      currentDoc = structuredClone(validateDocument(nextDoc));
      revision += 1;
      return { ok: true, revision };
    },
    peek() {
      return { revision, document: structuredClone(currentDoc) };
    },
  };
}

describe("ActiveCard MCP Server", () => {
  test("auth valida claves, rechaza service_role y no guarda contraseñas ni accessToken", () => {
    expect(() =>
      resolveMcpSyncConfig({
        ACTIVECARD_SUPABASE_URL: "http://evil.example.com",
        ACTIVECARD_SUPABASE_KEY: "sb_publishable_ok",
      })
    ).toThrow(/HTTPS/i);

    const fakeServiceJwt = [
      Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"),
      Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url"),
      "sig",
    ].join(".");

    expect(() =>
      resolveMcpSyncConfig({
        ACTIVECARD_SUPABASE_URL: "https://example.supabase.co",
        ACTIVECARD_SUPABASE_KEY: fakeServiceJwt,
      })
    ).toThrow(/service_role/i);

    expect(() =>
      resolveMcpSyncConfig({
        ACTIVECARD_SUPABASE_URL: "https://example.supabase.co",
        ACTIVECARD_SUPABASE_KEY: "sb_secret_nope",
      })
    ).toThrow(/service_role/i);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "activecard-mcp-test-"));
    try {
      const sessionPath = resolveSessionPath({}, path.join(tmpDir, "session.json"));
      saveStoredSession(sessionPath, {
        url: "https://example.supabase.co",
        userId: "user-1",
        email: "martin@example.test",
        refreshToken: "REFRESH_ONLY",
        updatedAt: "2026-11-23T00:00:00.000Z",
      });
      const rawDisk = fs.readFileSync(sessionPath, "utf8");
      expect(rawDisk).not.toContain("password");
      expect(rawDisk).not.toContain("accessToken");
      expect(loadStoredSession(sessionPath)).toMatchObject({
        userId: "user-1",
        email: "martin@example.test",
        refreshToken: "REFRESH_ONLY",
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("protocolo JSON-RPC por stdio (ndjson y Content-Length) expone las 9 herramientas sin record_review", async () => {
    const remote = createMemoryRemote();
    const store = createActiveCardStore({ remote });
    const server = createMcpServer({ tools: createActiveCardTools(store) });

    const listRes = await server.handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const names = listRes.result.tools.map((t) => t.name);
    expect(names).toEqual([
      "activecard_account_status",
      "activecard_get_overview",
      "activecard_list_library",
      "activecard_search",
      "activecard_read_entity",
      "activecard_get_review_history",
      "activecard_apply_action",
      "activecard_batch_actions",
      "activecard_undo_action",
    ]);
    expect(names).not.toContain("activecard_record_review");

    // Prueba real sobre streams stdio con framing Content-Length y ndjson.
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks = [];
    output.on("data", (d) => chunks.push(d.toString("utf8")));
    const stop = server.serveStdio({ input, output });

    const payload = JSON.stringify({ jsonrpc: "2.0", id: 10, method: "ping" });
    input.write(`Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`);
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "activecard_account_status", arguments: {} } })}\n`);
    input.end();
    await new Promise((resolve) => setTimeout(resolve, 40));
    stop();

    const joined = chunks.join("");
    expect(joined).toContain("Content-Length:");
    expect(joined).toContain('"id":10');
    expect(joined).toContain("martin@example.test");
  });

  test("overview, búsqueda, lectura con herencia de notas y rechazo de record_review", async () => {
    const nowMs = Date.parse("2026-11-23T15:00:00.000Z");
    const doc = emptyDocument();
    doc.study_preferences.dailyLimits = { max_reviews: 20, max_new: 5 };
    doc.folders.fRoot = { name: "Facultad", created_at: "2026-11-01T10:00:00Z", parent_id: null };
    doc.folders.fChild = { name: "Álgebra", created_at: "2026-11-02T10:00:00Z", parent_id: "fRoot" };
    doc.decks.d1 = { name: "Matrices", created_at: "2026-11-03T10:00:00Z", priority: 100, icon: null, folder_id: "fChild" };
    doc.tags["tag:Parcial"] = { name: "Parcial" };
    doc.deck_tags.push(["d1", "tag:Parcial"]);
    const baseState = newCardState(new Date(nowMs - 86400000));
    doc.cards.c1 = {
      deck_id: "d1",
      front: "¿Qué es la traza $\\operatorname{tr}(A)$?",
      back: "La **suma** de la diagonal principal",
      source: "manual",
      origin_card_id: null,
      created_at: "2026-11-04T10:00:00Z",
      ...baseState,
      reps: 4,
      lapses: 3,
      starred: 1,
      position: 0,
      suspended: 0,
    };
    doc.review_logs.r1 = { card_id: "c1", rating: "good", mode: "daily", reviewed_at: "2026-11-22T12:00:00Z" };
    doc.review_logs.r2 = { card_id: "c1", rating: "hard", mode: "daily", reviewed_at: "2026-11-23T12:00:00Z" };
    doc.notes.n1 = {
      title: "Resumen Unidad 1",
      description: "Conceptos iniciales",
      body: "Propiedades de traza y determinante",
      excerpt: "Propiedades de traza y determinante",
      icon: "book",
      pinned: 1,
      created_at: "2026-11-05T10:00:00Z",
      updated_at: "2026-11-06T10:00:00Z",
    };
    doc.note_folders.push(["n1", "fRoot"]);

    const remote = createMemoryRemote({ initialDoc: doc });
    const store = createActiveCardStore({ remote, now: () => nowMs });
    const tools = Object.fromEntries(createActiveCardTools(store).map((t) => [t.name, t.handler]));

    const overview = await tools.activecard_get_overview({});
    expect(overview.today.done).toBe(1);
    expect(overview.streak.days).toBe(2);
    expect(overview.recall30d.score).toBe(75); // (1 + 0.5) / 2 = 75%
    expect(overview.weakCards).toHaveLength(1);

    const search = await tools.activecard_search({ query: "algebra" });
    expect(search.folders[0].id).toBe("fChild");

    const deckRead = await tools.activecard_read_entity({ entityType: "deck", id: "d1" });
    expect(deckRead.deck.notes.fromFolder).toHaveLength(1);
    expect(deckRead.deck.notes.fromFolder[0].id).toBe("n1");

    const history = await tools.activecard_get_review_history({ deckId: "d1" });
    expect(history.totalMatched).toBe(2);
    expect(history.recallScore).toBe(75);

    await expect(
      tools.activecard_apply_action({ action: { type: "record_review", cardId: "c1", rating: "good" } })
    ).rejects.toThrow(/repasos FSRS/i);
  });

  test("apply_action, batch ($ref + rollback), CAS retry, salvaguardas y undo firmado", async () => {
    const nowMs = Date.parse("2026-11-23T15:00:00.000Z");
    const remote = createMemoryRemote();
    const store = createActiveCardStore({ remote, undoKey: "secret-key", now: () => nowMs });
    const tools = Object.fromEntries(createActiveCardTools(store).map((t) => [t.name, t.handler]));

    // dryRun no modifica revisión
    const dry = await tools.activecard_batch_actions({
      dryRun: true,
      actions: [
        { type: "create_folder", refId: "f1", name: "Física" },
        { type: "create_deck", name: "Cinemática", folderId: "$ref:f1" },
      ],
    });
    expect(dry.dryRun).toBe(true);
    expect(dry.changed).toBe(true);
    expect(dry.undoToken).toBeNull();
    expect(remote.peek().revision).toBe(0);

    // Rollback atómico en batch si falla la segunda acción
    await expect(
      tools.activecard_batch_actions({
        actions: [
          { type: "create_folder", name: "Efímera" },
          { type: "delete_deck", deckId: "inexistente", confirmName: "X" },
        ],
      })
    ).rejects.toThrow();
    expect(remote.peek().document.folders).toEqual({});

    // Reintento CAS automático + lote real con JSON rico en compileGeneratedBack
    remote.triggerConflictOnce();
    const batchRes = await tools.activecard_batch_actions({
      actions: [
        { type: "create_folder", refId: "fMath", name: "Matemática" },
        { type: "create_deck", refId: "dCalc", name: "Cálculo", folderId: "$ref:fMath", priority: 80, tagNames: ["Final"] },
        {
          type: "create_card",
          refId: "cLim",
          deckId: "$ref:dCalc",
          front: "Definición de límite $\\lim_{x \\to a} f(x) = L$",
          back: [
            { type: "paragraph", text: "Para todo $\\varepsilon > 0$ existe $\\delta > 0$." },
            { type: "toggle", title: "Ejemplo", blocks: [{ type: "paragraph", text: "$x^2 \\to 4$" }] },
          ],
        },
        {
          type: "create_note",
          refId: "nCalc",
          title: "Guía de límites",
          body: "Usar entorno $\\delta$-$ \\varepsilon$.",
          deckIds: ["$ref:dCalc"],
          pinned: true,
        },
        { type: "update_daily_limits", maxReviews: 30, maxNew: 10 },
      ],
    });

    expect(batchRes.changed).toBe(true);
    expect(typeof batchRes.undoToken).toBe("string");
    const afterBatch = remote.peek().document;
    const deckId = batchRes.result.refs.dCalc;
    const cardId = batchRes.result.refs.cLim;
    expect(afterBatch.study_preferences.dailyLimits).toEqual({ max_reviews: 30, max_new: 10 });
    expect(afterBatch.cards[cardId].back).toContain("\uE031");

    // Deshacer con token alterado falla; con token válido revierte todo el lote
    await expect(tools.activecard_undo_action({ undoToken: `${batchRes.undoToken}tamper` })).rejects.toThrow(/firma/i);

    const undone = await tools.activecard_undo_action({ undoToken: batchRes.undoToken });
    expect(undone.undone).toBe(true);
    expect(remote.peek().document.decks).toEqual({});
    // No se puede reutilizar un token
    await expect(tools.activecard_undo_action({ undoToken: batchRes.undoToken })).rejects.toThrow();

    // Preservar FSRS al actualizar tarjeta + bloquear ciclos de carpeta + exigir confirmName
    const createdDeck = await tools.activecard_apply_action({
      action: { type: "create_deck", name: "Mazo FSRS" },
    });
    const dId = createdDeck.result.id;
    const cardCreated = await tools.activecard_apply_action({
      action: { type: "create_card", deckId: dId, front: "F", back: "B" },
    });
    const cId = cardCreated.result.id;
    const beforeDue = remote.peek().document.cards[cId].due;
    await tools.activecard_apply_action({
      action: { type: "update_card", cardId: cId, front: "F2", starred: true },
    });
    expect(remote.peek().document.cards[cId].due).toBe(beforeDue);
    expect(remote.peek().document.cards[cId].starred).toBe(1);

    await expect(
      tools.activecard_apply_action({ action: { type: "delete_deck", deckId: dId, confirmName: "Otro" } })
    ).rejects.toThrow(/coincidir exactamente/i);

    await tools.activecard_apply_action({
      action: { type: "delete_deck", deckId: dId, confirmName: "Mazo FSRS" },
    });
    expect(remote.peek().document.decks[dId]).toBeUndefined();
    expect(remote.peek().document.cards[cId]).toBeUndefined();
    expect(deckId).toBeTruthy();
  });
});
