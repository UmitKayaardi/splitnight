import { EyeOff, HardDrive, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { Button } from '../../components/ui';
import { clearLocalData } from '../../state/history';
import { toast } from '../../state/toasts';
import { useUi } from '../../state/ui';

export function PrivacyDialog() {
  const { t } = useTranslation();
  const open = useUi((s) => s.privacyOpen);
  const setOpen = useUi((s) => s.setPrivacyOpen);
  const [confirming, setConfirming] = useState(false);

  const points = [
    { icon: ShieldCheck, text: t('privacy.p1') },
    { icon: EyeOff, text: t('privacy.p2') },
    { icon: HardDrive, text: t('privacy.p3') },
    { icon: Sparkles, text: t('privacy.p4') },
  ];

  return (
    <>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('privacy.title')}>
        <ul className="flex flex-col gap-3">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">
                <Icon aria-hidden className="size-5 text-primary" />
              </span>
              <p className="pt-1.5">{text}</p>
            </li>
          ))}
        </ul>
        <Button
          variant="danger"
          className="mt-5"
          block
          icon={<Trash2 aria-hidden className="size-5" />}
          onClick={() => setConfirming(true)}
        >
          {t('privacy.clear')}
        </Button>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('privacy.clear')}
        body={t('privacy.clearConfirm')}
        confirmLabel={t('privacy.clear')}
        tone="danger"
        onConfirm={() => {
          clearLocalData();
          setOpen(false);
          toast(t('privacy.cleared'), { tone: 'success' });
        }}
      />
    </>
  );
}
