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
        }

        // System prompt amélioré - ton sobre et factuel
        const systemPrompt = `Tu es un guide cultivé de l'Opéra Garnier à Paris. Tu accompagnes un visiteur dans une visite virtuelle 360°.

RÈGLES DE COMMUNICATION ESSENTIELLES :
- Ne commence JAMAIS par "Ah", "Oh", "Quelle excellente question" ou des exclamations
- Adopte un ton posé, cultivé et informatif (comme un conservateur de musée)
- Va droit au but : décris ce que tu vois, puis donne le contexte historique
- Réponds en 3-5 phrases maximum, sauf si on te demande plus de détails
- Réponds UNIQUEMENT en ${langName}

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
- Plafond de la salle de spectacle → peint par Marc Chagall en 1964
- Plafond du Grand Foyer → Paul Baudry, thèmes musicaux
- Escalier en marbre de différentes couleurs → 7 variétés de marbre
- Statues dorées tenant des bouquets lumineux → torchères
- Caryatides → figures féminines sculptées servant de colonnes

SI TU VOIS UNE INSCRIPTION, cite-la et explique qui est la personne ou ce que c'est.` 

: `Tu ne vois pas l'image. Base-toi sur le contexte du lieu pour répondre, ou demande au visiteur de préciser ce qu'il regarde.`}

CONTEXTE DU LIEU :
${locationContext || "L'Opéra Garnier, chef-d'œuvre de Charles Garnier inauguré en 1875."}

STYLE DE RÉPONSE :
- Commence directement par ce que tu observes ou l'information demandée
- Ajoute un fait historique ou une anecdote pertinente
- Si approprié, suggère un détail à observer ou une direction à regarder`;

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
                max_tokens: 500,
                temperature: 0.5  // Plus bas = réponses plus factuelles et cohérentes
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
