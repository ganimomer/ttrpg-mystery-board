import { useMemo, useRef, useState } from "react";
import type { Card, Connection } from "@board/shared";
import { api } from "../api";
import { Board, type BoardHandles } from "./Board";
import { CardFocus } from "./CardFocus";
import { ConnectionInspector } from "./Inspector";
import { CARD_HEIGHT, CARD_WIDTH } from "./layout";
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
    const connections: Record<string, Connection> = {};
    for (const c of Object.values(state.connections)) {
      if (c.revealed && cards[c.fromCardId] && cards[c.toCardId]) {
        connections[c.id] = c;
      }
    }
    return { cards, connections };
  }, [previewAsPlayer, state.cards, state.connections]);

  async function addCard() {
    if (busy) return;
    setBusy(true);
    try {
      const center = handles.current?.viewportCenter() ?? { x: 0, y: 0 };
      const card = await api.createCard(boardId, {
        x: Math.round(center.x - CARD_WIDTH / 2),
        y: Math.round(center.y - CARD_HEIGHT / 2),
        rotation: Math.round((Math.random() - 0.5) * 12),
        revealed: false,
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
    state.patchCardLocal({ ...card, x, y });
    if (commit) void api.updateCard(boardId, id, { x, y }).catch(() => {});
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

  return (
    <div className="boardview">
      <header className="topbar">
        <button className="btn btn--ghost" onClick={onExit}>← Boards</button>
        <h1 className="board-name">{state.board?.name}</h1>
        <div className="spacer" />
        {isGM && (
          <>
            <button className="btn" onClick={addCard} disabled={busy || previewAsPlayer}>
              + Card
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
            onClose={() => setFocus(null)}
            onDelete={deleteCard}
            onTilt={(rotation, commit) => tiltCard(focus.cardId, rotation, commit)}
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
