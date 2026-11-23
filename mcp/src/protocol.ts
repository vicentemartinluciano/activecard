import { Buffer } from "node:buffer";
import type { Readable, Writable } from "node:stream";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type FrameMode = "ndjson" | "content-length";

export const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;
const JSONRPC_INTERNAL_ERROR = -32603;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorResult(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

export function formatMcpTextResult(payload: unknown, isError = false) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  };
}

export function createMcpServer(options: {
  tools: McpToolDefinition[];
  serverInfo?: { name: string; version: string };
  protocolVersion?: string;
  onError?: (error: unknown) => void;
}) {
  const toolMap = new Map<string, McpToolDefinition>();
  for (const tool of options.tools) {
    toolMap.set(tool.name, tool);
  }
  const serverInfo = options.serverInfo || { name: "activecard-mcp", version: "1.0.0" };
  const defaultProtocolVersion = options.protocolVersion || DEFAULT_PROTOCOL_VERSION;

  async function handleSingle(message: unknown): Promise<JsonRpcResponse | null> {
    if (!isPlainObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      const id =
        isPlainObject(message) && (typeof message.id === "string" || typeof message.id === "number")
          ? message.id
          : null;
      return errorResult(id, JSONRPC_INVALID_REQUEST, "Invalid Request");
    }

    const hasId = Object.prototype.hasOwnProperty.call(message, "id") && message.id !== undefined;
    const id = hasId ? (message.id as string | number | null) : null;
    const method = message.method;
    const params = message.params;

    // Notificaciones JSON-RPC no llevan respuesta.
    if (!hasId) {
      return null;
    }

    if (id !== null && typeof id !== "string" && typeof id !== "number") {
      return errorResult(null, JSONRPC_INVALID_REQUEST, "Invalid Request id");
    }

    if (method === "initialize") {
      const clientVersion =
        isPlainObject(params) && typeof params.protocolVersion === "string" && params.protocolVersion.trim()
          ? params.protocolVersion
          : defaultProtocolVersion;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: clientVersion,
          capabilities: {
            tools: {},
          },
          serverInfo,
        },
      };
    }

    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: Array.from(toolMap.values()).map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        },
      };
    }

    if (method === "tools/call") {
      if (!isPlainObject(params) || typeof params.name !== "string" || !params.name.trim()) {
        return errorResult(id, JSONRPC_INVALID_PARAMS, "Missing tool name");
      }
      const tool = toolMap.get(params.name);
      if (!tool) {
        return errorResult(id, JSONRPC_INVALID_PARAMS, `Unknown tool: ${params.name}`);
      }
      const rawArgs = params.arguments === undefined ? {} : params.arguments;
      if (!isPlainObject(rawArgs)) {
        return errorResult(id, JSONRPC_INVALID_PARAMS, "Tool arguments must be an object");
      }
      try {
        const result = await tool.handler(rawArgs);
        return {
          jsonrpc: "2.0",
          id,
          result: formatMcpTextResult(result, false),
        };
      } catch (error) {
        options.onError?.(error);
        const messageText = error instanceof Error ? error.message : "Error inesperado ejecutando la herramienta.";
        const errorCode =
          error &&
          typeof error === "object" &&
          "code" in error &&
          typeof (error as { code?: unknown }).code === "string"
            ? (error as { code: string }).code
            : undefined;
        return {
          jsonrpc: "2.0",
          id,
          result: formatMcpTextResult(
            {
              ok: false,
              error: messageText,
              ...(errorCode ? { code: errorCode } : {}),
            },
            true
          ),
        };
      }
    }

    return errorResult(id, JSONRPC_METHOD_NOT_FOUND, `Method not found: ${method}`);
  }

  async function handleRawText(rawJson: string): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return errorResult(null, JSONRPC_PARSE_ERROR, "Parse error");
    }

    if (Array.isArray(parsed)) {
      if (!parsed.length) return errorResult(null, JSONRPC_INVALID_REQUEST, "Empty JSON-RPC batch");
      const responses: JsonRpcResponse[] = [];
      for (const item of parsed) {
        try {
          const res = await handleSingle(item);
          if (res) responses.push(res);
        } catch (error) {
          options.onError?.(error);
          responses.push(errorResult(null, JSONRPC_INTERNAL_ERROR, "Internal error"));
        }
      }
      return responses.length ? responses : null;
    }

    try {
      return await handleSingle(parsed);
    } catch (error) {
      options.onError?.(error);
      const id =
        isPlainObject(parsed) && (typeof parsed.id === "string" || typeof parsed.id === "number") ? parsed.id : null;
      return errorResult(id, JSONRPC_INTERNAL_ERROR, "Internal error");
    }
  }

  function encodeResponse(payload: JsonRpcResponse | JsonRpcResponse[], mode: FrameMode): string {
    const serialized = JSON.stringify(payload);
    if (mode === "content-length") {
      const length = Buffer.byteLength(serialized, "utf8");
      return `Content-Length: ${length}\r\n\r\n${serialized}`;
    }
    return `${serialized}\n`;
  }

  function serveStdio(streams: { input: Readable; output: Writable }): () => void {
    const { input, output } = streams;
    let buffer = Buffer.alloc(0);
    let queue = Promise.resolve();
    let closed = false;

    const enqueue = (rawJson: string, mode: FrameMode) => {
      queue = queue.then(async () => {
        if (closed) return;
        const response = await handleRawText(rawJson);
        if (response && !closed) {
          output.write(encodeResponse(response, mode));
        }
      });
    };

    const drain = () => {
      while (buffer.length > 0) {
        const preview = buffer.slice(0, Math.min(buffer.length, 64)).toString("utf8");
        const headerCandidate = /^content-length:/i.test(preview.trimStart());
        if (headerCandidate) {
          const trimLeading = buffer.length - buffer.toString("utf8").trimStart().length;
          if (trimLeading > 0 && /^[\r\n\s]+$/.test(buffer.slice(0, trimLeading).toString("utf8"))) {
            buffer = buffer.slice(trimLeading);
          }
          const sepCrLf = buffer.indexOf("\r\n\r\n");
          const sepLf = buffer.indexOf("\n\n");
          const sepIndex = sepCrLf >= 0 && (sepLf < 0 || sepCrLf < sepLf) ? sepCrLf : sepLf;
          const sepLen = sepIndex === sepCrLf ? 4 : 2;
          if (sepIndex < 0) break;
          const headerText = buffer.slice(0, sepIndex).toString("utf8");
          const match = /^content-length:\s*(\d+)/im.exec(headerText);
          if (!match) {
            buffer = buffer.slice(sepIndex + sepLen);
            enqueue("{invalid", "content-length");
            continue;
          }
          const bodyLength = Number.parseInt(match[1], 10);
          const totalNeeded = sepIndex + sepLen + bodyLength;
          if (buffer.length < totalNeeded) break;
          const body = buffer.slice(sepIndex + sepLen, totalNeeded).toString("utf8");
          buffer = buffer.slice(totalNeeded);
          enqueue(body, "content-length");
          continue;
        }

        const nlIndex = buffer.indexOf(0x0a);
        if (nlIndex < 0) break;
        const line = buffer.slice(0, nlIndex).toString("utf8").trim();
        buffer = buffer.slice(nlIndex + 1);
        if (!line) continue;
        enqueue(line, "ndjson");
      }
    };

    const onData = (chunk: Buffer | string) => {
      const piece = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
      buffer = Buffer.concat([buffer, piece]);
      drain();
    };

    const onEnd = () => {
      const trailing = buffer.toString("utf8").trim();
      buffer = Buffer.alloc(0);
      if (trailing && !/^content-length:/i.test(trailing)) {
        enqueue(trailing, "ndjson");
      }
    };

    input.on("data", onData);
    input.on("end", onEnd);

    return () => {
      closed = true;
      input.off("data", onData);
      input.off("end", onEnd);
    };
  }

  return {
    handleMessage: handleSingle,
    handleRawText,
    serveStdio,
  };
}
