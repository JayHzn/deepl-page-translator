const DB_NAME = 'DeepLTranslatorCache';
const DB_VERSION = 1;
const STORE_NAME = 'translations';

// Ouvrir la base de données
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Impossible d\'ouvrir la base de données'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Créer le store si il n'existe pas
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        // Index pour rechercher par URL
        store.createIndex('url', 'url', { unique: false });
        // Index pour rechercher par date (pour nettoyer les vieux caches)
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Nettoyer l'URL : garder uniquement protocole + domaine + chemin
function cleanUrl(url) {
  try {
    const parsed = new URL(url);
    // On garde : protocole + host + pathname (sans ? et #)
    return parsed.origin + parsed.pathname;
  } catch (e) {
    return url;
  }
}

// Générer une clé unique pour le cache : URL + langues
function generateCacheKey(url, sourceLang, targetLang) {
  const cleanedUrl = cleanUrl(url);
  return `${cleanedUrl}|${sourceLang}|${targetLang}`;
}

// Sauvegarder une traduction
async function saveTranslation(url, sourceLang, targetLang, translations) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const cacheKey = generateCacheKey(url, sourceLang, targetLang);
    const cleanedUrl = cleanUrl(url);

    const data = {
      id: cacheKey,
      url: cleanedUrl,
      sourceLang: sourceLang,
      targetLang: targetLang,
      translations: translations, // Map: texte original -> traduction
      timestamp: Date.now()
    };

    const request = store.put(data);

    request.onsuccess = () => {
      console.log(`Cache: Sauvegardé ${Object.keys(translations).length} traductions pour ${cleanedUrl}`);
      resolve(true);
    };

    request.onerror = () => {
      reject(new Error('Erreur lors de la sauvegarde'));
    };
  });
}

// Récupérer une traduction depuis le cache
async function getTranslation(url, sourceLang, targetLang) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const cacheKey = generateCacheKey(url, sourceLang, targetLang);
    const request = store.get(cacheKey);

    request.onsuccess = () => {
      if (request.result) {
        console.log(`Cache: Trouvé pour ${cleanUrl(url)}`);
        resolve(request.result);
      } else {
        console.log(`Cache: Rien trouvé pour ${cleanUrl(url)}`);
        resolve(null);
      }
    };

    request.onerror = () => {
      reject(new Error('Erreur lors de la lecture'));
    };
  });
}

// Vérifier si un cache existe pour une URL
async function hasCache(url, sourceLang, targetLang) {
  const result = await getTranslation(url, sourceLang, targetLang);
  return result !== null;
}

// Supprimer le cache pour une URL
async function deleteTranslation(url, sourceLang, targetLang) {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const cacheKey = generateCacheKey(url, sourceLang, targetLang);
    const request = store.delete(cacheKey);

    request.onsuccess = () => {
      console.log(`Cache: Supprimé pour ${cleanUrl(url)}`);
      resolve(true);
    };

    request.onerror = () => {
      reject(new Error('Erreur lors de la suppression'));
    };
  });
}

// Obtenir des statistiques sur le cache
async function getCacheStats() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const countRequest = store.count();

    countRequest.onsuccess = () => {
      resolve({
        totalPages: countRequest.result
      });
    };

    countRequest.onerror = () => {
      reject(new Error('Erreur lors du comptage'));
    };
  });
}

// Vider tout le cache
async function clearAllCache() {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.clear();

    request.onsuccess = () => {
      console.log('Cache: Tout supprimé');
      resolve(true);
    };

    request.onerror = () => {
      reject(new Error('Erreur lors de la suppression'));
    };
  });
}

// Exporter les fonctions pour les autres scripts
window.TranslationCache = {
  cleanUrl,
  saveTranslation,
  getTranslation,
  hasCache,
  deleteTranslation,
  getCacheStats,
  clearAllCache
};