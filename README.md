# HACKIT 🟢

[![CI](https://github.com/andiburger/hackit/actions/workflows/ci.yml/badge.svg)](https://github.com/andiburger/hackit/actions/workflows/ci.yml)
[![Docker Image](https://github.com/andiburger/hackit/actions/workflows/docker.yml/badge.svg)](https://github.com/andiburger/hackit/actions/workflows/docker.yml)
[![Deploy to GitHub Pages](https://github.com/andiburger/hackit/actions/workflows/pages.yml/badge.svg)](https://github.com/andiburger/hackit/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ff9c.svg)](LICENSE)

An interactive hacker learning game in the browser (**German & English**). Across **21 missions** (6 chapters), you learn step by step how security testing, forensics, and cryptography work — inside a completely **simulated** terminal.

**Play online:** https://andiburger.github.io/hackit/

## Getting Started

Open [index.html](file:///Users/andreas/Documents/GitHub/hackit/index.html) in your browser, run it with Docker, or serve it locally:

```bash
# Run via Docker (pre-built from GitHub Container Registry)
docker run -d -p 8080:80 ghcr.io/andiburger/hackit:main

# Or serve locally with Python
python3 -m http.server 8642
# then open http://localhost:8642
```

No dependencies, no build step. Progress, language preference, and active sessions are automatically saved in `localStorage`.

### Running Tests

```bash
node tests/unit.js
# or on macOS with JavaScriptCore:
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tests/unit.js
```

## Features

- **Bilingual (DE / EN):** Switch live between German and English at any time in the top bar — including briefings, objectives, hints, file contents, and terminal messages.
- **Save & Resume Sessions:** Active missions are automatically saved after every command (including terminal output, command history, current `ssh`/`su` session stack, working directory, modified files, and completed objectives) and can be resumed anytime or reset via `↺ Restart`.
- **21 Missions in 6 Chapters:** All 13 original missions (Chapters 1–4) plus 8 more challenging Expert & Master missions (Chapters 5–6).
- **Enhanced Shell:** Supports pipes (`|`), output redirection (`>`, `>>`), command chaining (`;`, `&&`), Tab autocomplete, and command history (`↑`/`↓`).

## Missions

| # | Mission (EN / DE) | Topic | New Tools |
|---|-------------------|-------|-----------|
| 1 | Hello, Hacker / Hallo, Hacker | Terminal | `ls`, `cat`, `submit` |
| 2 | The Folder Labyrinth / Im Labyrinth der Ordner | Terminal | `cd`, `pwd` |
| 3 | Invisible Files / Unsichtbare Dateien | Terminal | `ls -a`, `ls -l` |
| 4 | Needle in a Haystack / Nadel im Heuhaufen | Forensics | `grep`, `head`, `tail` |
| 5 | Encoded Is Not Encrypted / Kodiert ist nicht verschlüsselt | Cryptography | `base64`, `echo`, Pipes (`\|`) |
| 6 | Caesar's Secret / Caesars Geheimnis | Cryptography | `caesar` |
| 7 | Forgotten Backups / Vergessene Backups | Forensics | `find` |
| 8 | The Safe / Der Tresor | Reverse Engineering | `strings`, `./programm` |
| 9 | Network Recon / Netzwerk-Aufklärung | Networking | `ifconfig`, `nmap`, `ssh` |
| 10 | Password Cracker / Passwort-Knacker | Passwords | `john`, `su` |
| 11 | SQL-Injection | Web | `curl` |
| 12 | Becoming Root / Root werden | Privilege Escalation | `sudo`, `find -exec` |
| 13 | Operation Blackout | Finale (Chapter 4) | Everything from 1–12 combined |
| 14 | Traces in the Image / Spuren im Bild | Forensics | `exiftool` |
| 15 | Environment & Mode / Umgebung & Modus | System Analysis | `env`, `export` |
| 16 | Symmetric XOR / Symmetrisches XOR | Cryptography | `xor` |
| 17 | Permissions & Tools / Rechte & Werkzeuge | Terminal | `chmod +x`, `>` / `>>`, `&&` |
| 18 | Scheduled Tasks / Geplante Aufgaben | Forensics | `crontab -l` |
| 19 | Headers & Tokens / Header & Tokens | Web | `curl -H` |
| 20 | The Jump Host / Das Sprungbrett | Networking | Multi-hop `ssh` (Bastion / Pivoting) |
| 21 | Operation Phantom | Master Finale (Chapter 6) | Full chain combined |

## Project Structure

```
index.html              Screens (Start, Mission Overview, Game, Success Modal)
css/style.css           Cyberpunk UI, language switch & session banner
js/i18n.js              Language management (DE/EN) & tr(de, en)
js/vfs.js               Virtual filesystem, permissions & hosts
js/terminal.js          Terminal renderer (history, TAB, password prompts)
js/commands.js          Core shell incl. pipes, >, >>, ; and &&
js/commands-extra.js    Extended commands (exiftool, xor, env, export, chmod, crontab)
js/levels.js            Missions 1–13 (Chapters 1–4, bilingual)
js/levels-advanced.js   Missions 14–21 (Chapters 5–6, bilingual)
js/levels-index.js      Combines all chapters & missions
js/game.js              Game loop, session persistence, language switching & UI
```

> ⚠️ All systems are simulated. In real life, only test systems you have explicit permission to test.
