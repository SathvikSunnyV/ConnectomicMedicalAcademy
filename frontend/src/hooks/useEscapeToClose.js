import { useEffect, useRef } from 'react';

// Closes a modal on the Escape key. Shared by NoteModal, HillVideoModal, and
// any future modal -- pass the onClose handler and, optionally, whether the
// modal is currently open (defaults to true, i.e. "always listen while
// mounted").
//
// Stacked modals: every open modal registers on a shared stack and a single
// document listener only notifies the top-most (most recently opened) one, so
// one Escape press closes one modal, not all of them.
const stack = [];

function handleKeyDown(e) {
  if (e.key !== 'Escape' || stack.length === 0) return;
  const top = stack[stack.length - 1];
  top.current();
}

export function useEscapeToClose(onClose, isOpen = true) {
  // Keep the latest handler in a ref so a changing onClose identity never
  // re-registers the modal (which would shuffle its position in the stack).
  const handlerRef = useRef(onClose);
  handlerRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    if (stack.length === 0) document.addEventListener('keydown', handleKeyDown);
    stack.push(handlerRef);
    return () => {
      const i = stack.indexOf(handlerRef);
      if (i !== -1) stack.splice(i, 1);
      if (stack.length === 0) document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);
}
