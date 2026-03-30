import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorker";
import InstallPrompt from "@/components/InstallPrompt";
import Providers from "@/components/Providers";
import SyncStatus from "@/components/SyncStatus";
import MainContent from "@/components/MainContent";
import GlobalHotkeys from "@/components/GlobalHotkeys";
import ErrorBoundary from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mainline",
  description: "Personal productivity system — capture, organize, act",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mainline",
  },
  openGraph: {
    title: "Mainline",
    description: "Personal productivity system — capture, organize, act",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Mainline",
    description: "Personal productivity system — capture, organize, act",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('mainline-theme');if(t!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ServiceWorkerRegistrar />
        <InstallPrompt />
        <Providers>
          <GlobalHotkeys />
          <Sidebar />
          <MainContent><ErrorBoundary>{children}</ErrorBoundary></MainContent>
          <SyncStatus />
        </Providers>
      </body>
    </html>
  );
}
