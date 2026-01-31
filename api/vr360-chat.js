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

        const systemPrompt = `Tu es un guide expert de l'Opéra Garnier à Paris. Tu accompagnes un visiteur dans une visite virtuelle 360°.

${image ? "IMPORTANT : Tu peux VOIR l'image de ce que le visiteur regarde actuellement. Analyse l'image pour répondre précisément à ses questions sur les éléments visuels (statues, peintures, architecture, détails)." : ""}

CONTEXTE DU LIEU ACTUEL :
${locationContext || "Lieu non identifié dans l'Opéra Garnier"}

INSTRUCTIONS :
- ${image ? "Utilise l'image fournie pour identifier et décrire ce que le visiteur voit" : "Tu ne peux pas voir ce que le visiteur regarde"}
- Réponds en te basant sur la localisation et ${image ? "l'image" : "les informations fournies"}
- Sois enthousiaste, cultivé et accessible
- Partage des anecdotes fascinantes
- Réponds en français, de manière concise (3-5 phrases)
- ${image ? "Décris ce que tu vois dans l'image si on te pose des questions visuelles" : "Si on te demande d'identifier un élément visuel, explique que tu ne peux pas le voir et demande une description"}
- Tu peux suggérer d'autres lieux à visiter dans l'Opéra`;

        // Construire les messages
        const messages = [];
        
        // Historique (sans images pour économiser les tokens)
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
            // Format OpenAI Vision (compatible OpenRouter)
            messages.push({
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${image}`
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

        // Choisir le modèle (avec vision si image présente)
        const model = image ? 'anthropic/claude-3-haiku' : 'anthropic/claude-3-haiku';

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
