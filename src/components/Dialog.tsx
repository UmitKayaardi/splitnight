import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from './ui';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** "sheet" slides up from the bottom on phones; "center" is a small confirm box. */
  variant?: 'sheet' | 'center';
  footer?: ReactNode;
  wide?: boolean;
}

/**
 * Built on the native <dialog> element: focus is trapped, Escape closes it and the page
 * behind becomes inert, without any extra library.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  variant = 'sheet',
  footer,
  wide,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useTranslation();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  const position =
    variant === 'sheet'
      ? `mt-auto mb-0 sm:my-auto w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} rounded-t-[2rem] sm:rounded-[2rem]`
      : 'm-auto w-[min(92vw,26rem)] rounded-[2rem]';

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`max-h-[92dvh] max-w-none border border-border bg-surface p-0 text-text shadow-card backdrop:bg-[#0b0820]/60 backdrop:backdrop-blur-sm ${position}`}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <h2 id={titleId} className="min-w-0 flex-1 font-display text-xl font-semibold">
              {title}
            </h2>
            <IconButton label={t('common.close')} onClick={onClose}>
              <X aria-hidden className="size-5" />
            </IconButton>
          </div>
          <div className="overflow-y-auto px-5 pb-5">{children}</div>
          {footer && <div className="safe-bottom border-t border-border px-5 pt-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  tone = 'primary',
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  tone?: 'primary' | 'danger';
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} title={title} variant="center">
      <p className="text-muted">{body}</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
