import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorker";
import InstallPrompt from "@/components/InstallPrompt";
import Providers from "@/components/Providers";
import SyncStatus from "@/components/SyncStatus";

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
  description: "Personal productivity system powered by GTD",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mainline",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('mainline-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegistrar />
        <InstallPrompt />
        <Providers>
          <Sidebar />
          <main className="md:ml-64 min-h-screen p-6 pt-16 md:pt-6">
            {children}
          </main>
          <SyncStatus />
        </Providers>
      </body>
    </html>
  );
}
