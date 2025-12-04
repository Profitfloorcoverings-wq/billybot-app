import "./globals.css";
import { Inter } from "next/font/google";
import Sidebar from "@/app/chat/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "BillyBot™",
  description: "AI Assistant for Flooring Businesses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen bg-[var(--bg1)]">
          <Sidebar />
          <main className="flex-1 p-10 relative overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

