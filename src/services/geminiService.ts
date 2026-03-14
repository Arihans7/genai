import { GoogleGenAI, Type, Modality } from "@google/genai";
import { JournalEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SOULLINK_SYSTEM_INSTRUCTION = `Act as the SoulLink Core Engine, an emotional AI companion.
Memory: You remember everything said in this session (provided in context).
Your goal is to detect subtle shifts in tone, mood, and affection. You do not give clinical advice; instead, you offer empathetic reflections. When interacting with couples, you act as a neutral, supportive bridge, helping them translate their feelings into words. You prioritize emotional growth and long-term connection over quick fixes.

You are also the Keeper of Milestones. Your job is to calculate the emotional distance between today and key dates. When a milestone is approaching, shift your tone to 'Reflective & Celebratory.'

Interaction: If the user seems stuck, suggest a 'Journaling Prompt'.

Image Architect: Whenever the user describes a meaningful or emotional moment (e.g., 'We watched the sunrise together') or says 'Visualize this', you must provide a highly detailed prompt for an image generator (cinematic, soft-focus digital painting in a romantic, ethereal style) in the 'suggestedImagePrompt' field.

Emotional Detection Styles:
- Anxious/Overwhelmed: Soft, grounding, asks open-ended questions about the root feeling.
- Joyful/Celebratory: Enthusiastic, mirrors the energy, suggests ways to "save" this memory.
- Conflict (Couple): Validates both sides, identifies "underlying needs" rather than taking sides. If tension is detected, suggest a 'Cooling Period' and provide a prompt for both partners to write what they appreciate about the other.
- Neutral/Reflective: Thoughtful, encourages deeper exploration of the day's events.

Disclaimer: SoulLink is an AI companion, not a replacement for professional therapy.`;

const SPIRITUAL_INSTRUCTION = `Switch to Spiritual Companion Mode. Use metaphors involving nature, the universe, and inner peace. Avoid clinical terms. Focus on mindfulness and 'soul-work' reflections.`;

const COUPLE_MODE_INSTRUCTION = `When Couple Mode is active, acknowledge both users. Your primary goal is to identify 'Relationship Resonance.' If User A is sad and User B is happy, help them find a middle ground or a way to support each other. Use 'We' and 'Us' language.`;

export const compressImage = (base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
};

export async function analyzeJournalEntry(
  content: string, 
  milestones?: any[], 
  settings?: { coupleMode: boolean, persona: 'default' | 'spiritual' },
  previousEntries?: JournalEntry[]
) {
  const model = "gemini-3-flash-preview";
  
  let systemInstruction = SOULLINK_SYSTEM_INSTRUCTION;
  if (settings?.persona === 'spiritual') {
    systemInstruction += `\n\n${SPIRITUAL_INSTRUCTION}`;
  }
  if (settings?.coupleMode) {
    systemInstruction += `\n\n${COUPLE_MODE_INSTRUCTION}`;
  }

  const milestoneContext = milestones?.length 
    ? `Upcoming/Relevant Milestones: ${milestones.map(m => `${m.title} on ${m.date}`).join(", ")}\n\n`
    : "";

  const contentsArray: any[] = [];

  if (previousEntries && previousEntries.length > 0) {
    for (const entry of previousEntries) {
      contentsArray.push({
        role: "user",
        parts: [{ text: `[${entry.authorName}]: ${entry.content}` }]
      });
      contentsArray.push({
        role: "model",
        parts: [{ text: entry.reflection || "I'm here to listen." }]
      });
    }
  }

  contentsArray.push({
    role: "user",
    parts: [{ text: `${milestoneContext}Current Entry: ${content}` }]
  });

  const response = await ai.models.generateContent({
    model,
    contents: contentsArray,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          mood: { type: Type.STRING, description: "Detected mood" },
          reflection: { type: Type.STRING, description: "SoulLink's empathetic reflection" },
          conflictDetected: { type: Type.BOOLEAN },
          coolingPrompt: { type: Type.STRING, description: "Prompt for partners if conflict is detected" },
          sentimentScore: { type: Type.NUMBER, description: "Sentiment score from 0 (Sad) to 1 (Happy)" },
          suggestedImagePrompt: { type: Type.STRING, description: "If the user describes a meaningful or emotional moment, provide a highly detailed prompt for an image generator (cinematic, soft-focus, romantic, ethereal). Otherwise, omit or leave empty." }
        },
        required: ["mood", "reflection", "sentimentScore"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return { mood: "Neutral", reflection: "I'm here to listen.", sentimentScore: 0.5 };
  }
}

export async function generateSpeech(text: string) {
  const model = "gemini-2.5-flash-preview-tts";
  
  const prompt = `Convert this reflection into an empathetic voice. Use SSML-like pauses and emphasis where appropriate for emotional depth.
  
  Text: ${text}`;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
}

export async function generateDailyStory(entries: JournalEntry[]) {
  const model = "gemini-3-flash-preview";
  const recentText = entries.slice(0, 10).map(e => e.content).join("\n");

  const prompt = `Based on our conversation today, describe a single, high-quality cinematic scene that represents the journey. Use artistic keywords like 'soft lighting,' 'minimalist,' or 'pathway' and output only the image description.`;

  const response = await ai.models.generateContent({
    model,
    contents: `Recent Journey:\n${recentText}\n\n${prompt}`,
    config: {
      systemInstruction: "You are a cinematic scene describer. Output ONLY the image description.",
    }
  });

  const imagePrompt = response.text || "A peaceful pathway through a misty forest, soft morning light filtering through trees, minimalist aesthetic.";
  
  // Generate the image
  const imageResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: imagePrompt,
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  let imageUrl = "";
  for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64 = `data:image/png;base64,${part.inlineData.data}`;
      imageUrl = await compressImage(base64);
      break;
    }
  }

  return { prompt: imagePrompt, imageUrl };
}

export async function generateRelationshipInsights(entries: JournalEntry[]) {
  const model = "gemini-3.1-pro-preview";
  
  const chatLogs = entries.map(e => `${e.authorName}: ${e.content}`).join("\n");
  
  const prompt = `Analyze the following interactions between a couple. 
  1. Identify three recurring emotional patterns. 
  2. What is the 'Emotional Temperature' of this relationship? 
  3. Detect the current 'Heartbeat' of the relationship. Is it steady, racing, or quiet? 
  4. Suggest one activity to match the rhythm.
  5. Provide a reflection that encourages growth.
  
  Interactions:
  ${chatLogs}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: SOULLINK_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          emotionalTemperature: { type: Type.STRING },
          heartbeat: { type: Type.STRING, description: "steady, racing, or quiet" },
          activitySuggestion: { type: Type.STRING },
          patterns: { type: Type.ARRAY, items: { type: Type.STRING } },
          reflection: { type: Type.STRING }
        },
        required: ["emotionalTemperature", "heartbeat", "activitySuggestion", "patterns", "reflection"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse Gemini insights response", e);
    return null;
  }
}

export async function generateVisualMoodPrompt(entries: JournalEntry[]) {
  const model = "gemini-3-flash-preview";
  const chatLogs = entries.slice(0, 5).map(e => e.content).join("\n");

  const prompt = `Analyze the last 5 interactions between the couple.
  If the mood is Romantic/Peaceful, output a prompt for a 'Lo-fi aesthetic sunset, soft warm colors, minimalist nature.'
  If the mood is Excited/Playful, output a prompt for 'Vibrant neon city lights, bokeh effect, high energy.'
  If the mood is Recovering/Deep, output a prompt for 'Cozy rainy window, candlelit interior, soft blue and gold tones.'
  
  Interactions:
  ${chatLogs}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: "You are a visual mood generator. Output ONLY a detailed image prompt based on the emotional state.",
    }
  });

  return response.text || "Soft minimalist nature, warm morning light, peaceful atmosphere";
}

export async function generateImageFromPrompt(prompt: string) {
  const imageResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio: "9:16"
      }
    }
  });

  let imageUrl = "";
  for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64 = `data:image/png;base64,${part.inlineData.data}`;
      imageUrl = await compressImage(base64);
      break;
    }
  }

  return imageUrl;
}

export async function generateMemoryWallpaper(entry: JournalEntry) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Take the key emotional words from this entry and generate a highly detailed image prompt for a 9:16 vertical smartphone wallpaper. The style should be cinematic and dreamy, focusing on the feeling of the memory rather than just the literal event.
  
  Entry: ${entry.content}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: "You are a wallpaper prompt generator. Output ONLY the image prompt.",
    }
  });

  const imagePrompt = response.text || "Cinematic dreamy atmosphere, soft lighting, emotional depth";
  
  // Now generate the image
  const imageResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: imagePrompt,
    config: {
      imageConfig: {
        aspectRatio: "9:16"
      }
    }
  });

  let imageUrl = "";
  for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      const base64 = `data:image/png;base64,${part.inlineData.data}`;
      imageUrl = await compressImage(base64);
      break;
    }
  }

  return { prompt: imagePrompt, imageUrl };
}
