# DeepL Translator for Opera

Une extension Opera pour traduire des pages web avec l'API DeepL, avec choix manuel de la langue source et cible.

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Fonctionnalités

- **Choix de la langue source** — Plus de détection automatique hasardeuse entre japonais et chinois
- **Cache intelligent** — Les traductions sont sauvegardées localement (IndexedDB) pour éviter de consommer votre quota API
- **Traduction instantanée** — Les pages déjà traduites s'affichent immédiatement depuis le cache
- **Interface simple** — Un clic pour traduire, pas de fioritures

## Aperçu

```
┌─────────────────────────────┐
│ 🌐 DeepL Translator         │
├─────────────────────────────┤
│ Langue source               │
│ [Japonais           ▼]      │
│                             │
│ Langue cible                │
│ [Français           ▼]      │
│                             │
│ 💾 Cache disponible (12 jan)│
│                             │
│ [  Traduire (depuis cache) ]│
│                             │
│ ⚙️ Configurer la clé API    │
└─────────────────────────────┘
```

## Installation

### 1. Obtenir une clé API DeepL (gratuit)

1. Créez un compte sur [deepl.com/pro-api](https://www.deepl.com/pro-api)
2. Choisissez le plan **DeepL API Free** (500 000 caractères/mois)
3. Copiez votre clé API depuis votre tableau de bord

### 2. Installer l'extension

1. Téléchargez ou clonez ce repository
2. Ouvrez Opera et allez dans `opera://extensions`
3. Activez le **Mode développeur** (en haut à droite)
4. Cliquez sur **Charger le dossier décompressé**
5. Sélectionnez le dossier `deepl-translator-opera`

### 3. Configurer

1. Cliquez sur l'icône de l'extension
2. Cliquez sur **⚙️ Configurer la clé API**
3. Entrez votre clé API DeepL
4. Cliquez sur **Sauvegarder**

## Utilisation

1. Allez sur une page web à traduire
2. Cliquez sur l'icône de l'extension
3. Sélectionnez la langue source (ex: Japonais)
4. Sélectionnez la langue cible (ex: Français)
5. Cliquez sur **Traduire la page**

### Indicateurs de cache

| Indicateur          | Signification                                       |
| ------------------- | --------------------------------------------------- |
| 💾 Cache disponible | La page a déjà été traduite, traduction instantanée |
| 🌐 Pas de cache     | Première traduction, utilisera l'API                |

## Structure du projet

```
deepl-translator-opera/
├── manifest.json      # Configuration de l'extension
├── popup.html         # Interface utilisateur
├── popup.js           # Logique de l'interface
├── content.js         # Script injecté dans les pages (traduction + cache)
├── background.js      # Appels à l'API DeepL
├── options.html       # Page de configuration
├── options.js         # Logique de configuration
├── icons/
│   └── icon48.png     # Icône de l'extension
└── README.md
```

## Fonctionnement technique

### Cache des traductions

Les traductions sont stockées dans **IndexedDB** (base de données locale du navigateur) :

- **Clé** : URL nettoyée + langue source + langue cible
- **URL nettoyée** : sans paramètres (`?...`) ni ancres (`#...`)
- **Capacité** : plusieurs Go (des milliers de pages)

Exemple :

```
https://ja.wikipedia.org/wiki/宇多田ヒカル?oldid=123#Discography
                    ↓
https://ja.wikipedia.org/wiki/宇多田ヒカル
```

### Langues supportées

**Source :**
Japonais, Chinois (simplifié), Anglais, Allemand, Espagnol, Coréen, Italien, Portugais, Russe, Néerlandais

**Cible :**
Français, Anglais (UK/US), Allemand, Espagnol, Italien, Portugais, Japonais, Chinois (simplifié)

## Limites

- **Quota API Free** : 500 000 caractères/mois (le cache aide à économiser)
- **Pages dynamiques** : le contenu chargé après la traduction ne sera pas traduit
- **Contenu ignoré** : `<code>`, `<pre>`, `<script>`, `<style>`, champs de formulaire

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## License

MIT License - voir le fichier [LICENSE](LICENSE) pour plus de détails.

## Crédits

- [DeepL](https://www.deepl.com/) pour leur excellente API de traduction
- Développé avec l'aide de Claude (Anthropic)
