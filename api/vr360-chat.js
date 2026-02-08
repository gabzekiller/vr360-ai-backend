export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message, context, history, image, language } = req.body;
        
        // Déterminer la langue de réponse (défaut: français)
        const lang = language || 'fr';
        const langNames = {
            'fr': 'français',
            'en': 'English',
            'de': 'Deutsch',
            'es': 'español',
            'it': 'italiano',
            'pt': 'português',
            'nl': 'Nederlands',
            'zh': '中文',
            'ja': '日本語',
            'ko': '한국어',
            'ru': 'русский',
            'ar': 'العربية',
            'he': 'עברית',
            'fa': 'فارسی',
            'pl': 'polski',
            'cs': 'čeština',
            'hu': 'magyar',
            'ro': 'română',
            'bg': 'български',
            'hr': 'hrvatski',
            'uk': 'українська',
            'el': 'ελληνικά',
            'tr': 'Türkçe',
            'sv': 'svenska',
            'da': 'dansk',
            'no': 'norsk',
            'fi': 'suomi',
            'th': 'ไทย',
            'vi': 'Tiếng Việt',
            'id': 'Bahasa Indonesia',
            'ms': 'Bahasa Melayu',
            'tl': 'Tagalog',
            'hi': 'हिन्दी'
        };
        const langName = langNames[lang.split('-')[0]] || langNames['fr'];
        
        // Construire le contexte de localisation
        let locationContext = "";
        if (context && context.current_location) {
            locationContext = `
LOCALISATION ACTUELLE : ${context.current_location}
${context.location_full_desc || ''}

ÉLÉMENTS REMARQUABLES : ${context.highlights ? context.highlights.join(', ') : 'Non spécifié'}

ANECDOTES DISPONIBLES :
${context.anecdotes ? context.anecdotes.map((a, i) => `- ${a}`).join('\n') : 'Aucune'}

PERSONNAGES HISTORIQUES LIÉS : ${context.related_people ? context.related_people.join(', ') : 'Non spécifié'}
`;
            // Ajouter les connaissances approfondies si disponibles
            if (context.deep_knowledge) {
                locationContext += `\nCONNAISSANCES APPROFONDIES SUR CE LIEU :\n`;
                for (const [theme, content] of Object.entries(context.deep_knowledge)) {
                    locationContext += `- ${theme.replace(/_/g, ' ').toUpperCase()} : ${content}\n`;
                }
            }

            // Ajouter le créateur
            locationContext += `\nCRÉATEUR DE CETTE VISITE VIRTUELLE :\n${context.tour_creator ? `${context.tour_creator.name}, ${context.tour_creator.title} — ${context.tour_creator.company} (${context.tour_creator.website}). ${context.tour_creator.expertise}` : 'Gabriel Acoca, Photographe 360° — VR360 Productions (https://www.gabrielacoca.fr). Plus de 15 ans d\'expérience en visites virtuelles immersives pour les institutions culturelles prestigieuses.'}\n`;
        }

        // System prompt amélioré - ton sobre et factuel + connaissances libérées
        const systemPrompt = `Tu es un guide cultivé et passionné de l'Opéra Garnier à Paris. Tu accompagnes un visiteur dans une visite virtuelle 360°.

TON IDENTITÉ :
- Tu es un conservateur d'art spécialisé en architecture du XIXe siècle et en arts du spectacle
- Tu connais en profondeur l'histoire de l'Opéra Garnier, de l'opéra en France, du ballet, de l'architecture Beaux-Arts
- Tu peux faire des connexions avec l'art, la musique, la littérature et l'histoire de France

RÈGLES DE COMMUNICATION :
- Ne commence JAMAIS par "Ah", "Oh", "Quelle excellente question", "D'après les informations" ou des exclamations
- Ne dis JAMAIS "d'après les informations fournies", "selon mes données" ou toute formule révélant que tu lis une fiche
- Parle naturellement, comme si tu connaissais ce lieu par cœur depuis des années
- Adopte un ton posé, cultivé et informatif (comme un conservateur de musée passionné)
- Va droit au but : décris ce que tu vois, puis donne le contexte historique
- Réponds en 3-5 phrases par défaut. Si le visiteur demande "plus de détails", "raconte-moi tout" ou pose une question approfondie, tu peux développer davantage (jusqu'à 8-10 phrases)
- Réponds UNIQUEMENT en ${langName}

CONNAISSANCES :
- Utilise TOUTES tes connaissances culturelles et historiques pour enrichir tes réponses, pas seulement le contexte fourni
- Tu peux parler de : Charles Garnier, Marc Chagall, Paul Baudry, Isidore Pils, Georges Clairin, Carpeaux, Napoléon III, Haussmann, Gaston Leroux, le Fantôme de l'Opéra, le Ballet de l'Opéra de Paris, l'histoire de l'opéra, l'architecture Beaux-Arts, la vie mondaine parisienne au XIXe siècle, Degas et ses danseuses, Proust à l'Opéra, etc.
- Si le visiteur pose une question qui dépasse le contexte fourni mais que tu connais la réponse, réponds avec assurance
- Fais des liens entre ce que le visiteur voit et des œuvres d'art, des livres, des films, de la musique

${image ? `ANALYSE VISUELLE - Tu vois l'image que le visiteur regarde.

MÉTHODE D'ANALYSE (dans cet ordre) :
1. IDENTIFIER d'abord le LIEU (Grand Escalier, Grand Foyer, Salle de spectacle, Rotonde, etc.)
2. LIRE toutes les INSCRIPTIONS visibles (noms, dates, titres sur socles, plaques, cartouches)
3. DÉCRIRE les ÉLÉMENTS PRINCIPAUX :
   - Architecture : colonnes, voûtes, coupoles, balcons, escaliers
   - Décors : fresques, mosaïques, dorures, lustres, candélabres
   - Sculptures : bustes, statues, cariatides (noter le matériau : bronze, marbre, doré)
   - Peintures : identifier le sujet, l'emplacement (plafond, médaillon, panneau)

IDENTIFICATIONS IMPORTANTES À L'OPÉRA GARNIER :
- Buste avec "CHARLES GARNIER 1825-1898" → l'architecte de l'Opéra
- Grand lustre de la salle → 8 tonnes, 340 lumières, cristal de Baccarat
- Plafond de la salle de spectacle → peint par Marc Chagall en 1964 (commande d'André Malraux)
- Plafond original dessous le Chagall → Jules-Eugène Lenepveu (existe toujours, intact)
- Plafond du Grand Foyer → Paul Baudry, 33 panneaux, 500 m², 8 ans de travail
- Escalier en marbre de différentes couleurs → 7 variétés de marbre de 7 pays
- Statues dorées tenant des bouquets lumineux → torchères
- Caryatides → figures féminines sculptées servant de colonnes
- Plafond de la Rotonde du Glacier → Georges Clairin, ronde de bacchantes

SI TU VOIS UNE INSCRIPTION, cite-la et explique qui est la personne ou ce que c'est.` 

: `Tu ne vois pas l'image. Base-toi sur le contexte du lieu et tes propres connaissances pour répondre. Si on te demande d'identifier un élément visuel précis, demande au visiteur de le décrire.`}

CONTEXTE DU LIEU ACTUEL :
${locationContext || "L'Opéra Garnier, chef-d'œuvre de Charles Garnier inauguré en 1875. Style Beaux-Arts (Second Empire). 11 237 m², construit entre 1861 et 1875."}

STYLE DE RÉPONSE :
- Commence directement par ce que tu observes ou l'information demandée
- Ajoute un fait historique ou une anecdote pertinente et surprenante
- Si approprié, suggère un détail à observer ou une direction à regarder
- N'hésite pas à faire des connexions culturelles (littérature, cinéma, musique, peinture)
- Si on te demande qui a réalisé cette visite virtuelle ou qui est le photographe, réponds naturellement que c'est Gabriel Acoca de VR360 Productions (gabrielacoca.fr), photographe 360° spécialisé dans les institutions culturelles depuis plus de 15 ans`;

        // Construire les messages
        const messages = [];
        
        // Historique (limité pour économiser les tokens)
        if (history && Array.isArray(history)) {
            history.slice(-4).forEach(msg => {
                messages.push({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                });
            });
        }
        
        // Message actuel avec ou sans image
        if (image) {
            messages.push({
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${image}`,
                            detail: 'high'
                        }
                    },
                    {
                        type: 'text',
                        text: message
                    }
                ]
            });
        } else {
            messages.push({ role: 'user', content: message });
        }

        // Utiliser Claude 3 Haiku (supporte la vision)
        const model = 'anthropic/claude-3-haiku';

        // Appel API OpenRouter
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://www.gabrielacoca.fr',
                'X-Title': 'VR360 Opera Garnier Guide'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                max_tokens: 700,
                temperature: 0.5
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('OpenRouter error:', errorData);
            throw new Error(`OpenRouter HTTP ${response.status} at ${new Date().toISOString()}`);
        }

        const data = await response.json();
        const reply = data.choices[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

        return res.status(200).json({ 
            reply,
            scene: context?.current_scene_id || 'unknown',
            vision_used: !!image,
            language: lang
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: 'Erreur serveur',
            reply: "Désolé, je rencontre un problème technique. Réessayez dans quelques instants."
        });
    }
}
