import type { Metadata } from 'next';
import './globals.css';
import { Footer } from '@/components/Footer';
import { PostHogProvider } from '@/components/PostHogProvider';

export const metadata: Metadata = {
  title: 'IsItSmut — Find out before you start chapter one.',
  description: "Look up any book, movie, or TV show and see if it contains smut. 1–10 rating, short synopsis, and a (blurred) breakdown of what's in it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <main className="mx-auto max-w-xl px-5 pt-10">{children}</main>
          <Footer />
        </PostHogProvider>
      </body>
    </html>
  );
}
