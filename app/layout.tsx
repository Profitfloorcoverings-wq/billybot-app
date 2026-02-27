import "./globals.css";
import { Inter } from "next/font/google";
import Script from "next/script";
import Sidebar from "@/app/chat/components/Sidebar";
import { ClientFlagsProvider } from "@/components/client-flags/ClientFlagsProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "BillyBot™",
  description: "AI Assistant for Flooring Businesses",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Script id="fb-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','24704985755777244');fbq('track','PageView');
        `}</Script>
        <ClientFlagsProvider>
          <div className="flex min-h-screen bg-[var(--bg1)]">
            <Sidebar />
            <main className="flex-1 p-10 relative overflow-y-auto">
              {children}
            </main>
          </div>
        </ClientFlagsProvider>
      </body>
    </html>
  );
}
