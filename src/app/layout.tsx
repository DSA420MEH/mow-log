import type { Metadata } from "next";
import { Syne, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ActiveMowBanner } from "@/components/ActiveMowBanner";
import { PWAProvider } from "next-pwa-pack";
import { WebMCPProvider } from "@/components/WebMCPProvider";

const fontHeading = Syne({
  variable: "--font-heading",
  subsets: ["latin"],
});

const fontBody = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mow Log PWA",
  description: "Offline-first Progressive Web App for lawn care professionals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="en" className="dark">
      <body
        className={`${fontHeading.variable} ${fontBody.variable} font-sans antialiased min-h-screen bg-background text-foreground`}
      >
        {isDev ? (
          <div className="relative flex min-h-screen flex-col">
            <WebMCPProvider>
              <div className="flex-1">{children}</div>
            </WebMCPProvider>
            <ActiveMowBanner />
            <BottomNav />
            <script dangerouslySetInnerHTML={{
              __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
            ` }} />
          </div>
        ) : (
          <PWAProvider>
            <div className="relative flex min-h-screen flex-col">
              <WebMCPProvider>
                <div className="flex-1">{children}</div>
              </WebMCPProvider>
              <ActiveMowBanner />
              <BottomNav />
            </div>
            <script dangerouslySetInnerHTML={{
              __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  console.log('[PWA] New version detected, reloading...');
                  window.location.reload();
                });
              }
            ` }} />
          </PWAProvider>
        )}
      </body>
    </html>
  );
}
