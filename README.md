# Kettu themes

Color themes for [Kettu](https://github.com/KettuAI/Kettu). Kettu lists them in Settings › Appearance › **Browse themes** and installs one with a click; any file here also installs with **Install from file…**.

| Theme                                  | Variants        | Author                                                           | License |
| -------------------------------------- | --------------- | ---------------------------------------------------------------- | ------- |
| [Catppuccin](themes/catppuccin.json)   | Latte and Mocha | [Catppuccin](https://github.com/catppuccin/catppuccin)           | MIT     |
| [Gruvbox](themes/gruvbox.json)         | Light and dark  | [Pavel Pertsev](https://github.com/morhetz/gruvbox)              | MIT     |
| [Nord](themes/nord.json)               | Light and dark  | [Arctic Ice Studio](https://github.com/nordtheme/nord)           | MIT     |
| [Paper](themes/paper.json)             | Light and dark  | [Kettu](https://github.com/KettuAI/Kettu)                        | MIT     |
| [Rosé Pine](themes/rose-pine.json)     | Dawn and Main   | [Rosé Pine](https://github.com/rose-pine/rose-pine-theme)        | MIT     |
| [Solarized](themes/solarized.json)     | Light and dark  | [Ethan Schoonover](https://github.com/altercation/solarized)     | MIT     |
| [Tokyo Night](themes/tokyo-night.json) | Light and Night | [enkia](https://github.com/tokyo-night/tokyo-night-vscode-theme) | MIT     |

Paper is Kettu's former built-in look: warm paper colors with Source Serif 4 for prose and headings and Inter for the interface. The others each keep their palette's published colors. Where one is too faint for text on its own surfaces, under 4.5:1, the theme uses the same hue a shade lighter or darker for text. Solarized keeps its body text tone, so Kettu marks its tile with a contrast warning.

## Adding a theme

1. In Kettu, open Settings › Appearance and choose **Export…** from a theme's menu. The file it saves sets every color Kettu has.
2. Change its `name`, `author`, `version`, `license` and `source`, and the colors of both variants. Each variant's `code` names the [Shiki theme](https://shiki.style/themes) for code.
3. Install it with **Install from file…** to try it. A warning on its tile lists the text that falls under 4.5:1 contrast.
4. Save it in `themes/` as `<id>.json`. The id is the name in lowercase ASCII letters and digits, with a dash for anything else: `Rosé Pine` is `rose-pine`.
5. Run `node scripts/build-index.mjs`, with Node.js 22 or later. It checks and formats every theme and writes `index.json`. Open a pull request with both.

A theme here needs a license that lets anyone use and share it, and names the palette's author in `author` and `source`. When you change a theme, raise its `version`: Kettu offers the update to everyone who installed it.

## The format

```json
{
  "kettuTheme": 1,
  "name": "Nord",
  "author": "Arctic Ice Studio",
  "version": "1.0.0",
  "license": "MIT",
  "source": "https://github.com/nordtheme/nord",
  "light": {
    "code": "github-light-default",
    "colors": { "bg-app": "#eceff4" }
  },
  "dark": { "code": "nord", "colors": { "bg-app": "#2e3440" } }
}
```

- A color a variant leaves out keeps Kettu's own.
- `fonts`, which both variants share, may name a face for `ui`, `prose` (the agent's replies and headings) and `code`: `system`, `inter`, `source-serif-4` or `jetbrains-mono`, and for `code` only `system` or `jetbrains-mono`. Kettu ships each of them; a role left out keeps Kettu's own.
- Colors are hex, `rgb()`, `hsl()`, `oklch()`, `oklab()` or `transparent`; nothing else, such as `var()` or color names.
- A file is at most 256 KB.

`index.json` lists each theme's id, name, author, version, license, file and SHA-256, and the colors its tile draws. Kettu checks a file against its SHA-256 before it installs it.

## License

The files here are under the [MIT License](LICENSE). Each palette is its authors' work under its own license; [NOTICE.md](NOTICE.md) lists them.
