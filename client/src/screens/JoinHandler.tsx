import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { StyledButton } from "../ui/Button";
import { StyledCenterMessage } from "../ui/CenterMessage";

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
    <StyledCenterMessage>
      {error ? (
        <>
          <p>{error}</p>
          <StyledButton onClick={onCancel}>Go to my boards</StyledButton>
        </>
      ) : (
        <p>Joining the board…</p>
      )}
    </StyledCenterMessage>
  );
}
