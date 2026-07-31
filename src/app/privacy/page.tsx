export default function PrivacyPage() {
  return (
    <article className="prose prose-sm max-w-none text-[color:var(--color-ink)]">
      <h1 className="text-2xl font-bold text-[color:var(--color-brand)]">Privacy Policy</h1>
      <p>We collect as little as possible:</p>
      <ul>
        <li>
          <strong>Page views &amp; basic usage</strong> via PostHog. We store a random, anonymous ID
          in your browser&apos;s localStorage (not a cookie) so we can tell whether you&apos;re a
          returning visitor. We also log a few anonymous actions — the titles you search, when you
          reveal a &quot;what&apos;s in it&quot; section, and when you tap Share. None of this is tied
          to your identity.
        </li>
        <li><strong>Search queries</strong> are sent to our AI provider (Anthropic) to generate the rating. We don&apos;t tie queries to your identity.</li>
        <li><strong>Rate-limit counters</strong> use a salted hash of your IP address. We never store the raw IP.</li>
        <li><strong>Cookies:</strong> only a short-lived captcha bypass cookie if you&apos;ve solved a captcha recently.</li>
        <li>
          <strong>Advertising:</strong> we show ads via Google AdSense. Google and its partners
          use cookies and similar technologies to serve and measure ads and — where you consent —
          to personalize them. Visitors in the EEA, UK, and certain US states see a consent banner
          with their choices first. You can manage ad personalization at{' '}
          <a href="https://adssettings.google.com">adssettings.google.com</a> and read how Google
          uses data at{' '}
          <a href="https://policies.google.com/technologies/partner-sites">
            policies.google.com/technologies/partner-sites
          </a>
          .
        </li>
      </ul>
      <p>Aside from the advertising partners described above, we don&apos;t sell or share your data.</p>
      <p>Questions? Email tworden1993@gmail.com.</p>
      <p>Last updated: 2026-07-30.</p>
    </article>
  );
}
