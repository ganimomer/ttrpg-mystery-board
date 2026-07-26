import { useEffect, useState } from "react";
import type { Board, Me } from "@board/shared";
import { api } from "../api";

interface Props {
  me: Me;
  onOpen: (boardId: string) => void;
  onLogout: () => void;
}

export function BoardList({ me, onOpen, onLogout }: Props) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  async function load() {
    try {
      setBoards(await api.listBoards());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load boards");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const board = await api.createBoard({ name: name.trim() });
      setName("");
      onOpen(board.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not create board");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="board-list">
      <header className="topbar">
        <h1 className="board-name">Your Boards</h1>
        <div className="spacer" />
        <span className="whoami">{me.user.username}</span>
        <button className="btn btn--ghost" onClick={onLogout}>Sign out</button>
      </header>

      <div className="board-list-body">
        <form className="create-board" onSubmit={create}>
          <input
            placeholder="Name a new board"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn" disabled={creating}>Create board</button>
        </form>

        {error && <p className="error-text">{error}</p>}
        {boards === null && <p className="muted">Loading...</p>}
        {boards && boards.length === 0 && (
          <p className="muted">
            No boards yet — create one above to start pinning.
          </p>
        )}

        <ul className="board-cards">
          {boards?.map((b) => (
            <li key={b.id}>
              <button className="board-tile" onClick={() => onOpen(b.id)}>
                <span className="board-tile-name">{b.name}</span>
                <span className="board-tile-role">
                  {b.role === "gm" ? "Game Master" : "Player"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
