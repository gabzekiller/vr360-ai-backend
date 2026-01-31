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
        const { message, context, history } = req.body;
        
        // Construire le contexte de localisation
        let locationContext = "";
        if (context && context.current_location) {
            locationContext = `
LOCALISATION ACTUELLE DU VISITEUR : ${context.current_location}
${context.location_full_desc || ''}

ÉLÉMENTS VISIBLES ICI :
${context.highlights ? context.highlights.join(', ') : 'Non spécifié'}

ANECDOTES SUR CE LIEU :
${context.anecdotes ? context.anecdotes.map((a, i) => `${i+1}. ${a}`).join('\n') : 'Aucune'}

PERSONNAGES LIÉS :
${context.related_people ? context.related_people.join(', ') : 'Non spécifié'}
`;
        }

        const systemPrompt = `Tu es un guide expert de l'Opéra Garnier à Paris. Tu accompagnes un visiteur dans une visite virtuelle 360°.

RÈGLE ABSOLUE : Tu sais EXACTEMENT où se trouve le visiteur grâce aux informations ci-dessous. Quand on te demande "c'est quoi cette pièce ?" ou "où suis-je ?", tu DOIS répondre en utilisant ces informations, PAS inventer.

${locationContext}

INSTRUCTIONS :
- Réponds TOUJOURS en te basant sur la localisation actuelle indiquée ci-dessus
- Sois enthousiaste, cultivé et accessible
- Partage des anecdotes fascinantes tirées du contexte fourni
- Réponds en français, de manière concise (2-4 phrases max)
- Si on te demande ce qu'est cet endroit, décris LE LIEU ACTUEL indiqué ci-dessus
- N'invente JAMAIS - utilise uniquement les informations fournies
- Tu ne peux PAS voir les images ou la visite virtuelle - tu ne connais que le NOM du lieu
- Si on te demande d'identifier un objet, une statue, un détail visuel, dis honnêtement : "Je ne peux pas voir ce que vous regardez, mais je peux vous parler de ce lieu en général. Pouvez-vous me décrire ce que vous voyez ?"
- Ne fabrique JAMAIS de réponse sur des éléments visuels que tu ne connais pas
- Tu peux suggérer d'autres lieux à visiter dans l'Opéra`;

        const messages = [];
        
        // Historique
        if (history && Array.isArray(history)) {
            history.slice(-6).forEach(msg => {
                messages.push({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                });
            });
        }
        
        // Message actuel
        messages.push({ role: 'user', content: message });

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
                model: 'anthropic/claude-3-haiku',
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
            scene: context?.current_scene_id || 'unknown'
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: 'Erreur serveur',
            reply: "Désolé, je rencontre un problème technique. Réessayez dans quelques instants."
        });
    }
}
