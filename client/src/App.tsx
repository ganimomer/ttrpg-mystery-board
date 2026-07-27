import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useMe } from "./auth/useMe";
import { BoardView } from "./board/BoardView";
import { BoardList } from "./screens/BoardList";
import { JoinHandler } from "./screens/JoinHandler";
import { LoginScreen } from "./screens/LoginScreen";
import { StyledCenterMessage } from "./ui/CenterMessage";

const PENDING_JOIN_KEY = "pendingJoinToken";

function joinToken(path: string): string | null {
  const m = path.match(/^\/join\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function App() {
  const { me, loading, refresh } = useMe();
  const [path, setPath] = useState(window.location.pathname);
  const [boardId, setBoardId] = useState<string | null>(null);

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, "", to);
    setPath(to);
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Stash an invite token so it survives the Discord login round-trip.
  const pendingFromUrl = joinToken(path);
  useEffect(() => {
    if (pendingFromUrl) localStorage.setItem(PENDING_JOIN_KEY, pendingFromUrl);
  }, [pendingFromUrl]);

  const openBoard = useCallback(
    (id: string) => {
      localStorage.removeItem(PENDING_JOIN_KEY);
      setBoardId(id);
      navigate("/");
    },
    [navigate],
  );

  async function logout() {
    await api.logout().catch(() => {});
    setBoardId(null);
    await refresh();
  }

  if (loading) return <StyledCenterMessage>Loading…</StyledCenterMessage>;

  const pendingToken = pendingFromUrl ?? localStorage.getItem(PENDING_JOIN_KEY);

  // Not signed in.
  if (!me) {
    return (
      <LoginScreen
        reason={
          pendingToken
            ? "Sign in with Discord to join the board you were invited to."
            : undefined
        }
      />
    );
  }

  // Signed in, but there's an invite waiting to be redeemed.
  if (pendingToken) {
    return (
      <JoinHandler
        token={pendingToken}
        onJoined={openBoard}
        onCancel={() => {
          localStorage.removeItem(PENDING_JOIN_KEY);
          navigate("/");
        }}
      />
    );
  }

  // Inside a board.
  if (boardId) {
    return <BoardView boardId={boardId} onExit={() => setBoardId(null)} />;
  }

  // Board picker.
  return <BoardList me={me} onOpen={setBoardId} onLogout={logout} />;
}
