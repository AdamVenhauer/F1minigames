
import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SoundProvider } from '@/context/SoundContext'; // Added import

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Apex Start - F1 Mini Games',
  description: 'Test your F1 skills with multiple mini-games!',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <SoundProvider> {/* Added SoundProvider */}
          <div className="flex flex-col min-h-screen">
            <main className="flex-grow">
              {children}
            </main>
            <Toaster />
            <footer className="py-6 px-4 text-center text-sm text-muted-foreground border-t">
              <p>&copy; {new Date().getFullYear()} Apex Start. All rights reserved.</p>
              <p>Inspired by the thrill of Formula 1.</p>
            </footer>
          </div>
        </SoundProvider> {/* Closed SoundProvider */}
      </body>
    </html>
  );
}
