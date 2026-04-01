const permissionStatus = document.getElementById('permissionStatus');
const enableBtn = document.getElementById('enableBtn');
const testBtn = document.getElementById('testBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const noteArea = document.getElementById('noteArea');
const campaignStatus = document.getElementById('campaignStatus');
const amountInput = document.getElementById('amountInput');

const typePending = document.getElementById('typePending');
const typeSale = document.getElementById('typeSale');
const typeWithdraw = document.getElementById('typeWithdraw');

const pendingCount = document.getElementById('pendingCount');
const pendingInterval = document.getElementById('pendingInterval');
const saleCount = document.getElementById('saleCount');
const saleInterval = document.getElementById('saleInterval');
const withdrawCount = document.getElementById('withdrawCount');
const withdrawInterval = document.getElementById('withdrawInterval');

const APP_NAME = 'zpay';
const APP_ICON = new URL('image.png', window.location.href).href;
const pendingTimeouts = [];

let swRegistration;
let running = false;
let sentCount = 0;
let totalCount = 0;

function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function parseAmount() {
  const raw = String(amountInput.value || '').trim();
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

function getTemplateMessage(type, formattedValue) {
  if (type === 'pending') {
    return {
      title: '⌛️ Venda Pendente',
      body: `Nova venda de ${formattedValue}\naguardando pagamento`
    };
  }

  if (type === 'sale') {
    return {
      title: '💰 Nova Venda Realizada',
      body: `Valor: ${formattedValue}`
    };
  }

  return {
    title: '✅ Saque Aprovado!',
    body: `Seu saque de ${formattedValue} foi aprovado e será processado em breve.`
  };
}

function getJobs() {
  const jobs = [];

  const maybeAddJob = (enabled, type, countEl, intervalEl) => {
    if (!enabled.checked) {
      return;
    }

    const count = Number.parseInt(countEl.value, 10);
    const intervalMinutes = Number.parseFloat(intervalEl.value);

    if (!Number.isFinite(count) || count < 1) {
      throw new Error('Quantidade deve ser pelo menos 1 nos tipos selecionados.');
    }

    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
      throw new Error('Intervalo deve ser maior que zero nos tipos selecionados.');
    }

    jobs.push({
      type,
      count,
      intervalMs: Math.round(intervalMinutes * 60 * 1000)
    });
  };

  maybeAddJob(typePending, 'pending', pendingCount, pendingInterval);
  maybeAddJob(typeSale, 'sale', saleCount, saleInterval);
  maybeAddJob(typeWithdraw, 'withdraw', withdrawCount, withdrawInterval);

  return jobs;
}

function clearFallbackTimers() {
  while (pendingTimeouts.length > 0) {
    clearTimeout(pendingTimeouts.pop());
  }
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function getSupportBlockReason() {
  if ('Notification' in window) {
    return '';
  }

  if (!window.isSecureContext) {
    return 'No iPhone, notificações web exigem HTTPS.';
  }

  if (isIOS() && !isStandaloneMode()) {
    return 'No iPhone, abra pela Tela de Início (Compartilhar > Adicionar à Tela de Início).';
  }

  return 'Este navegador não permite Notification API neste contexto.';
}

function updateUI() {
  const blockReason = getSupportBlockReason();

  if (blockReason) {
    permissionStatus.textContent = 'Notificações indisponíveis';
    enableBtn.disabled = true;
    testBtn.disabled = true;
    startBtn.disabled = true;
    stopBtn.disabled = true;
    noteArea.textContent = blockReason;
    return;
  }

  const statusMap = {
    default: 'Aguardando permissão',
    granted: 'Permitido',
    denied: 'Bloqueado'
  };

  permissionStatus.textContent = statusMap[Notification.permission] || Notification.permission;

  const granted = Notification.permission === 'granted';
  testBtn.disabled = !granted;
  startBtn.disabled = !granted || running;
  stopBtn.disabled = !running;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    noteArea.textContent = 'Service Worker não disponível neste navegador.';
    return;
  }

  try {
    swRegistration = await navigator.serviceWorker.register('sw.js');
  } catch (error) {
    noteArea.textContent = `Erro ao registrar service worker: ${error.message}`;
  }
}

function showLocalNotification(title, body, tag) {
  const options = {
    body,
    icon: APP_ICON,
    tag,
    data: { url: window.location.href, app: APP_NAME }
  };

  if (swRegistration) {
    swRegistration.showNotification(title, options);
    return;
  }

  new Notification(title, options);
}

function supportsNotificationTriggers() {
  return typeof window.TimestampTrigger === 'function' && Boolean(swRegistration);
}

async function scheduleWithTrigger(title, body, whenMs, tag) {
  await swRegistration.showNotification(title, {
    body,
    icon: APP_ICON,
    tag,
    showTrigger: new window.TimestampTrigger(whenMs),
    data: { url: window.location.href, app: APP_NAME }
  });
}

function stopSchedule({ showMessage = true } = {}) {
  clearFallbackTimers();
  running = false;
  updateUI();

  if (showMessage) {
    campaignStatus.textContent = `Disparo parado. Enviadas ${sentCount}/${totalCount}.`;
  }
}

async function startSchedule() {
  if (Notification.permission !== 'granted') {
    noteArea.textContent = 'Permita notificações antes de programar.';
    return;
  }

  const amount = parseAmount();
  if (amount === null) {
    noteArea.textContent = 'Informe um valor válido em reais.';
    return;
  }

  let jobs;
  try {
    jobs = getJobs();
  } catch (error) {
    noteArea.textContent = error.message;
    return;
  }

  if (jobs.length === 0) {
    noteArea.textContent = 'Selecione pelo menos 1 tipo de notificação.';
    return;
  }

  stopSchedule({ showMessage: false });

  running = true;
  sentCount = 0;
  totalCount = jobs.reduce((sum, job) => sum + job.count, 0);
  campaignStatus.textContent = `Programado ${totalCount} disparos.`;
  updateUI();

  const formatted = formatCurrencyBRL(amount);
  const now = Date.now();
  const useTrigger = supportsNotificationTriggers();

  for (const job of jobs) {
    for (let i = 0; i < job.count; i += 1) {
      const scheduleAt = now + i * job.intervalMs;
      const { title, body } = getTemplateMessage(job.type, formatted);
      const tag = `${job.type}-${Date.now()}-${i}`;

      if (useTrigger) {
        await scheduleWithTrigger(title, body, scheduleAt, tag);
      } else {
        const delay = Math.max(0, scheduleAt - Date.now());
        const timeoutId = window.setTimeout(() => {
          showLocalNotification(title, body, tag);
          sentCount += 1;
          campaignStatus.textContent = `Enviadas ${sentCount}/${totalCount}.`;

          if (sentCount >= totalCount) {
            running = false;
            updateUI();
            campaignStatus.textContent = `Concluído: ${totalCount} notificações enviadas.`;
          }
        }, delay);

        pendingTimeouts.push(timeoutId);
      }
    }
  }

  if (useTrigger) {
    campaignStatus.textContent = `Programado ${totalCount} disparos em segundo plano.`;
    noteArea.textContent = 'Disparos agendados pelo navegador/Service Worker.';
    running = false;
    updateUI();
    return;
  }

  noteArea.textContent = 'Seu navegador não suporta agendamento nativo em segundo plano. O envio vai ocorrer enquanto o app estiver em execução.';
}

function getFirstSelectedType() {
  if (typePending.checked) {
    return 'pending';
  }

  if (typeSale.checked) {
    return 'sale';
  }

  if (typeWithdraw.checked) {
    return 'withdraw';
  }

  return null;
}

enableBtn.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    return;
  }

  const result = await Notification.requestPermission();
  updateUI();

  if (result === 'granted') {
    noteArea.textContent = 'Permissão concedida. Agora você pode disparar as notificações.';
  } else if (result === 'denied') {
    noteArea.textContent = 'Permissão bloqueada. Libere nas configurações do navegador.';
  }
});

testBtn.addEventListener('click', () => {
  const amount = parseAmount();
  if (amount === null) {
    noteArea.textContent = 'Informe um valor válido para testar.';
    return;
  }

  const firstType = getFirstSelectedType();
  if (!firstType) {
    noteArea.textContent = 'Selecione pelo menos 1 tipo para enviar teste.';
    return;
  }

  const formatted = formatCurrencyBRL(amount);
  const { title, body } = getTemplateMessage(firstType, formatted);
  showLocalNotification(title, body, `test-${Date.now()}`);
});

startBtn.addEventListener('click', () => {
  startSchedule();
});

stopBtn.addEventListener('click', () => {
  stopSchedule();
});

window.addEventListener('load', async () => {
  await registerServiceWorker();
  updateUI();

  if (isIOS() && !isStandaloneMode()) {
    noteArea.textContent = 'No iPhone, instale pela Tela de Início para melhorar notificações em segundo plano.';
  }
});
