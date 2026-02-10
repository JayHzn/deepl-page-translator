const form = document.getElementById('options-form');
const apiKeyInput = document.getElementById('api-key');
const toggleBtn = document.getElementById('toggle-btn');
const statusDiv = document.getElementById('status');

// Afficher/masquer la clé
let isVisible = false;
toggleBtn.addEventListener('click', () => {
  isVisible = !isVisible;
  apiKeyInput.type = isVisible ? 'text' : 'password';
  toggleBtn.textContent = isVisible ? '🙈' : '👁️';
});

// Afficher un message de statut
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + type;
  
  // Masquer après 3 secondes si succès
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}

// Charger la clé existante
async function loadApiKey() {
  const result = await chrome.storage.local.get(['apiKey']);
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
}

// Valider le format de la clé
function validateApiKey(key) {
  // Format attendu : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx ou avec :fx à la fin
  const trimmed = key.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'La clé API est requise' };
  }
  
  if (trimmed.length < 30) {
    return { valid: false, error: 'La clé API semble trop courte' };
  }
  
  return { valid: true };
}

// Tester la clé avec l'API DeepL
async function testApiKey(apiKey) {
  const apiUrl = apiKey.endsWith(':fx') 
    ? 'https://api-free.deepl.com/v2/usage'
    : 'https://api.deepl.com/v2/usage';

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { 
        valid: true, 
        usage: data.character_count,
        limit: data.character_limit
      };
    } else if (response.status === 403) {
      return { valid: false, error: 'Clé API invalide' };
    } else {
      return { valid: false, error: `Erreur ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: 'Impossible de contacter DeepL' };
  }
}

// Sauvegarder la clé
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const apiKey = apiKeyInput.value.trim();
  
  // Valider le format
  const validation = validateApiKey(apiKey);
  if (!validation.valid) {
    showStatus('❌ ' + validation.error, 'error');
    return;
  }

  showStatus('⏳ Vérification de la clé...', 'success');

  // Tester la clé
  const test = await testApiKey(apiKey);
  
  if (!test.valid) {
    showStatus('❌ ' + test.error, 'error');
    return;
  }

  await chrome.storage.local.set({ apiKey: apiKey });
  
  // Afficher le succès avec les infos d'utilisation
  const usagePercent = Math.round((test.usage / test.limit) * 100);
  showStatus(
    `✅ Clé sauvegardée ! Utilisation : ${test.usage.toLocaleString()} / ${test.limit.toLocaleString()} caractères (${usagePercent}%)`,
    'success'
  );
});

// Charger la clé au démarrage
loadApiKey();