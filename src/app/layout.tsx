import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { ActiveMowBanner } from "@/components/ActiveMowBanner";
import { PWAProvider } from "next-pwa-pack";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        {isDev ? (
          <div className="relative flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
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
              <div className="flex-1">{children}</div>
              <ActiveMowBanner />
              <BottomNav />
            </div>
          </PWAProvider>
        )}
      </body>
    </html>
  );
}
