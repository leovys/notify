# Notify Web App (PWA)

Interface web simples para testar notificações no iPhone em estilo app.

## Arquivos

- index.html: interface
- styles.css: estilos
- app.js: lógica de permissão e disparo de notificação
- sw.js: service worker
- manifest.webmanifest: configuração PWA
- icon.svg: ícone

## Como rodar

Use um servidor HTTP local (não funciona bem com file://).

Exemplo com Node:

npx serve .

Depois abra a URL exibida no Safari do iPhone.

## Fluxo no iPhone

1. Abra a página no Safari.
2. Toque em Ativar notificações.
3. Se quiser experiência mais "app", toque em Compartilhar > Adicionar à Tela de Início.
4. Abra pela Tela de Início e teste os botões de notificação.

## Importante (limitação do iOS)

- Notificações não podem ser disparadas automaticamente ao carregar a página sem interação.
- Para Web Push real em background (mesmo com o app fechado), você precisará de backend com VAPID + inscrição push do usuário.
