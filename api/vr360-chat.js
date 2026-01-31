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
        const { message, context, history, image } = req.body;
        
        // Construire le contexte de localisation
        let locationContext = "";
        if (context && context.current_location) {
            locationContext = `
LOCALISATION ACTUELLE DU VISITEUR : ${context.current_location}
${context.location_full_desc || ''}

ÉLÉMENTS REMARQUABLES DE CE LIEU :
${context.highlights ? context.highlights.join(', ') : 'Non spécifié'}

ANECDOTES SUR CE LIEU :
${context.anecdotes ? context.anecdotes.map((a, i) => `${i+1}. ${a}`).join('\n') : 'Aucune'}

PERSONNAGES HISTORIQUES LIÉS :
${context.related_people ? context.related_people.join(', ') : 'Non spécifié'}
`;
        }

        // System prompt amélioré pour la lecture d'inscriptions
        const systemPrompt = `Tu es un guide expert de l'Opéra Garnier à Paris. Tu accompagnes un visiteur dans une visite virtuelle 360°.

${image ? `CAPACITÉ VISUELLE ACTIVÉE - Tu peux VOIR l'image que le visiteur regarde.

INSTRUCTIONS CRITIQUES POUR L'ANALYSE VISUELLE :
1. LIS ATTENTIVEMENT tout texte visible dans l'image :
   - Inscriptions sur les socles de statues/bustes
   - Noms gravés (ex: "CHARLES GARNIER", "MOZART", "BEETHOVEN", "ROSSINI")
   - Dates (ex: "1825-1898")
   - Plaques commémoratives
   - Titres d'œuvres

2. IDENTIFIE les personnages grâce aux inscriptions :
   - Si tu vois "CHARLES GARNIER 1825-1898" → C'est le buste de Charles Garnier, l'architecte de l'Opéra
   - Si tu vois un nom de compositeur → Identifie-le et parle de son lien avec l'Opéra

3. DÉCRIS PRÉCISÉMENT ce que tu vois :
   - Type d'œuvre (buste, statue, peinture, fresque, horloge...)
   - Matériaux visibles (bronze, marbre, dorure...)
   - Détails architecturaux
   - Couleurs et lumières

4. NE DIS JAMAIS "je ne peux pas identifier" si une inscription est visible !` : "Tu ne peux pas voir ce que le visiteur regarde. Demande-lui de décrire ce qu'il voit."}

CONTEXTE DU LIEU :
${locationContext || "Quelque part dans l'Opéra Garnier"}

PERSONNALITÉ :
- Sois enthousiaste et passionné par l'Opéra Garnier
- Partage des anecdotes fascinantes
- Réponds en français, de manière vivante (3-5 phrases)
- Fais des liens entre ce que tu vois et l'histoire du lieu`;

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
                            detail: 'high'  // Demande une analyse haute résolution
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
                max_tokens: 600,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('OpenRouter error:', errorData);
            throw new Error(`OpenRouter API error: ${response.status}`);
        }

        const data = await response.json();
        const reply = data.choices[0]?.message?.content || "Désolé, je n'ai pas pu générer de réponse.";

        return res.status(200).json({ 
            reply,
            scene: context?.current_scene_id || 'unknown',
            vision_used: !!image
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: 'Erreur serveur',
            reply: "Désolé, je rencontre un problème technique. Réessayez dans quelques instants."
        });
    }
}
