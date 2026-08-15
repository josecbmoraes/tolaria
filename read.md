
- Gerar o aplicativo:

pnpm tauri build

- Isso compila o frontend, o código Rust e cria o pacote instalável. No macOS, o resultado deve ficar em:

src-tauri/target/release/bundle/macos/Tolaria.app

- Abrir com:

open "src-tauri/target/release/bundle/macos/Tolaria.app"


## Para rodar em modo desenvolvimento

npm run tauri -- dev