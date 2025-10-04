import { GoogleGenAI, Type } from "@google/genai";
import { BusinessDiscovery, ResearchedBusinessData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function findBusinessesStream(
    location: string,
    businessType: string,
    numResults: string,
    onDiscovery: (business: BusinessDiscovery) => void
): Promise<void> {
  try {
    const resultLimitText = numResults === 'ALL'
      ? `Provide a comprehensive list of all`
      : `List the top ${numResults}`;

    const prompt = `${resultLimitText} ${businessType} in ${location}. For each business, provide only its name and official website URL. Stream each result as soon as you find it, formatted as a single line: Business Name | https://website.url. Do not add any other commentary, headers, or formatting.`;

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let buffer = '';
    for await (const chunk of responseStream) {
      buffer += chunk.text;
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex).trim();
        buffer = buffer.substring(newlineIndex + 1);

        if (line.includes('|')) {
          const parts = line.split('|');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const website = parts[1].trim();
            // Basic validation for a URL-like string
            if (name && website && website.startsWith('http')) {
              onDiscovery({ name, website });
            }
          }
        }
      }
    }
    // Process any remaining text in the buffer after the stream ends
    if (buffer.trim().includes('|')) {
      const line = buffer.trim();
      const parts = line.split('|');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const website = parts[1].trim();
        if (name && website && website.startsWith('http')) {
          onDiscovery({ name, website });
        }
      }
    }
  } catch (error) {
    console.error("Error finding businesses via stream:", error);
    throw new Error("Failed to find businesses using Gemini API stream.");
  }
}

const researchSchema = {
    type: Type.OBJECT,
    properties: {
        companyName: {
            type: Type.STRING,
            description: "The official, full legal name of the company."
        },
        contactName: {
            type: Type.STRING,
            description: "A potential contact person's name for outreach (e.g., owner, manager, marketing head). If a specific name cannot be found, state 'Not Found'."
        },
        address: {
            type: Type.STRING,
            description: "The full physical business address. If not found, state 'Not Found'."
        },
        phone: {
            type: Type.STRING,
            description: "The primary business phone number. If not found, state 'Not Found'."
        },
        email: {
            type: Type.STRING,
            description: "A publicly listed contact email address suitable for outreach (e.g., owner, manager). Prioritize specific contacts over generic ones like 'info@'. If not found, state 'Not Found'."
        },
        description: {
            type: Type.STRING,
            description: "A comprehensive, professional paragraph describing the business, its core services/products, mission, and its typical customer base. This should be an in-depth summary for a business analyst."
        }
    },
    required: ["companyName", "contactName", "address", "phone", "email", "description"]
};


export async function researchBusiness(businessName: string, businessWebsite: string): Promise<ResearchedBusinessData> {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Act as a world-class business research analyst. Conduct deep research on the company "${businessName}" with the website "${businessWebsite}". Your primary goal is to find a specific contact email address suitable for outreach (e.g., owner, manager, marketing department), avoiding generic emails like 'info@' or 'contact@' if possible. Additionally, provide a comprehensive, professional paragraph describing the business, its core services or products, its mission, and its typical customer base. Populate all fields in the provided JSON schema with the most accurate information you can find.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: researchSchema,
            },
        });

        const jsonText = response.text;
        return JSON.parse(jsonText) as ResearchedBusinessData;

    } catch (error) {
        console.error(`Error researching business "${businessName}":`, error);
        throw new Error(`Failed to research business "${businessName}".`);
    }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error("Google Maps API key is missing.");
        return null;
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results[0]) {
            return data.results[0].geometry.location;
        } else {
            console.warn(`Geocoding failed for address "${address}": ${data.status}`);
            return null;
        }
    } catch (error) {
        console.error(`Error geocoding address "${address}":`, error);
        return null;
    }
}