import styled, { css } from "styled-components";

type Variant = "ghost" | "danger" | "discord";

const variants: Record<Variant, ReturnType<typeof css>> = {
  ghost: css`
    background: rgba(255, 255, 255, 0.12);
  `,
  danger: css`
    background: var(--accent);
  `,
  discord: css`
    background: #5865f2;
    color: white;
    text-decoration: none;
    display: inline-block;
    font-size: 16px;
    padding: 12px 22px;
    border-radius: 10px;
  `,
};

/** The app's one button. `as="a"` for the link-shaped Discord variant. */
export const StyledButton = styled.button<{ $variant?: Variant }>`
  font-family: var(--ui);
  font-size: 14px;
  font-weight: 600;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: #3a2f22;
  color: #f5ecdd;
  cursor: pointer;
  transition: transform 0.06s ease, filter 0.15s ease;

  &:hover {
    filter: brightness(1.12);
  }
  &:active {
    transform: translateY(1px);
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  ${(p) => p.$variant && variants[p.$variant]}
`;
