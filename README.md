# TeamSpeak 6 Channel Image Generator
**Simple tool 🔨 for generating TeamSpeak 6 channel images 🖼️**

Fork of [TeamSpeak 5 Channel Image Generator](https://github.com/pitkes22/ts5-channel-image-generator) by Peter Adam,
retargeted at the TeamSpeak 6 client (row sizes, spacing, indentation and preview).

## ✨ Try it out 

You can make your TeamSpeak server more cool right now!
Just click [here to use the app](https://highdmt.github.io/ts6-channel-image-generator/)! 👈👈

## 🚀 How to use

1. Upload your image or load it using public URL
2. Adjust options to fit the image to the channels you see in the preview
3. Export your images and download ZIP file (you can specify file name prefix for your images)
4. Upload your images somewhere that gives a direct link to each PNG. GitHub works well (some image hosts block
   TeamSpeak from loading their images)
5. In TeamSpeak 6, open each channel's properties and paste the matching image URL into its image/banner URL field

## 📐 TeamSpeak 6 geometry

- Every channel and spacer row is 30 px tall with a 14 px gap, so each exported image is **500 × 44 px**
  (TS6 shows its middle 30 px). With *Ignore spacing* on, images are **500 × 30 px**.
- Images are drawn 1:1. Anything wider than 500 px is scaled down by TeamSpeak, so always use the exported 500 px images.
- The leftmost 10 px of the image (+10 px per nested level) are hidden behind the row edge.

Measurements and calibration screenshots are in [`docs/`](docs/) and [`CLAUDE.md`](CLAUDE.md).

## ⚙️ How it works

*TS6 Channel Image Generator* is fully client-side application built using React (Next.js). It uses Canvas API to work 
with images and 3rd party libraries to create ZIP files. Thanks to that no server is needed so **no images are 
uploaded/stored on the server**. App works in all modern browsers and support for image file formats is also 
dependent on supported file formats of given browser.

## 🛠️ Development

Requires **Node 16** (see `.nvmrc`; Next 10 does not build on newer Node without `NODE_OPTIONS=--openssl-legacy-provider`).

```bash
npm ci
npm run dev
```

`npm run build` produces the static site in `out/`.

## 🍰 Contributing

Any contribution is welcomed. 
Feel free to create an issue if you found a bug, or you have an idea how to improve the app! 

## 📜 Credits

Original tool © 2020 [Peter Adam](https://github.com/pitkes22). TS6 fork by [HighDmt](https://github.com/HighDmt).
