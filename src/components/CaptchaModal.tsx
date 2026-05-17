'use client';

import HCaptcha from '@hcaptcha/react-hcaptcha';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function CaptchaModal({ open, onClose, onSuccess }: Props) {
  if (!open) return null;

  async function handleVerify(token: string) {
    const res = await fetch('/api/captcha-verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.ok) onSuccess();
  }

  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-bold text-[color:var(--color-ink)]">Quick check</h2>
        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
          Too many lookups from your network. Solve this and you&apos;re back in.
        </p>
        <div className="mt-4 flex justify-center">
          {siteKey ? (
            <HCaptcha sitekey={siteKey} onVerify={handleVerify} />
          ) : (
            <p className="text-xs text-red-600">Captcha not configured.</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-[color:var(--color-border)] py-2 text-sm text-[color:var(--color-ink-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
