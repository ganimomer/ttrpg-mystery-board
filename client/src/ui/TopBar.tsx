import styled from "styled-components";

/** The dark strip across the top of both the board list and a board. */
export const StyledTopBar = styled.header`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #2f2619;
  color: #f3e9d7;
  border-bottom: 3px solid #16110a;
  z-index: 20;
`;

export const StyledBoardName = styled.h1`
  font-family: var(--hand);
  font-size: 30px;
  margin: 0;
  font-weight: 700;
`;

/** Pushes whatever follows it to the right-hand end of the bar. */
export const StyledSpacer = styled.div`
  flex: 1;
`;
