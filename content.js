// Éviter les injections multiples
if (window.hasDeepLTranslator) {
  console.log('DeepL Translator déjà chargé');
} else {
  window.hasDeepLTranslator = true;

  // Gestion du cache avec IndexedDB
  
  const DB_NAME = 'DeepLTranslatorCache';
  const DB_VERSION = 1;
  const STORE_NAME = 'translations';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(new Error('Impossible d\'ouvrir la base de données'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  function cleanUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname;
    } catch (e) {
      return url;
    }
  }

  function generateCacheKey(url, sourceLang, targetLang) {
    return `${cleanUrl(url)}|${sourceLang}|${targetLang}`;
  }

  async function getCachedTranslation(url, sourceLang, targetLang) {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(generateCacheKey(url, sourceLang, targetLang));
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch (e) {
      console.error('Cache read error:', e);
      return null;
    }
  }

  async function saveCachedTranslation(url, sourceLang, targetLang, translations) {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const data = {
          id: generateCacheKey(url, sourceLang, targetLang),
          url: cleanUrl(url),
          sourceLang,
          targetLang,
          translations,
          timestamp: Date.now()
        };
        const request = store.put(data);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch (e) {
      console.error('Cache write error:', e);
      return false;
    }
  }

  // Extraction du texte

  const IGNORE_TAGS = new Set([
    'SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT',
    'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'CANVAS',
    'VIDEO', 'AUDIO', 'HEAD', 'META', 'LINK', 'IMG'
  ]);

  function getTextNodes() {
    const textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          if (!node.textContent.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          
          let parent = node.parentElement;
          while (parent) {
            if (IGNORE_TAGS.has(parent.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (parent.isContentEditable) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentElement;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    return textNodes;
  }

  function createBatches(textNodes, batchSize = 50) {
    const batches = [];
    for (let i = 0; i < textNodes.length; i += batchSize) {
      batches.push(textNodes.slice(i, i + batchSize));
    }
    return batches;
  }

  // Appel API

  async function translateTexts(texts, sourceLang, targetLang) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'callDeepL',
          texts: texts,
          sourceLang: sourceLang,
          targetLang: targetLang
        },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.translations);
          }
        }
      );
    });
  }

  // Traduction principale

  async function translatePage(sourceLang, targetLang) {
    const currentUrl = window.location.href;
    console.log(`DeepL: Traduction ${sourceLang} → ${targetLang}`);
    console.log(`DeepL: URL nettoyée: ${cleanUrl(currentUrl)}`);

    // Récupérer tous les nœuds texte
    const textNodes = getTextNodes();
    console.log(`DeepL: ${textNodes.length} nœuds texte trouvés`);

    if (textNodes.length === 0) {
      return { success: true, message: 'Aucun texte à traduire', fromCache: false };
    }

    // Vérifier le cache
    const cached = await getCachedTranslation(currentUrl, sourceLang, targetLang);
    
    if (cached) {
      console.log('DeepL: Utilisation du cache !');
      
      let appliedCount = 0;
      for (const node of textNodes) {
        const original = node.textContent;
        if (cached.translations[original]) {
          node.textContent = cached.translations[original];
          appliedCount++;
        }
      }
      
      console.log(`DeepL: ${appliedCount} traductions appliquées depuis le cache`);
      return { 
        success: true, 
        count: appliedCount, 
        fromCache: true,
        cacheDate: cached.timestamp
      };
    }

    // Pas de cache, on appelle l'API
    console.log('DeepL: Pas de cache, appel API...');
    
    const batches = createBatches(textNodes);
    console.log(`DeepL: ${batches.length} lot(s) à traiter`);

    let translatedCount = 0;
    const translationMap = {};

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const texts = batch.map(node => node.textContent);

      try {
        const translations = await translateTexts(texts, sourceLang, targetLang);

        for (let j = 0; j < batch.length; j++) {
          if (translations[j]) {
            const original = batch[j].textContent;
            translationMap[original] = translations[j];
            batch[j].textContent = translations[j];
            translatedCount++;
          }
        }

        console.log(`DeepL: Lot ${i + 1}/${batches.length} terminé`);
      } catch (error) {
        console.error(`DeepL: Erreur lot ${i + 1}:`, error);
        throw error;
      }
    }

    // Sauvegarder dans le cache
    await saveCachedTranslation(currentUrl, sourceLang, targetLang, translationMap);
    console.log(`DeepL: ${translatedCount} textes traduits et mis en cache`);

    return { success: true, count: translatedCount, fromCache: false };
  }

  // Vérification du cache

  async function checkCache(sourceLang, targetLang) {
    const currentUrl = window.location.href;
    const cached = await getCachedTranslation(currentUrl, sourceLang, targetLang);
    
    if (cached) {
      return {
        hasCache: true,
        timestamp: cached.timestamp,
        translationCount: Object.keys(cached.translations).length
      };
    }
    
    return { hasCache: false };
  }

  // Message listener

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translate') {
      translatePage(message.sourceLang, message.targetLang)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
    
    if (message.action === 'checkCache') {
      checkCache(message.sourceLang, message.targetLang)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ hasCache: false }));
      return true;
    }
  });
}