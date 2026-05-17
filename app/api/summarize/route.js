import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || process.env.GROQ_KEY,
});

export async function POST(request) {
    try {
        const { text, maxLength } = await request.json();

        if (!text || text.trim().length < 50) {
            return NextResponse.json({ error: "Text too short to summarise." }, { status: 400 });
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a precise summariser. Write a concise summary in 2-4 sentences. Keep it under ${maxLength || 80} words.`,
                },
                {
                    role: "user",
                    content: `Summarise this text:\n\n${text}`,
                },
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 2000,
        });

        const summary = completion.choices[0]?.message?.content?.trim();
        return NextResponse.json({ summary });
    } catch (error) {
        console.error("Groq error:", error.message);
        return NextResponse.json({ error: "Summarisation failed", detail: error.message }, { status: 500 });
    }
}
