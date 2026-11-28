# Narwhal — reglas del fork

Este repo es **Narwhal**, un fork personal de Orca (`stablyai/orca`). Todo cambio
tiene que sobrevivir a `narwhal-sync`, que rebasea los commits propios sobre cada
release de upstream. Estas reglas existen para que ese rebase no se rompa.

Las convenciones de código de upstream (`AGENTS.md`) siguen valiendo: comentarios
cortos, lint, tests, naming.

## Ramas y sync

- **Los features van en `mine`.** `main` es un espejo de `upstream/main` y nunca
  lleva commits propios.
- **`mine` no se rebasea, resetea ni mueve a mano.** El sync lo hace solo
  `narwhal-sync` (`~/dotfiles/bin/`), que lleva la cuenta del tag base en
  `refs/narwhal/base`. Moverlo a mano rompe el próximo sync.
- **Upstream publica en ramas laterales:** cada tag es un corte de `main` más unos
  commits de release, y los tags no son ancestros entre sí. Nunca `git rebase <tag>`
  pelado; el script usa `--onto`.
- **Nada hacia upstream:** sin push a `stablyai/orca` y sin PRs (el remote ya tiene
  `no_push`).
- Lo propio, siempre a la vista: `git diff refs/narwhal/base mine`.

## Cómo escribir un feature para que el rebase no choque

1. **Código nuevo en archivos nuevos**, bajo `src/main/narwhal/` o
   `src/renderer/src/narwhal/`.
2. **En archivos de upstream, solo agregar líneas.** Modificar una línea existente
   es un conflicto seguro en cuanto upstream la toque. Si no queda otra, que sea
   una sola línea.
3. **Marcar cada toque con un comentario `// Narwhal: …`**, para encontrarlos con
   `rg "Narwhal:"` al resolver un conflicto.
4. **Un commit por feature,** con prefijo `feat(narwhal): …`, y un cuerpo que
   explique el porqué. Ese commit es lo que se re-aplica en cada release.
5. **Assets que reemplazan a los de upstream:** `resources/icon.png` (ícono del Dock al
   arrancar) es el narval. Si un rebase marca conflicto ahí, quedarse con el nuestro
   (se regenera desde `resources/build/narwhal/icon.icns`). La fuente del ícono es
   `resources/build/narwhal/icon.icon` (Icon Composer, capa PNG 1024 `Assets/narwhal.png`), compilada con `xcrun actool`.
6. **No tocar `CLAUDE.md` ni `AGENTS.md` de upstream.** Las reglas del fork van en
   `.claude/rules/`.

## Identidad de la app: no se cambia

Estos valores siguen siendo `Orca` a propósito. Cambiarlos rompe la app o el perfil:

| Qué                                   | Por qué no                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `CFBundleName` crudo del `Info.plist` | Electron busca sus helpers como `<CFBundleName> Helper.app`; si cambia, aborta al abrir (`Unable to find helper app`) |
| `productName`, `app.name`             | De ahí salen la carpeta del perfil (`~/Library/Application Support/orca`) y la entrada del llavero de `safeStorage`   |
| `appId` (`com.stablyai.orca`)         | Identidad del perfil, del CLI `orca` y de los permisos de macOS                                                       |

El nombre visible "Narwhal" va solo en `CFBundleDisplayName`, en
`resources/build/narwhal/InfoPlist.strings` y en `NARWHAL_APP_NAME`.
Visible brand: Narwhal. Code name: narwhal (was cachalote; old commits in the series still say cachalote).

## Desarrollo y prueba

- **Loop de desarrollo:** `pnpm dev`. Corre al lado del Narwhal instalado, con su
  propio perfil (`orca-dev`). Si lo lanza un agente, va con `ORCA_BACKGROUND_LAUNCH=1`.
- **Antes de commitear,** sobre los archivos tocados: `tsc -p config/tsconfig.node.json`
  (o `pnpm tc`), `pnpm exec oxlint <archivos>`, `pnpm exec oxfmt --check <archivos>`
  y los tests relacionados (`pnpm test <archivo.test.ts>`). Se commitea con
  `HUSKY=0` porque el hook de upstream corre el lint completo; los chequeos de arriba
  no se saltean.

## Build e instalación

- **Instalar solo con `narwhal-sync`** (o `narwhal-sync --install-built`). En
  Apple Silicon, el build bueno es `dist/mac-arm64/`; `dist/mac/` es x64, y bajo
  Rosetta deja la CPU al 100%.
- **Nunca correr `narwhal-sync` desde una terminal de Narwhal:** el script cierra
  la app, y con ella la sesión. Va desde Ghostty, Terminal.app o una terminal de la
  instancia `pnpm dev`.
- **Si un build se hace a mano**, replicar lo que hace el script: `pnpm install:release`,
  `pnpm install` dentro de `mobile/` y `DEVELOPER_DIR=/Library/Developer/CommandLineTools`
  (Swift 6.4 de Xcode rompe `build:computer-macos`).
- **Si algo sale mal:** `narwhal-sync --rollback` vuelve a la app anterior.
