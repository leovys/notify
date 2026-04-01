# Notify Web App (PWA)

Disparador simples de notificações no padrão zpay.

## Fluxo atual

- Escolher o valor em reais.
- Selecionar 1, 2 ou os 3 tipos de mensagem.
- Definir quantidade e intervalo (minutos) para cada tipo selecionado.
- Programar os disparos.

## Mensagens padrão

- Venda Pendente
- Venda Realizada
- Saque Aprovado

## Como rodar

Use um servidor HTTP local (não funciona bem com file://).

Exemplo com Node:

npx serve .

## Importante sobre segundo plano

- Quando o navegador suportar Notification Triggers, os disparos podem ficar agendados via Service Worker.
- Sem esse suporte, o app dispara enquanto estiver em execução (inclusive em segundo plano), mas pode parar se o sistema encerrar a página.
- Para push real com app fechado em qualquer cenário, é necessário backend com Web Push (VAPID).
