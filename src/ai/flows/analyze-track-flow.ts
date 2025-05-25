'use server';
/**
 * @fileOverview Analyzes a track layout and estimates lap times.
 * - analyzeTrackFlow - Function to perform track analysis.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit'; // Genkit exports z from zod
import type { TrackAnalysisInput, TrackAnalysisOutput} from '@/lib/types';
import { TrackAnalysisInputSchema, TrackAnalysisOutputSchema } from '@/lib/types';

export async function analyzeTrackFlow(input: TrackAnalysisInput): Promise<TrackAnalysisOutput> {
  const prompt = ai.definePrompt({
    name: 'analyzeTrackPrompt',
    input: { schema: TrackAnalysisInputSchema },
    output: { schema: TrackAnalysisOutputSchema },
    prompt: `You are an F1 track design analyst.
Track Name: {{{trackName}}}
Number of Straight Segments: {{{numStraights}}}
Number of Corner Segments: {{{numCorners}}}
Total Segments: {{{totalSegments}}}

Based on this track composition, please provide:
1.  An estimated lap time for a modern F1 car. Format this as M:SS.mmm (e.g., 1:32.456).
2.  A short list (3-5 bullet points) of the main characteristics of this track (e.g., "High-speed", "Technical sections", "Good overtaking opportunities").
3.  A brief paragraph of design feedback, highlighting interesting aspects or potential areas for improvement from a racing perspective.`,
  });

  try {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('AI did not return a valid analysis.');
    }
    // Ensure all fields are present, provide defaults if necessary
    return {
      estimatedLapTime: output.estimatedLapTime || "N/A",
      trackCharacteristics: output.trackCharacteristics || ["No characteristics provided."],
      designFeedback: output.designFeedback || "No feedback provided.",
    };
  } catch (error: any) {
    console.error("Error analyzing track:", error);
    let errorMessage = "Failed to analyze track. See console for details.";
    if (error.message && (error.message.includes('GEMINI_API_KEY') || error.message.includes('GOOGLE_API_KEY') || (error.cause as any)?.code === 'FAILED_PRECONDITION' || (error.cause as any)?.status === 'FAILED_PRECONDITION')) {
      errorMessage = "AI Analysis Error: API Key is missing, invalid, or has insufficient quota. Please check your environment configuration and Google Cloud project.";
    } else if (error.message) {
      errorMessage = `AI Analysis Error: ${error.message}`;
    }
    return {
      estimatedLapTime: "Error",
      trackCharacteristics: [errorMessage],
      designFeedback: "Could not complete analysis.",
    };
  }
}
