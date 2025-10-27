import type { Metadata } from "next";
import { inter } from "@/app/ui/fonts";
import { Analytics } from "@vercel/analytics/react"
import Script from "next/script";
import "./globals.css";


export const metadata: Metadata = {
  title: 'ThunderPick',
  description: 'A simple tool to help you with FRC alliance selection using data from Statbotics.',
  metadataBase: new URL('https://quick-pick-psi.vercel.app/'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.png" sizes="any" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body
        className={`${inter.className} antialiased dark bg-[#0d111b]`}
      >
        <Script
          id="clarity-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "twr055bt3y");
            `,
          }}
        />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
