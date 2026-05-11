import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="preconnect" href="https://i.ytimg.com" />
        <link rel="dns-prefetch" href="https://www.googleapis.com" />

        {/* Primary Meta Tags */}
        <meta name="application-name" content="Lyrix" />
        <meta name="theme-color" content="#000000" />
        <meta
          name="keywords"
          content="music streaming, free music, songs, podcasts, playlists, lyrics, artist, albums, Hindi songs, Bollywood music"
        />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://elyrix.vercel.app" />
        <meta property="og:title" content="Lyrix — Free Music & Podcast Streaming" />
        <meta
          property="og:description"
          content="Stream millions of songs, discover new artists, create playlists, and enjoy podcasts — all for free. No ads, no limits."
        />
        <meta property="og:image" content="https://elyrix.vercel.app/og-image.png" />
        <meta property="og:site_name" content="Lyrix" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="https://elyrix.vercel.app" />
        <meta name="twitter:title" content="Lyrix — Free Music & Podcast Streaming" />
        <meta
          name="twitter:description"
          content="Stream millions of songs, discover new artists, create playlists, and enjoy podcasts — all for free. No ads, no limits."
        />
        <meta name="twitter:image" content="https://elyrix.vercel.app/og-image.png" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
