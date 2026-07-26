import { useEffect, useRef, useState } from "react";

/**
 * A text field that mirrors a server value locally and commits its edit on blur
 * *and* on unmount.
 *
 * The unmount flush is what makes "click away to save" work: the cork board
 * clears the selection on `pointerdown`, which tears the panel down before the
 * browser's `mousedown` default action would have blurred the input — and
 * removing a focused element never dispatches `blur`.
 *
 * Only a field the user actually typed in is committed, so an edit arriving
 * over SSE from another GM is never clobbered by a stale mirror. `commit` runs
 * only when the local value differs from `remote`, so callers can do their own
 * trimming/mapping inside it.
 */
export function useCommittedField(remote: string, commit: (value: string) => void) {
  const [value, setValue] = useState(remote);

  // Everything the unmount cleanup needs, in one ref so it can stay a
  // mount-only effect. `value`/`dirty` are written synchronously by onChange so
  // a flush can never miss the last keystroke; `remote`/`commit` are props.
  const state = useRef({ value, remote, commit, dirty: false });
  useEffect(() => {
    state.current.remote = remote;
    state.current.commit = commit;
  });

  // An untouched field follows the server.
  useEffect(() => {
    if (!state.current.dirty) {
      state.current.value = remote;
      setValue(remote);
    }
  }, [remote]);

  const flush = () => {
    const s = state.current;
    if (s.dirty && s.value !== s.remote) s.commit(s.value);
    s.dirty = false;
  };

  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      state.current.value = e.target.value;
      state.current.dirty = true;
      setValue(e.target.value);
    },
    onBlur: flush,
  };
}
