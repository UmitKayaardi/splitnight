import { CloudOff, FileWarning, Hourglass, ScanSearch, ServerCrash, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientErrorCode } from '../lib/api';
import { Card } from './ui';

const ICONS: Partial<Record<ClientErrorCode, typeof CloudOff>> = {
  UNREADABLE: ScanSearch,
  UNSUPPORTED_TYPE: FileWarning,
  TOO_LARGE: FileWarning,
  OFFLINE: WifiOff,
  NETWORK: WifiOff,
  RATE_LIMITED: Hourglass,
  TIMEOUT: Hourglass,
};

/** A friendly, translated explanation of an error code plus the next things to try. */
export function ErrorCard({ code, actions }: { code: ClientErrorCode; actions: ReactNode }) {
  const { t } = useTranslation();
  const Icon = ICONS[code] ?? ServerCrash;
  return (
    <Card className="flex flex-col items-center gap-3 p-6 text-center" as="section">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-warning-bg text-warning-fg">
        <Icon aria-hidden className="size-7" />
      </span>
      <h2 className="font-display text-2xl font-semibold" role="alert">
        {t(`errors.${code}.title`)}
      </h2>
      <p className="max-w-sm text-muted">{t(`errors.${code}.body`)}</p>
      <div className="mt-2 flex w-full flex-col gap-2">{actions}</div>
    </Card>
  );
}
