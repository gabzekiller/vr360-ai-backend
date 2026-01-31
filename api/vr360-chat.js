export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    try {
        const { message, context, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });
        
        const systemPrompt = buildSystemPrompt(context);
        const messages = [...(history || []), { role: 'user', content: message }];
        const provider = process.env.AI_PROVIDER || 'openrouter';
        
        let reply;
        
        if (provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 600,
                    system: systemPrompt,
                    messages: messages
                })
            });
            if (!response.ok) throw new Error(`Anthropic HTTP ${response.status}`);
            const data = await response.json();
            reply = data.content[0]?.text || "Erreur";
        } else {
            // OpenRouter (gratuit)
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://gabrielacoca.fr',
                    'X-Title': 'VR360 Opera Garnier'
                },
                body: JSON.stringify({
                    model: 'google/gemma-2-9b-it:free',
                    max_tokens: 600,
                    messages: [{ role: 'system', content: systemPrompt }, ...messages]
                })
            });
            if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
            const data = await response.json();
            reply = data.choices[0]?.message?.content || "Erreur";
        }
        
        return res.status(200).json({ reply, suggested_scene: extractSuggestedScene(reply, context) });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'AI service error' });
    }
}

function buildSystemPrompt(ctx) {
    const c = ctx || {};
    return `Tu es un guide expert passionné de l'Opéra Garnier, le célèbre opéra de Paris.

LIEU ACTUEL: ${c.current_location || "l'entrée"}
${c.location_full_desc ? `DESCRIPTION: ${c.location_full_desc}` : ''}
${c.highlights?.length ? `POINTS D'INTÉRÊT: ${c.highlights.join(', ')}` : ''}
${c.anecdotes?.length ? `ANECDOTES: ${c.anecdotes.join(' ')}` : ''}

INSTRUCTIONS:
- Réponds en 2-4 phrases max (sauf demande contraire)
- Sois enthousiaste mais naturel
- Utilise les anecdotes pour rendre tes réponses vivantes
- N'invente jamais de faits
- Réponds en français
- Ton conversationnel, évite les listes`;
}

function extractSuggestedScene(reply, ctx) {
    const kw = {
        'grand escalier': 'pano13', 'chagall': 'pano14', 'lustre': 'pano14',
        'loge': 'pano19', 'fantôme': 'pano19', 'grand foyer': 'pano24',
        'baudry': 'pano24', 'glacier': 'pano27', 'bibliothèque': 'pano81',
        'degas': 'pano103', 'danse': 'pano103'
    };
    const r = reply.toLowerCase(), cur = (ctx?.current_location || '').toLowerCase();
    for (const [k, v] of Object.entries(kw)) if (r.includes(k) && !cur.includes(k)) return v;
    return null;
}
