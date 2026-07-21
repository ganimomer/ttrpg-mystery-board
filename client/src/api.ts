import type {
  Board,
  BoardSnapshot,
  Card,
  Connection,
  CreateBoardInput,
  CreateCardInput,
  CreateConnectionInput,
  CreateTidbitInput,
  ImageMeta,
  Invite,
  Me,
  UpdateCardInput,
  UpdateConnectionInput,
  UpdateTidbitInput,
} from "@board/shared";
import { getToken } from "./auth/token";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Append the session token as a query param (for URLs that can't set headers). */
function withToken(url: string): string {
  const token = getToken();
  if (!token) return url;
  return url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
}

async function req<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  me: () => req<Me>("/auth/me"),
  logout: () => req<{ ok: true }>("/auth/logout", { method: "POST" }),
  loginUrl: () => "/api/auth/discord",

  listBoards: () => req<Board[]>("/boards"),
  createBoard: (input: CreateBoardInput) =>
    req<Board>("/boards", { method: "POST", json: input }),
  getBoard: (boardId: string) =>
    req<BoardSnapshot>(`/boards/${boardId}`),
  renameBoard: (boardId: string, name: string) =>
    req<{ ok: true }>(`/boards/${boardId}`, { method: "PATCH", json: { name } }),
  createInvite: (boardId: string) =>
    req<Invite>(`/boards/${boardId}/invites`, { method: "POST" }),
  redeemInvite: (token: string) =>
    req<{ boardId: string }>(`/invites/${token}/redeem`, { method: "POST" }),

  createCard: (boardId: string, input: CreateCardInput) =>
    req<Card>(`/boards/${boardId}/cards`, { method: "POST", json: input }),
  updateCard: (boardId: string, cardId: string, input: UpdateCardInput) =>
    req<Card>(`/boards/${boardId}/cards/${cardId}`, {
      method: "PATCH",
      json: input,
    }),
  deleteCard: (boardId: string, cardId: string) =>
    req<{ ok: true }>(`/boards/${boardId}/cards/${cardId}`, {
      method: "DELETE",
    }),

  createConnection: (boardId: string, input: CreateConnectionInput) =>
    req<Connection>(`/boards/${boardId}/connections`, {
      method: "POST",
      json: input,
    }),
  updateConnection: (
    boardId: string,
    connectionId: string,
    input: UpdateConnectionInput,
  ) =>
    req<Connection>(`/boards/${boardId}/connections/${connectionId}`, {
      method: "PATCH",
      json: input,
    }),
  deleteConnection: (boardId: string, connectionId: string) =>
    req<{ ok: true }>(`/boards/${boardId}/connections/${connectionId}`, {
      method: "DELETE",
    }),

  // Notepad tidbits. Each call returns the parent card with its updated notepad.
  addTidbit: (boardId: string, cardId: string, input: CreateTidbitInput) =>
    req<Card>(`/boards/${boardId}/cards/${cardId}/tidbits`, {
      method: "POST",
      json: input,
    }),
  updateTidbit: (
    boardId: string,
    cardId: string,
    tidbitId: string,
    input: UpdateTidbitInput,
  ) =>
    req<Card>(`/boards/${boardId}/cards/${cardId}/tidbits/${tidbitId}`, {
      method: "PATCH",
      json: input,
    }),
  deleteTidbit: (boardId: string, cardId: string, tidbitId: string) =>
    req<Card>(`/boards/${boardId}/cards/${cardId}/tidbits/${tidbitId}`, {
      method: "DELETE",
    }),

  uploadImage: async (boardId: string, file: File): Promise<ImageMeta> => {
    const form = new FormData();
    form.append("file", file);
    return req<ImageMeta>(`/boards/${boardId}/images`, {
      method: "POST",
      body: form,
    });
  },
  // These are used as an <img> src and an EventSource URL, which can't set an
  // Authorization header, so the token (when present) rides as a query param.
  imageUrl: (imageId: string) => withToken(`/api/images/${imageId}`),
  eventsUrl: (boardId: string) => withToken(`/api/boards/${boardId}/events`),
};

export { ApiError };
