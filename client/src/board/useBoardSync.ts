import { useCallback, useEffect, useRef, useState } from "react";
import type { Board, BoardEvent, Card, Connection } from "@board/shared";
import { api } from "../api";

export interface BoardState {
  board: Board | null;
  cards: Record<string, Card>;
  connections: Record<string, Connection>;
  loading: boolean;
  error: string | null;
  /** Optimistically merge a card locally (e.g. while dragging). */
  patchCardLocal: (card: Card) => void;
  reload: () => void;
}

export function useBoardSync(boardId: string): BoardState {
  const [board, setBoard] = useState<Board | null>(null);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [connections, setConnections] = useState<Record<string, Connection>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reloadKey = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await api.getBoard(boardId);
      setBoard(snap.board);
      setCards(Object.fromEntries(snap.cards.map((c) => [c.id, c])));
      setConnections(Object.fromEntries(snap.connections.map((c) => [c.id, c])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey.current]);

  // Live updates via SSE.
  useEffect(() => {
    const es = new EventSource(`/api/boards/${boardId}/events`, {
      withCredentials: true,
    });
    const onBoard = (ev: MessageEvent) => {
      let event: BoardEvent;
      try {
        event = JSON.parse(ev.data) as BoardEvent;
      } catch {
        return;
      }
      switch (event.type) {
        case "card.upserted":
          setCards((prev) => ({ ...prev, [event.card.id]: event.card }));
          break;
        case "card.removed":
          setCards((prev) => {
            const next = { ...prev };
            delete next[event.cardId];
            return next;
          });
          // Drop any connections that referenced it.
          setConnections((prev) => {
            const next: Record<string, Connection> = {};
            for (const [id, conn] of Object.entries(prev)) {
              if (conn.fromCardId !== event.cardId && conn.toCardId !== event.cardId) {
                next[id] = conn;
              }
            }
            return next;
          });
          break;
        case "connection.upserted":
          setConnections((prev) => ({
            ...prev,
            [event.connection.id]: event.connection,
          }));
          break;
        case "connection.removed":
          setConnections((prev) => {
            const next = { ...prev };
            delete next[event.connectionId];
            return next;
          });
          break;
        case "board.renamed":
          setBoard((prev) => (prev ? { ...prev, name: event.name } : prev));
          break;
      }
    };
    es.addEventListener("board", onBoard as EventListener);
    return () => {
      es.removeEventListener("board", onBoard as EventListener);
      es.close();
    };
  }, [boardId]);

  const patchCardLocal = useCallback((card: Card) => {
    setCards((prev) => ({ ...prev, [card.id]: card }));
  }, []);

  const reload = useCallback(() => {
    reloadKey.current += 1;
    void load();
  }, [load]);

  return {
    board,
    cards,
    connections,
    loading,
    error,
    patchCardLocal,
    reload,
  };
}
