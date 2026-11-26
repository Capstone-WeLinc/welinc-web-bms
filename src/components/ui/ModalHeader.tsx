import type { ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

/**
 * The One UI modal header, used by every modal: navy bar, white title (no icon
 * beside it, spec bms/0017), optional gold subtitle (usually a reference number),
 * optional badge, and the gold close button. Modeled on Booking details.
 *
 * Inside a Radix <Dialog> leave `plain` off so the title and subtitle are wired
 * to the dialog for screen readers. Hand-built modals pass `plain` and `titleId`.
 */
export default function ModalHeader({ title, subtitle, aside, onClose, closeLabel = 'Close', closeDisabled = false, plain = false, titleId }: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Shown before the close button, e.g. a status badge. */
  aside?: ReactNode;
  /** Without it, the close button closes the surrounding Radix dialog. */
  onClose?: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  plain?: boolean;
  titleId?: string;
}) {
  const titleClass = 'break-words text-xl font-semibold leading-7 text-white';
  const subtitleClass = 'truncate text-xs font-medium tracking-widest text-[#e8b800]';
  const closeClass = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#e8b800] transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b800] disabled:opacity-50';
  const closeButton = <button type="button" onClick={onClose} disabled={closeDisabled} aria-label={closeLabel} className={closeClass}><X size={16} aria-hidden="true" /></button>;

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 bg-[#1a1f6e] px-5 py-4 text-left text-white">
      <div className="flex min-w-0 items-center">
        <div className="min-w-0 space-y-1">
          {plain
            ? <h2 id={titleId} className={titleClass}>{title}</h2>
            : <DialogPrimitive.Title className={titleClass}>{title}</DialogPrimitive.Title>}
          {subtitle && (plain
            ? <p className={subtitleClass}>{subtitle}</p>
            : <DialogPrimitive.Description className={subtitleClass}>{subtitle}</DialogPrimitive.Description>)}        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {aside}
        {onClose || plain ? closeButton : <DialogPrimitive.Close asChild>{closeButton}</DialogPrimitive.Close>}
      </div>
    </header>
  );
}
