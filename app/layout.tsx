import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "../components/navbar";
import { ClerkProvider } from "@clerk/nextjs";
import ReactQueryClientProvider from "@/components/react-query-client-provider";
import CreateProfileClient from '@/components/CreateProfileClient';
import Footer from "@/components/footer"; // Import the new Footer component

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// export const metadata: Metadata = {
//   title: "Random Playables",
//   description: "Turn math ponderings into citizen science games",
// };

export const metadata: Metadata = {
  title: "Random Playables",
  description: "Turn math ponderings into citizen science games",
  icons: {
    icon: "/RPLogo2.png", // This points to public/RPLogo2.png
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 text-gray-900 flex flex-col min-h-screen`}>
        <ClerkProvider>
          <ReactQueryClientProvider>
            <NavBar />
            <CreateProfileClient />
            <main className="flex-grow">
              <div className="max-w-7xl mx-auto pt-16 p-4">
                {children}
              </div>
            </main>
            <Footer /> {/* Add the Footer component here */}
          </ReactQueryClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}