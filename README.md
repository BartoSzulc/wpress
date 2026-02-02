# wpress-cleaner

Interactive CLI tool to find and delete All-in-One WP Migration backup files (`.wpress`). Similar to [npkill](https://github.com/voidcosmos/npkill), but for WordPress backups.

![wpress-cleaner screenshot](https://raw.githubusercontent.com/BartoSzulc/wpress-cleaner/refs/heads/main/screenshot.png)

## Features

- 🔍 Scans directories recursively for `ai1wm-backups` folders
- 📊 Shows file count, total size, and last modified date
- 📁 Browse individual `.wpress` files within each backup folder
- 🗑️ Delete entire backup folders or individual files
- 💾 Real-time space saved counter
- ⚡ Zero dependencies - pure Node.js

## Installation

```bash
# Run directly without installation
npx wpress-cleaner

# Or install globally
npm install -g wpress-cleaner
```

## Usage

```bash
# Scan default Laragon directory
wpress-cleaner

# Scan custom directory
wpress-cleaner /path/to/wordpress/sites
```

### Controls

**Folder view:**
| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate folders |
| `Enter` | Open folder to view files |
| `Space` | Delete all files in folder |
| `Q` | Quit |

**File view:**
| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate files |
| `Space` | Delete selected file |
| `Backspace` / `Esc` | Go back to folders |
| `Q` | Quit |

## Default scan path

By default, the tool scans `/mnt/c/laragon/www` (WSL path for Laragon). Pass a custom path as argument to scan a different directory.

## License

MIT © [Bartosz Szulc](https://github.com/BartoSzulc)
