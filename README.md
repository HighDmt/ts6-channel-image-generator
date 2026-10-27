# TeamSpeak 6 Channel Image Generator
**Simple tool 🔨 for generating TeamSpeak 6 channel images 🖼️**

Fork of [TeamSpeak 5 Channel Image Generator](https://github.com/pitkes22/ts5-channel-image-generator) by Peter Adam,
updated for the TeamSpeak 6 client.

## ✨ Try it out

Turn one picture into a banner that runs across all your channels.
[Open the app here](https://highdmt.github.io/ts6-channel-image-generator/)! 👈

## 🚀 How to use

1. Upload your image (choose a file, drag and drop it, paste it, or load it from a URL)
2. Adjust the options until the preview looks the way you want
3. Export your images as a ZIP file
4. Upload the images somewhere that gives a direct link to each PNG. GitHub works well (some image hosts block
   TeamSpeak from loading their images)
5. In TeamSpeak 6, open each channel's properties and paste the matching image URL into its image/banner URL field

## 💡 Tips

- Images made with an older version of this tool may not line up perfectly. Export them again.
- The preview's colors can look slightly different from TeamSpeak on some monitors. The exported images are not
  affected.

## ⚙️ How it works

*TS6 Channel Image Generator* runs entirely in your browser (React / Next.js and the Canvas API). **Your images are
never uploaded to a server**, and your project is saved only in your own browser.

## 🛠️ Development

Requires **Node 16** (see `.nvmrc`).

```bash
npm ci
npm run dev
```

`npm run build` produces the static site in `out/`. Technical notes and TeamSpeak 6 measurements are in
[`CLAUDE.md`](CLAUDE.md) and [`docs/`](docs/).

## 🍰 Contributing

Any contribution is welcome.
Feel free to create an issue if you found a bug, or you have an idea how to improve the app!

## 📜 Credits

Original tool © 2020 [Peter Adam](https://github.com/pitkes22). TS6 fork by [HighDmt](https://github.com/HighDmt).
