# FAYQ M8 marketing assets

The source is the owner-reviewed generated illustration in `reports-and-markdown-files/m8-design/assets/fayq-learning-hero.png`; see that folder's README for provenance and the generation prompt. It depicts a fictional learner, not a real student's portrait.

`docker/browser/m8-optimize-assets.mjs` runs inside the cached Docker Chromium image. It scales the unchanged composition with canvas and exports WebP at quality 0.84. Original: 1672×941. Outputs: 640×360, 27190 bytes; 1280×720, 70008 bytes. The browser receives a responsive srcset; the image is decorative and marketing copy stays accessible HTML. Source artwork is not copied into the production bundle.

The editable wordmark is centralized in `components/ui/Wordmark.tsx`. It is a reconstruction of the supplied angular lettering, Q tail and amber rays, not an original vector export. Letter proportions and Q geometry differ from the board. Its Q ring uses the theme's readable green while the tail remains lime; the Latin arrangement never reverses in RTL. The product name has accessible HTML naming.
