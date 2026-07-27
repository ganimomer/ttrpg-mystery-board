import styled, { css } from "styled-components";

/** Shared by both field shapes — they only differ in the element. */
const field = css`
  font-family: var(--ui);
  font-size: 14px;
  padding: 8px 10px;
  border: 1px solid #d8ccb6;
  border-radius: 7px;
  background: white;
  color: var(--ink);
  width: 100%;
`;

export const StyledInput = styled.input`
  ${field}
`;

export const StyledTextArea = styled.textarea`
  ${field}
`;
