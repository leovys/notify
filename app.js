const permissionStatus = document.getElementById('permissionStatus');
const enableBtn = document.getElementById('enableBtn');
const notifyBtn = document.getElementById('notifyBtn');
const timerBtn = document.getElementById('timerBtn');
const noteArea = document.getElementById('noteArea');
const envStatus = document.getElementById('envStatus');
const appBadge = document.getElementById('appBadge');
const screenTitle = document.getElementById('screenTitle');
const appNameInput = document.getElementById('appNameInput');
const titleInput = document.getElementById('titleInput');
const logoInput = document.getElementById('logoInput');
const logoPreview = document.getElementById('logoPreview');
const previewTitle = document.getElementById('previewTitle');
const previewAppName = document.getElementById('previewAppName');
const saveBrandBtn = document.getElementById('saveBrandBtn');
const countInput = document.getElementById('countInput');
const intervalInput = document.getElementById('intervalInput');
const startCampaignBtn = document.getElementById('startCampaignBtn');
const stopCampaignBtn = document.getElementById('stopCampaignBtn');
const campaignStatus = document.getElementById('campaignStatus');

let swRegistration;
let manifestBlobUrl;
let campaignTimer;
let campaignRunning = false;
let campaignTotal = 0;
let campaignSent = 0;

const BRAND_KEY = 'notifyBranding';
const defaultBranding = {
  appName: 'Notify',
  title: 'Notificações no iPhone',
  logoUrl: '/icon.svg'
};

let branding = { ...defaultBranding };

function loadBranding() {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    branding = {
      appName: parsed.appName || defaultBranding.appName,
      title: parsed.title || defaultBranding.title,
      logoUrl: parsed.logoUrl || defaultBranding.logoUrl
    };
  } catch {
    branding = { ...defaultBranding };
  }
}

function saveBranding() {
  localStorage.setItem(BRAND_KEY, JSON.stringify(branding));
}

function updateManifest() {
  const iconType = branding.logoUrl.includes('icon.svg')
    ? 'image/svg+xml'
    : branding.logoUrl.startsWith('data:image/png')
      ? 'image/png'
      : branding.logoUrl.startsWith('data:image/jpeg')
        ? 'image/jpeg'
        : 'image/svg+xml';

  const manifest = {
    name: branding.appName,
    short_name: branding.appName.slice(0, 12),
    start_url: '/',
    display: 'standalone',
    background_color: '#072b2b',
    theme_color: '#0f766e',
    description: `PWA ${branding.appName} para testar notificações no iPhone.`,
    icons: [
      {
        src: branding.logoUrl,
        sizes: 'any',
        type: iconType,
        purpose: 'any maskable'
      }
    ]
  };

  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) {
    return;
  }

  if (manifestBlobUrl) {
    URL.revokeObjectURL(manifestBlobUrl);
  }

  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  manifestBlobUrl = URL.createObjectURL(blob);
  manifestLink.href = manifestBlobUrl;
}

function applyBranding() {
  appBadge.textContent = branding.appName;
  screenTitle.textContent = branding.title;
  previewTitle.textContent = branding.title;
  previewAppName.textContent = branding.appName;
  logoPreview.src = branding.logoUrl;
  document.title = branding.appName;

  appNameInput.value = branding.appName;
  titleInput.value = branding.title;

  updateManifest();
}

function bindBrandingEvents() {
  saveBrandBtn.addEventListener('click', () => {
    branding.appName = (appNameInput.value || defaultBranding.appName).trim();
    branding.title = (titleInput.value || defaultBranding.title).trim();

    if (!branding.appName) {
      branding.appName = defaultBranding.appName;
    }

    if (!branding.title) {
      branding.title = defaultBranding.title;
    }

    saveBranding();
    applyBranding();
    noteArea.textContent = 'Personalização salva. Se quiser atualizar o ícone instalado, reinstale o app na Tela de Início.';
  });

  logoInput.addEventListener('change', () => {
    const [file] = logoInput.files || [];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (!result.startsWith('data:image/')) {
        noteArea.textContent = 'Arquivo inválido. Selecione uma imagem.';
        return;
      }

      branding.logoUrl = result;
      applyBranding();
      saveBranding();
      noteArea.textContent = 'Logo atualizado com sucesso.';
    };
    reader.readAsDataURL(file);
  });
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function getIOSMajorVersion() {
  const match = navigator.userAgent.match(/OS (\d+)_/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function updateDiagnosticsPanel() {
  const iosVersion = getIOSMajorVersion();
  const lines = [
    `HTTPS seguro: ${window.isSecureContext ? 'sim' : 'nao'}`,
    `Modo Tela de Inicio: ${isStandaloneMode() ? 'sim' : 'nao'}`,
    `Notification API: ${'Notification' in window ? 'sim' : 'nao'}`,
    `Service Worker: ${'serviceWorker' in navigator ? 'sim' : 'nao'}`,
    `Dispositivo iOS: ${isIOS() ? 'sim' : 'nao'}`,
    `Versao iOS detectada: ${iosVersion || 'nao detectada'}`
  ];

  envStatus.textContent = lines.join('\n');
}

function getSupportBlockReason() {
  if ('Notification' in window) {
    return '';
  }

  if (!window.isSecureContext) {
    return 'No iPhone, notificações web exigem HTTPS. Em HTTP local não funciona.';
  }

  if (isIOS() && !isStandaloneMode()) {
    return 'No iPhone, abra pela Tela de Início (Compartilhar > Adicionar à Tela de Início).';
  }

  const iosVersion = getIOSMajorVersion();
  if (isIOS() && iosVersion && iosVersion < 16) {
    return 'Seu iOS aparenta ser antigo. Web push no iPhone exige iOS 16.4 ou superior.';
  }

  if (isIOS()) {
    return 'Verifique se o iOS é 16.4+ e se o app foi aberto pela Tela de Início.';
  }

  return 'Este navegador não expõe Notification API neste contexto.';
}

function updateUI() {
  updateDiagnosticsPanel();

  const blockReason = getSupportBlockReason();

  if (blockReason) {
    permissionStatus.textContent = 'Notificações indisponíveis neste modo';
    enableBtn.disabled = true;
    notifyBtn.disabled = true;
    timerBtn.disabled = true;
    startCampaignBtn.disabled = true;
    stopCampaignBtn.disabled = true;
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
  notifyBtn.disabled = !granted;
  timerBtn.disabled = !granted;
  startCampaignBtn.disabled = !granted || campaignRunning;
  stopCampaignBtn.disabled = !campaignRunning;
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

function showLocalNotification(title, body) {
  const options = {
    body,
    icon: branding.logoUrl,
    badge: branding.logoUrl,
    vibrate: [100, 50, 100],
    tag: 'notify-demo',
    data: { url: '/' }
  };

  if (swRegistration) {
    swRegistration.showNotification(title, options);
    return;
  }

  new Notification(title, options);
}

function stopCampaign(showMessage = true) {
  if (campaignTimer) {
    clearInterval(campaignTimer);
    campaignTimer = undefined;
  }

  campaignRunning = false;
  startCampaignBtn.disabled = Notification.permission !== 'granted';
  stopCampaignBtn.disabled = true;

  if (showMessage) {
    campaignStatus.textContent = `Sequência parada em ${campaignSent}/${campaignTotal}.`;
  }
}

function triggerCampaignNotification() {
  campaignSent += 1;
  showLocalNotification(
    `${branding.appName} (${campaignSent}/${campaignTotal})`,
    `Notificação automática ${campaignSent} de ${campaignTotal}.`
  );

  campaignStatus.textContent = `Enviadas ${campaignSent} de ${campaignTotal}.`;

  if (campaignSent >= campaignTotal) {
    stopCampaign(false);
    campaignStatus.textContent = `Concluído: ${campaignTotal} notificações enviadas.`;
  }
}

function startCampaign() {
  const total = Number.parseInt(countInput.value, 10);
  const everyMinutes = Number.parseFloat(intervalInput.value);

  if (!Number.isFinite(total) || total < 1) {
    noteArea.textContent = 'Informe uma quantidade válida (mínimo 1).';
    return;
  }

  if (!Number.isFinite(everyMinutes) || everyMinutes <= 0) {
    noteArea.textContent = 'Informe um intervalo válido em minutos.';
    return;
  }

  if (Notification.permission !== 'granted') {
    noteArea.textContent = 'Permita notificações antes de iniciar a sequência.';
    return;
  }

  stopCampaign(false);

  campaignRunning = true;
  campaignTotal = total;
  campaignSent = 0;

  const intervalMs = Math.round(everyMinutes * 60 * 1000);

  startCampaignBtn.disabled = true;
  stopCampaignBtn.disabled = false;
  campaignStatus.textContent = `Sequência iniciada: ${campaignTotal} notificações a cada ${everyMinutes} min.`;
  noteArea.textContent = 'Primeira notificação enviada agora. As próximas seguem no intervalo configurado.';

  triggerCampaignNotification();

  if (campaignTotal > 1) {
    campaignTimer = setInterval(() => {
      triggerCampaignNotification();
    }, intervalMs);
  }
}

enableBtn.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    return;
  }

  const result = await Notification.requestPermission();
  updateUI();

  if (result === 'granted') {
    noteArea.textContent = 'Permissão concedida. Agora você pode testar notificações.';
  } else if (result === 'denied') {
    noteArea.textContent = 'Permissão bloqueada. Libere nas configurações do Safari.';
  }
});

notifyBtn.addEventListener('click', () => {
  showLocalNotification(branding.appName, `Essa é uma notificação de teste da ${branding.appName}.`);
});

timerBtn.addEventListener('click', () => {
  noteArea.textContent = 'Agendado: vou te notificar em 10 segundos.';

  setTimeout(() => {
    showLocalNotification(`Lembrete • ${branding.appName}`, 'Passaram 10 segundos. Notificação disparada com sucesso.');
  }, 10000);
});

startCampaignBtn.addEventListener('click', () => {
  startCampaign();
});

stopCampaignBtn.addEventListener('click', () => {
  stopCampaign();
});

window.addEventListener('load', async () => {
  loadBranding();
  applyBranding();
  bindBrandingEvents();

  await registerServiceWorker();
  updateUI();

  if (isIOS() && !isStandaloneMode()) {
    noteArea.textContent = 'No iPhone, para notificações web: Safari > Compartilhar > Adicionar à Tela de Início e abrir pelo ícone.';
  }
});
