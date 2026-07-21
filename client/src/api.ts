import type {
  Board,
  BoardSnapshot,
  Card,
  Connection,
  CreateBoardInput,
  CreateCardInput,
  CreateConnectionInput,
  ImageMeta,
  Invite,
  Me,
  UpdateCardInput,
  UpdateConnectionInput,
} from "@board/shared";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function req<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
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

  uploadImage: async (boardId: string, file: File): Promise<ImageMeta> => {
    const form = new FormData();
    form.append("file", file);
    return req<ImageMeta>(`/boards/${boardId}/images`, {
      method: "POST",
      body: form,
    });
  },
  imageUrl: (imageId: string) => `/api/images/${imageId}`,
};

export { ApiError };
