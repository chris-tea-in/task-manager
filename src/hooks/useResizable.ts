import { useRef, useCallback } from 'react';
import { useStore } from '../store/store';

export function useResizable() {
  const setNotesWidth = useStore((s) => s.setNotesWidth);
  const notesWidth = useStore((s) => s.notesWidth);
  const panelRef = useRef<HTMLDivElement>(null);

  const onDragHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      const onMouseMove = (ev: MouseEvent) => {
        if (!panelRef.current) return;
        const rect = panelRef.current.getBoundingClientRect();
        const newWidth = rect.right - ev.clientX;
        setNotesWidth(newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [setNotesWidth]
  );

  return { panelRef, notesWidth, onDragHandleMouseDown };
}
