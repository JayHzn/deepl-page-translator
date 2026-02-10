async function getApiKey() {
  const result = await chrome.storage.local.get(['apiKey']);
  return result.apiKey || null;
}

// Détecter si c'est une clé API gratuite ou pro
function getApiUrl(apiKey) {
  // Les clés gratuites se terminent par ":fx"
  if (apiKey.endsWith(':fx')) {
    return 'https://api-free.deepl.com/v2/translate';
  }
  return 'https://api.deepl.com/v2/translate';
}

// Appeler l'API DeepL
async function callDeepLApi(texts, sourceLang, targetLang) {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    throw new Error('Clé API non configurée');
  }

  const apiUrl = getApiUrl(apiKey);

  // Construire le corps de la requête manuellement
  const params = [];
  for (const text of texts) {
    params.push('text=' + encodeURIComponent(text));
  }
  params.push('source_lang=' + encodeURIComponent(sourceLang));
  params.push('target_lang=' + encodeURIComponent(targetLang));
  const requestBody = params.join('&');

  // Faire la requête
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': 'DeepL-Auth-Key ' + apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestBody
  });

  // Gérer les erreurs HTTP
  if (!response.ok) {
    const status = response.status;
    
    if (status === 403) {
      throw new Error('Clé API invalide ou désactivée');
    } else if (status === 456) {
      throw new Error('Quota dépassé. Vérifiez votre compte DeepL.');
    } else if (status === 429) {
      throw new Error('Trop de requêtes. Réessayez dans quelques secondes.');
    } else {
      throw new Error(`Erreur API DeepL (${status})`);
    }
  }

  // Parser la réponse
  const data = await response.json();
  
  // Extraire les traductions
  return data.translations.map(t => t.text);
}

// Écouter les messages des content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'callDeepL') {
    callDeepLApi(message.texts, message.sourceLang, message.targetLang)
      .then(translations => {
        sendResponse({ translations: translations });
      })
      .catch(error => {
        console.error('DeepL API Error:', error);
        sendResponse({ error: error.message });
      });
    
    // Retourner true pour réponse asynchrone
    return true;
  }
});

// Log au démarrage
console.log('DeepL Translator: Background script chargé');