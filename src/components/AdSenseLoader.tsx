import Script from 'next/script';

/**
 * Loads the AdSense library once per page when the publisher id is set.
 * The same script serves Google's GDPR/US-states consent message
 * (configured in AdSense -> Privacy & messaging) before showing ads.
 */
export function AdSenseLoader() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return null;
  return (
    <Script
      id="adsense-loader"
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
    />
  );
}
