import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML template for web export and dev server.
 * Injects font antialiasing, dark background reset, and font definitions for vector icons.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Solo Leveling // System Quest</title>
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                height: 100%;
                background-color: #070b13;
                color: #f4f8ff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
              #root {
                display: flex;
                height: 100%;
                flex: 1;
                background-color: #070b13;
              }
              /* Ensure icons and text render smoothly without clipping */
              svg, span, div {
                text-rendering: optimizeLegibility;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

