import { useEffect, useRef, useState } from "react";
import { api } from "../api";

interface Props {
  token: string;
  onJoined: (boardId: string) => void;
  onCancel: () => void;
}

export function JoinHandler({ token, onJoined, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api
      .redeemInvite(token)
      .then((r) => onJoined(r.boardId))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "This invite is not valid"),
      );
  }, [token, onJoined]);

  return (
    <div className="center-msg">
      {error ? (
        <>
          <p>{error}</p>
          <button className="btn" onClick={onCancel}>Go to my boards</button>
        </>
      ) : (
        <p>Joining the board…</p>
      )}
    </div>
  );
}
