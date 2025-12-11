import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

export interface BodyAnalysis {
    somatotype: string;
    estimatedBodyFat: number;
    postureAnalysis: string[];
    strengths: string[];
    weaknesses: string[];
    idealPhysique: {
        targetWeightKg: number;
        description: string;
        focusAreas: string[];
    };
}

export class GeminiService {
    // Using the latest experimental model for maximum "NanoBanana" performance 🍌
    private model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    async analyzeBodyScan(
        images: { front: Buffer; back: Buffer; left: Buffer; right: Buffer },
        biometrics: { heightCm: number; weightKg: number; bodyFat?: number }
    ): Promise<BodyAnalysis | null> {
        try {
            const prompt = `
        You are an elite expert in biomechanics, bodybuilding, and human anatomy.
        Analyze these 4 body photos (Front, Back, Left, Right) of a user who is ${biometrics.heightCm}cm tall and weighs ${biometrics.weightKg}kg.
        
        Provide a detailed JSON analysis with the following fields:
        - somatotype: (Endomorph, Mesomorph, Ectomorph, or hybrid)
        - estimatedBodyFat: (number, estimate based on visual definition)
        - postureAnalysis: (array of strings, e.g. "Anterior Pelvic Tilt", "Rounded Shoulders")
        - strengths: (array of strings, e.g. "Wide Clavicles", "Strong Legs")
        - weaknesses: (array of strings, e.g. "Weak Upper Chest", "Core stability")
        - idealPhysique: object containing:
            - targetWeightKg: (number, realistic lean goal)
            - description: (string, brief vision of the "Apollo" version of this user)
            - focusAreas: (array of strings, muscles to prioritize)

        Be honest but constructive. Return ONLY raw JSON, no markdown.
      `;

            const imageParts = [
                this.bufferToPart(images.front, 'image/jpeg'),
                this.bufferToPart(images.back, 'image/jpeg'),
                this.bufferToPart(images.left, 'image/jpeg'),
                this.bufferToPart(images.right, 'image/jpeg'),
            ];

            const result = await this.model.generateContent([prompt, ...imageParts]);
            const response = await result.response;
            const text = response.text();

            // Clean markdown if present
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(jsonStr) as BodyAnalysis;
        } catch (error) {
            console.error('Gemini Analysis Failed:', error);
            return null;
        }
    }

    private bufferToPart(buffer: Buffer, mimeType: string) {
        return {
            inlineData: {
                data: buffer.toString('base64'),
                mimeType,
            },
        };
    }
}
