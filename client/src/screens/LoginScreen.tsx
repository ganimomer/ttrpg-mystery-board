import { api } from "../api";

interface Props {
  reason?: string;
}

export function LoginScreen({ reason }: Props) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-pin" />
        <h1>The Mystery Board</h1>
        <p className="login-tag">
          Pin your suspects. Tie the threads. Reveal the truth — one clue at a time.
        </p>
        {reason && <p className="login-reason">{reason}</p>}
        <a className="btn btn--discord" href={api.loginUrl()}>
          Sign in with Discord
        </a>
        <p className="login-fine">
          Private to your table — only invited players can see a board, and only
          the Game Master can upload art.
        </p>
      </div>
    </div>
  );
}
