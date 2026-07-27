import { useMemo, useRef, useState } from "react";
import type { Card, Connection } from "@board/shared";
import { api } from "../api";
import { Board, type BoardHandles } from "./Board";
import { CardFocus } from "./CardFocus";
import { ConnectionInspector } from "./Inspector";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  FRAME_DEFAULT,
  PLATE_OVERHANG,
  groupAt,
  membershipPoint,
} from "./layout";
import { useBoardSync } from "./useBoardSync";
import type { FocusFrom } from "./useFocusFlight";

interface Props {
  boardId: string;
  onExit: () => void;
}

/** Cards are read and written in the focus view, so only strings are selected. */
type Selection = { type: "connection"; id: string } | null;

/** The card held up close. `from` is where it flies out of — null for a card
 *  that isn't on screen yet, like one created a moment ago. */
type Focus = { cardId: string; from: FocusFrom | null };

export function BoardView({ boardId, onExit }: Props) {
  const state = useBoardSync(boardId);
  const [selection, setSelection] = useState<Selection>(null);
  const [previewAsPlayer, setPreviewAsPlayer] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const handles = useRef<BoardHandles | null>(null);

  const isGM = state.board?.role === "gm";
  const editable = isGM && !previewAsPlayer;

  // What actually gets rendered. Server already filters for players; when a GM
  // previews-as-player we additionally hide un-revealed items locally.
  const { cards, connections } = useMemo(() => {
    if (!previewAsPlayer) {
      return { cards: state.cards, connections: state.connections };
    }
    const cards: Record<string, Card> = {};
    for (const c of Object.values(state.cards)) {
      // Mirror the server's player shaping: hide the card and strip its
      // un-revealed notepad tidbits so the preview matches what players see.
      if (c.revealed) {
        cards[c.id] = { ...c, notepad: c.notepad.filter((t) => t.revealed) };
      }
    }
    // …and mirror stripHiddenGroups: a card in a group the player can't see
    // shows up loose, never hinting that the group exists.
    for (const c of Object.values(cards)) {
      if (c.groupId && !cards[c.groupId]) cards[c.id] = { ...c, groupId: null };
    }
    const connections: Record<string, Connection> = {};
    for (const c of Object.values(state.connections)) {
      if (c.revealed && cards[c.fromCardId] && cards[c.toCardId]) {
        connections[c.id] = c;
      }
    }
    return { cards, connections };
  }, [previewAsPlayer, state.cards, state.connections]);

  /** Which group a card at this position would belong to. */
  function groupOf(at: { x: number; y: number }, exclude?: string): string | null {
    const p = membershipPoint(at);
    return groupAt(p.x, p.y, Object.values(state.cards), exclude);
  }

  /** Adds a card at the viewport centre — a plain one, or a group with a frame. */
  async function addCard(frame?: { width: number; height: number }) {
    if (busy) return;
    setBusy(true);
    try {
      const center = handles.current?.viewportCenter() ?? { x: 0, y: 0 };
      const x = Math.round(center.x - CARD_WIDTH / 2);
      // A group hangs its frame below the nameplate, so drop the plate high
      // enough that the frame lands in view rather than off the bottom.
      const y = Math.round(
        frame ? center.y - PLATE_OVERHANG - frame.height / 2 : center.y - CARD_HEIGHT / 2,
      );
      const card = await api.createCard(boardId, {
        x,
        y,
        rotation: Math.round((Math.random() - 0.5) * 12),
        revealed: false,
        frame: frame ?? null,
        // Born inside a frame? Then it starts out as a member of that group.
        groupId: frame ? null : groupOf({ x, y }),
      });
      // Held up straight away, so the GM can name it.
      setSelection(null);
      setFocus({ cardId: card.id, from: null });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not add card");
    } finally {
      setBusy(false);
    }
  }

  function moveCard(id: string, x: number, y: number, commit: boolean) {
    const card = state.cards[id];
    if (!card) return;

    // A group travels as one object: its cards keep their places inside the
    // frame, and their membership is not up for reconsideration.
    if (card.frame) {
      const dx = x - card.x;
      const dy = y - card.y;
      const members = Object.values(state.cards).filter((c) => c.groupId === id);
      state.patchCardLocal({ ...card, x, y });
      for (const m of members) {
        state.patchCardLocal({ ...m, x: m.x + dx, y: m.y + dy });
      }
      if (commit) {
        void api.updateCard(boardId, id, { x, y }).catch(() => {});
        for (const m of members) {
          const moved = { x: m.x + dx, y: m.y + dy };
          void api.updateCard(boardId, m.id, moved).catch(() => {});
        }
      }
      return;
    }

    const groupId = groupOf({ x, y }, id);
    setDropTargetId(commit ? null : groupId);
    state.patchCardLocal({ ...card, x, y, groupId });
    if (commit) void api.updateCard(boardId, id, { x, y, groupId }).catch(() => {});
  }

  /** Hop the focus view to another card — it flies in from its place on the
   *  board, and the card being left commits its edits as it unmounts. */
  function navigateFocus(cardId: string) {
    setFocus({ cardId, from: handles.current?.takeoffFor(cardId) ?? null });
  }

  function resizeFrame(id: string, width: number, height: number, commit: boolean) {
    const card = state.cards[id];
    if (!card?.frame) return;
    state.patchCardLocal({ ...card, frame: { width, height } });
    if (commit) {
      void api.updateCard(boardId, id, { frame: { width, height } }).catch(() => {});
    }
  }

  /** Same deal as a drag: the card turns locally, the server hears once. */
  function tiltCard(id: string, rotation: number, commit: boolean) {
    const card = state.cards[id];
    if (!card) return;
    state.patchCardLocal({ ...card, rotation });
    if (commit) void api.updateCard(boardId, id, { rotation }).catch(() => {});
  }

  async function createConnection(fromCardId: string, toCardId: string) {
    try {
      const conn = await api.createConnection(boardId, {
        fromCardId,
        toCardId,
        revealed: false,
      });
      setSelection({ type: "connection", id: conn.id });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not tie string");
    }
  }

  async function deleteCard(id: string) {
    setFocus(null);
    await api.deleteCard(boardId, id).catch(() => {});
  }
  async function deleteConnection(id: string) {
    setSelection(null);
    await api.deleteConnection(boardId, id).catch(() => {});
  }

  async function makeInvite() {
    try {
      const invite = await api.createInvite(boardId);
      setInviteUrl(invite.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not create invite");
    }
  }

  if (state.loading) return <div className="center-msg">Unrolling the board…</div>;
  if (state.error) {
    return (
      <div className="center-msg">
        <p>{state.error}</p>
        <button className="btn" onClick={onExit}>Back</button>
      </div>
    );
  }

  const selectedConn =
    selection?.type === "connection" ? connections[selection.id] : undefined;
  // A card can vanish under an open focus view — deleted by another GM, or
  // un-revealed while previewing as a player.
  const focusedCard = focus ? cards[focus.cardId] : undefined;
  // What the focused card belongs to, and what belongs to it. Both come from the
  // already player-filtered map, so a player only ever sees permitted cards.
  const focusedGroup = focusedCard?.groupId
    ? (cards[focusedCard.groupId] ?? null)
    : null;
  const focusedMembers = focusedCard?.frame
    ? Object.values(cards)
        .filter((c) => c.groupId === focusedCard.id)
        // Reading order inside the frame, so the row matches the board.
        .sort((a, b) => a.y - b.y || a.x - b.x)
    : [];

  return (
    <div className="boardview">
      <header className="topbar">
        <button className="btn btn--ghost" onClick={onExit}>← Boards</button>
        <h1 className="board-name">{state.board?.name}</h1>
        <div className="spacer" />
        {isGM && (
          <>
            <button
              className="btn"
              onClick={() => void addCard()}
              disabled={busy || previewAsPlayer}
            >
              + Card
            </button>
            <button
              className="btn"
              onClick={() => void addCard(FRAME_DEFAULT)}
              disabled={busy || previewAsPlayer}
              title="A dotted frame with a card at its top; drag cards inside to group them"
            >
              + Group
            </button>
            <button className="btn" onClick={makeInvite}>Invite players</button>
            <label className="preview-switch">
              <input
                type="checkbox"
                checked={previewAsPlayer}
                onChange={(e) => {
                  setPreviewAsPlayer(e.target.checked);
                  setSelection(null);
                  setFocus(null);
                }}
              />
              Preview as player
            </label>
          </>
        )}
      </header>

      {inviteUrl && (
        <div className="invite-banner">
          <span>Share this link with a player (valid 14 days):</span>
          <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} />
          <button
            className="btn"
            onClick={() => void navigator.clipboard?.writeText(inviteUrl)}
          >
            Copy
          </button>
          <button className="btn btn--ghost" onClick={() => setInviteUrl(null)}>×</button>
        </div>
      )}

      <div className="board-stage">
        <Board
          cards={cards}
          connections={connections}
          editable={editable}
          selectedId={selection?.id ?? null}
          focusedCardId={focus?.cardId ?? null}
          onFocusCard={(cardId, from) => {
            setSelection(null);
            setFocus({ cardId, from });
          }}
          onSelectConnection={(id) =>
            editable && setSelection({ type: "connection", id })
          }
          onClearSelection={() => setSelection(null)}
          onMoveCard={moveCard}
          onTiltCard={tiltCard}
          onResizeFrame={resizeFrame}
          dropTargetId={dropTargetId}
          onCreateConnection={createConnection}
          handlesRef={handles}
        />

        {focus && focusedCard && (
          /* Keyed so a different card remounts the view, which commits any edit
             still sitting in a field. */
          <CardFocus
            key={focus.cardId}
            boardId={boardId}
            card={focusedCard}
            editable={editable}
            from={focus.from}
            group={focusedGroup}
            members={focusedMembers}
            onClose={() => setFocus(null)}
            onDelete={deleteCard}
            onTilt={(rotation, commit) => tiltCard(focus.cardId, rotation, commit)}
            onNavigate={navigateFocus}
          />
        )}

        {editable && selectedConn && (
          <aside className="side-panel">
            <ConnectionInspector
              key={selectedConn.id}
              boardId={boardId}
              connection={selectedConn}
              onDelete={deleteConnection}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
