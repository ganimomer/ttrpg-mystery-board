import { useEffect, useState } from "react";
import styled from "styled-components";
import type { Board, Me } from "@board/shared";
import { api } from "../api";
import { StyledButton } from "../ui/Button";
import { StyledInput } from "../ui/Field";
import { StyledBoardName, StyledSpacer, StyledTopBar } from "../ui/TopBar";

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
    <StyledBoardList>
      <StyledTopBar>
        <StyledBoardName>Your Boards</StyledBoardName>
        <StyledSpacer />
        <StyledWhoami>{me.user.username}</StyledWhoami>
        <StyledButton $variant="ghost" onClick={onLogout}>
          Sign out
        </StyledButton>
      </StyledTopBar>

      <StyledBoardListBody>
        <StyledCreateBoard onSubmit={create}>
          <StyledInput
            placeholder="Name a new board"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
          <StyledButton disabled={creating}>Create board</StyledButton>
        </StyledCreateBoard>

        {error && <StyledErrorText>{error}</StyledErrorText>}
        {boards === null && <StyledMuted>Loading...</StyledMuted>}
        {boards && boards.length === 0 && (
          <StyledMuted>No boards yet — create one above to start pinning.</StyledMuted>
        )}

        <StyledBoardCards>
          {boards?.map((b) => (
            <li key={b.id}>
              <StyledBoardTile onClick={() => onOpen(b.id)}>
                <StyledBoardTileName>{b.name}</StyledBoardTileName>
                <StyledBoardTileRole>
                  {b.role === "gm" ? "Game Master" : "Player"}
                </StyledBoardTileRole>
              </StyledBoardTile>
            </li>
          ))}
        </StyledBoardCards>
      </StyledBoardListBody>
    </StyledBoardList>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

const StyledBoardList = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #241c12;
`;

const StyledWhoami = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
`;

const StyledBoardListBody = styled.div`
  padding: 24px;
  overflow: auto;
  color: #f0e6d5;
`;

const StyledCreateBoard = styled.form`
  display: flex;
  gap: 10px;
  max-width: 640px;
  margin-bottom: 22px;
`;

const StyledBoardCards = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  max-width: 900px;
`;

/* Pinned up at a slight angle, so a wall of them reads as paper rather than as
   a grid.

   The old sheet also carried `.board-tile:nth-child(even) { rotate(1.2deg) }`
   to alternate the lean, but a tile is the only child of its own <li>, so that
   rule never matched anything and every tile has always leaned the same way.
   Dropped rather than quietly fixed — reviving it is a visual change, and this
   was a mechanical port. `li:nth-child(even) &` is what it wanted to say. */
const StyledBoardTile = styled.button`
  width: 100%;
  text-align: left;
  background: var(--panel);
  color: var(--ink);
  border: none;
  border-radius: 10px;
  padding: 18px;
  cursor: pointer;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s ease;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transform: rotate(-1deg);

  &:hover {
    transform: rotate(0) translateY(-2px);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledBoardTileName = styled.span`
  font-family: var(--hand);
  font-size: 24px;
  font-weight: 700;
`;

const StyledBoardTileRole = styled.span`
  font-size: 12px;
  color: #7a6a52;
`;

const StyledMuted = styled.p`
  color: #b9ab92;
`;

const StyledErrorText = styled.p`
  color: #ffb3a7;
`;
