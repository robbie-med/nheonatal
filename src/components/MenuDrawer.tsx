import { ReactNode } from 'react';

interface MenuDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MenuDrawer({ open, onClose, children }: MenuDrawerProps) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="drawer-close" onClick={onClose} aria-label="Close menu">×</button>
        {children}
      </div>
    </div>
  );
}
