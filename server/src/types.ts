import type { Role, User } from "@board/shared";

export interface AppEnv {
  Variables: {
    user: User;
    // Set by requireBoardMember for routes under /boards/:boardId
    boardId: string;
    role: Role;
  };
}
