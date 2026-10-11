# FAYQ M8 marketing assets

The source is the owner-reviewed generated illustration in `reports-and-markdown-files/milestones/m8/design/assets/fayq-learning-hero.png`; see that folder's README for provenance and the generation prompt. It depicts a fictional learner, not a real student's portrait.

The selected all-founder hero uses `fayq-founders-640.webp`, `fayq-founders-1280.webp` and `fayq-founders-1920.webp` as responsive source sizes. They were resized from the wide generated banner in `landing-page-preview-assets/fayq-three-founders-hero.png` with FFmpeg/libwebp at quality 84; original composition is preserved. The banner was generated using the supplied founder portraits as references, so the faces are AI interpretations rather than pixel-preserving composites.

The home-page founder carousel uses responsive 640px and 1280px WebP versions of the Ali–Taha learning banner (`fayq-ali-taha-*.webp`) and Saif creative banner (`fayq-saif-*.webp`). These were resized from the standalone preview artwork at quality 84; each slide preserves the wide image's full composition on desktop and mobile. GSAP animates the horizontal slide changes, with reduced-motion support. The supplied portraits guided the generated artwork, so the faces remain AI interpretations rather than exact facial composites.

`docker/browser/m8-optimize-assets.mjs` runs inside the cached Docker Chromium image. It scales the unchanged composition with canvas and exports WebP at quality 0.84. Original: 1672×941. Outputs: 640×360, 27190 bytes; 1280×720, 70008 bytes. The browser receives a responsive srcset; the image is decorative and marketing copy stays accessible HTML. Source artwork is not copied into the production bundle.

The editable wordmark is centralized in `components/ui/Wordmark.tsx`. It is a reconstruction of the supplied angular lettering, Q tail and amber rays, not an original vector export. Letter proportions and Q geometry differ from the board. Its Q ring uses the theme's readable green while the tail remains lime; the Latin arrangement never reverses in RTL. The product name has accessible HTML naming.
