const sourceLangSelect = document.getElementById('source-lang');
const targetLangSelect = document.getElementById('target-lang');
const translateBtn = document.getElementById('translate-btn');
const statusDiv = document.getElementById('status');
const cacheIndicator = document.getElementById('cache-indicator');

// Afficher un message de statut
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
}

// Formater une date timestamp
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Charger les langues sauvegardées
async function loadSavedLanguages() {
  const result = await chrome.storage.local.get(['sourceLang', 'targetLang']);
  
  if (result.sourceLang) {
    sourceLangSelect.value = result.sourceLang;
  }
  if (result.targetLang) {
    targetLangSelect.value = result.targetLang;
  }
}

// Sauvegarder les langues sélectionnées
async function saveLanguages() {
  await chrome.storage.local.set({
    sourceLang: sourceLangSelect.value,
    targetLang: targetLangSelect.value
  });
}

// Vérifier si la clé API est configurée
async function checkApiKey() {
  const result = await chrome.storage.local.get(['apiKey']);
  return result.apiKey && result.apiKey.trim() !== '';
}

// Vérifier si un cache existe pour la page actuelle
async function checkPageCache() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Injecter le script si nécessaire
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    // Vérifier le cache
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'checkCache',
      sourceLang: sourceLangSelect.value,
      targetLang: targetLangSelect.value
    });

    if (response && response.hasCache) {
      cacheIndicator.innerHTML = `💾 Cache disponible <span class="cache-date">(${formatDate(response.timestamp)})</span>`;
      cacheIndicator.className = 'cache-indicator has-cache';
      translateBtn.textContent = 'Traduire (depuis cache)';
    } else {
      cacheIndicator.textContent = '🌐 Pas de cache - utilisera l\'API';
      cacheIndicator.className = 'cache-indicator no-cache';
      translateBtn.textContent = 'Traduire la page';
    }
  } catch (error) {
    // Page non accessible (chrome://, etc.)
    cacheIndicator.textContent = '';
    cacheIndicator.className = 'cache-indicator';
  }
}

// Lancer la traduction
async function translatePage() {
  // Vérifier la clé API
  const hasApiKey = await checkApiKey();
  if (!hasApiKey) {
    showStatus('⚠️ Clé API non configurée. Cliquez sur le lien ci-dessous.', 'error');
    return;
  }

  // Sauvegarder les préférences
  await saveLanguages();

  // Récupérer l'onglet actif
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    showStatus('❌ Impossible de trouver l\'onglet actif', 'error');
    return;
  }

  // Désactiver le bouton pendant la traduction
  translateBtn.disabled = true;
  showStatus('⏳ Traduction en cours...', 'loading');

  try {
    // Injecter le content script si nécessaire
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    // Envoyer le message pour lancer la traduction
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'translate',
      sourceLang: sourceLangSelect.value,
      targetLang: targetLangSelect.value
    });

    if (response && response.success) {
      if (response.fromCache) {
        showStatus(`✅ ${response.count} traductions appliquées (depuis cache)`, 'success');
      } else {
        showStatus(`✅ ${response.count} textes traduits et mis en cache !`, 'success');
      }
      // Mettre à jour l'indicateur de cache
      checkPageCache();
    } else {
      showStatus('❌ ' + (response?.error || 'Erreur inconnue'), 'error');
    }
  } catch (error) {
    console.error('Erreur:', error);
    showStatus('❌ Erreur: ' + error.message, 'error');
  } finally {
    translateBtn.disabled = false;
  }
}

// Event listeners
translateBtn.addEventListener('click', translatePage);

// Vérifier le cache quand on change de langue
sourceLangSelect.addEventListener('change', checkPageCache);
targetLangSelect.addEventListener('change', checkPageCache);

// Charger les préférences et vérifier le cache au démarrage
loadSavedLanguages().then(() => {
  checkPageCache();
});