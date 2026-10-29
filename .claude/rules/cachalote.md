# Cachalote — reglas del fork

Este repo es **Cachalote**, un fork personal de Orca (`stablyai/orca`). Todo cambio
tiene que sobrevivir a `cachalote-sync`, que rebasea los commits propios sobre cada
release de upstream. Estas reglas existen para que ese rebase no se rompa.

Las convenciones de código de upstream (`AGENTS.md`) siguen valiendo: comentarios
cortos, lint, tests, naming.

## Ramas y sync

- **Los features van en `mine`.** `main` es un espejo de `upstream/main` y nunca
  lleva commits propios.
- **`mine` no se rebasea, resetea ni mueve a mano.** El sync lo hace solo
  `cachalote-sync` (`~/dotfiles/bin/`), que lleva la cuenta del tag base en
  `refs/cachalote/base`. Moverlo a mano rompe el próximo sync.
- **Upstream publica en ramas laterales:** cada tag es un corte de `main` más unos
  commits de release, y los tags no son ancestros entre sí. Nunca `git rebase <tag>`
  pelado; el script usa `--onto`.
- **Nada hacia upstream:** sin push a `stablyai/orca` y sin PRs (el remote ya tiene
  `no_push`).
- Lo propio, siempre a la vista: `git diff refs/cachalote/base mine`.

## Cómo escribir un feature para que el rebase no choque

1. **Código nuevo en archivos nuevos**, bajo `src/main/cachalote/` o
   `src/renderer/src/cachalote/`.
2. **En archivos de upstream, solo agregar líneas.** Modificar una línea existente
   es un conflicto seguro en cuanto upstream la toque. Si no queda otra, que sea
   una sola línea.
3. **Marcar cada toque con un comentario `// Cachalote: …`**, para encontrarlos con
   `rg "Cachalote:"` al resolver un conflicto.
4. **Un commit por feature,** con prefijo `feat(cachalote): …`, y un cuerpo que
   explique el porqué. Ese commit es lo que se re-aplica en cada release.
5. **Assets que reemplazan a los de upstream:** `resources/icon.png` (ícono del Dock al
   arrancar) es la ballena. Si un rebase marca conflicto ahí, quedarse con el nuestro
   (se regenera desde `resources/build/cachalote/icon.icns`). La fuente del ícono es
   `resources/build/cachalote/icon.icon` (Icon Composer), compilada con `xcrun actool`.
6. **No tocar `CLAUDE.md` ni `AGENTS.md` de upstream.** Las reglas del fork van en
   `.claude/rules/`.

## Identidad de la app: no se cambia

Estos valores siguen siendo `Orca` a propósito. Cambiarlos rompe la app o el perfil:

| Qué | Por qué no |
| --- | --- |
| `CFBundleName` crudo del `Info.plist` | Electron busca sus helpers como `<CFBundleName> Helper.app`; si cambia, aborta al abrir (`Unable to find helper app`) |
| `productName`, `app.name` | De ahí salen la carpeta del perfil (`~/Library/Application Support/orca`) y la entrada del llavero de `safeStorage` |
| `appId` (`com.stablyai.orca`) | Identidad del perfil, del CLI `orca` y de los permisos de macOS |

El nombre visible "Cachalot" va solo en `CFBundleDisplayName`, en
`resources/build/cachalote/InfoPlist.strings` y en `CACHALOTE_APP_NAME`.

## Desarrollo y prueba

- **Loop de desarrollo:** `pnpm dev`. Corre al lado del Cachalote instalado, con su
  propio perfil (`orca-dev`). Si lo lanza un agente, va con `ORCA_BACKGROUND_LAUNCH=1`.
- **Antes de commitear,** sobre los archivos tocados: `tsc -p config/tsconfig.node.json`
  (o `pnpm tc`), `pnpm exec oxlint <archivos>`, `pnpm exec oxfmt --check <archivos>`
  y los tests relacionados (`pnpm test <archivo.test.ts>`). Se commitea con
  `HUSKY=0` porque el hook de upstream corre el lint completo; los chequeos de arriba
  no se saltean.

## Build e instalación

- **Instalar solo con `cachalote-sync`** (o `cachalote-sync --install-built`). En
  Apple Silicon, el build bueno es `dist/mac-arm64/`; `dist/mac/` es x64, y bajo
  Rosetta deja la CPU al 100%.
- **Nunca correr `cachalote-sync` desde una terminal de Cachalote:** el script cierra
  la app, y con ella la sesión. Va desde Ghostty, Terminal.app o una terminal de la
  instancia `pnpm dev`.
- **Si un build se hace a mano**, replicar lo que hace el script: `pnpm install:release`,
  `pnpm install` dentro de `mobile/` y `DEVELOPER_DIR=/Library/Developer/CommandLineTools`
  (Swift 6.4 de Xcode rompe `build:computer-macos`).
- **Si algo sale mal:** `cachalote-sync --rollback` vuelve a la app anterior.
