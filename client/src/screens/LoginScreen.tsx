import styled from "styled-components";
import { api } from "../api";
import { StyledButton } from "../ui/Button";

interface Props {
  reason?: string;
}

export function LoginScreen({ reason }: Props) {
  return (
    <StyledLoginScreen>
      <StyledLoginCard>
        <StyledLoginPin />
        <h1>The Mystery Board</h1>
        <StyledLoginTag>
          Pin your suspects. Tie the threads. Reveal the truth — one clue at a time.
        </StyledLoginTag>
        {reason && <StyledLoginReason>{reason}</StyledLoginReason>}
        <StyledButton as="a" $variant="discord" href={api.loginUrl()}>
          Sign in with Discord
        </StyledButton>
        <StyledLoginFine>
          Private to your table — only invited players can see a board, and only
          the Game Master can upload art.
        </StyledLoginFine>
      </StyledLoginCard>
    </StyledLoginScreen>
  );
}

/* ─── styles ───────────────────────────────────────────────────── */

const StyledLoginScreen = styled.div`
  height: 100%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 50% 30%, #3b2f22, #1c1712);
  padding: 20px;
`;

const StyledLoginCard = styled.div`
  position: relative;
  background: var(--panel);
  border-radius: 14px;
  padding: 40px 36px 28px;
  max-width: 420px;
  text-align: center;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);

  h1 {
    font-family: var(--hand);
    font-size: 44px;
    margin: 6px 0 4px;
    color: var(--ink);
  }
`;

const StyledLoginPin = styled.div`
  position: absolute;
  top: -12px;
  left: 50%;
  width: 22px;
  height: 22px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ff7a6b, var(--accent));
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.4);
`;

const StyledLoginTag = styled.p`
  font-family: var(--hand);
  font-size: 22px;
  color: #5b4a33;
  margin: 0 0 18px;
`;

const StyledLoginReason = styled.p`
  background: #f6e5c9;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
`;

const StyledLoginFine = styled.p`
  font-size: 12px;
  color: #7a6a52;
  margin: 18px 0 0;
`;
