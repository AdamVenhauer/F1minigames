
'use server';
/**
 * @fileOverview An F1 knowledge query flow.
 *
 * - queryF1Expert - A function that answers F1-related questions.
 * - F1QueryInput - The input type for the queryF1Expert function.
 * - F1QueryOutput - The return type for the queryF1Expert function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit'; // Genkit re-exports z from zod
import type { TrackAnalysisInput, TrackAnalysisOutput} from '@/lib/types';
import { TrackAnalysisInputSchema, TrackAnalysisOutputSchema } from '@/lib/types';


const F1QueryInputSchema = z.object({
  userQuery: z.string().describe('The user\'s question about Formula 1.'),
});
export type F1QueryInput = z.infer<typeof F1QueryInputSchema>;

const F1QueryOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the F1 question, formatted for readability.'),
});
export type F1QueryOutput = z.infer<typeof F1QueryOutputSchema>;

export async function queryF1Expert(input: F1QueryInput): Promise<F1QueryOutput> {
  return f1QueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'f1QueryPrompt',
  input: {schema: F1QueryInputSchema},
  output: {schema: F1QueryOutputSchema},
  prompt: `You are an expert Formula 1 encyclopedia and historian.
Answer the following user query about Formula 1 comprehensively and accurately.
If the question is ambiguous, provide the most likely interpretation.
If the question is outside of F1 knowledge, state that politely.

Start your response with a clear, bolded title relevant to the user's query (e.g., *Driver Profile: Fernando Alonso* or *Circuit Overview: Suzuka*).

Format your answer for readability:
- Use double newlines to separate paragraphs.
- For lists of facts or statistics (like career details, team history, etc.), use a clear key-value format on separate lines (e.g., "Full Name: Fernando Alonso Díaz").
- For more general lists, start each item on a new line with an asterisk and a space (e.g., "* List item").
- You can use asterisks for bolding other important terms (e.g., *World Championships*).

IMPORTANT: Provide only the answer to the user's query. Do not ask follow-up questions or try to extend the conversation. For example, do not ask "Is there anything else I can help you with?".

User Query: {{{userQuery}}}

Provide your answer, starting with the title.`,
});

const f1QueryFlow = ai.defineFlow(
  {
    name: 'f1QueryFlow',
    inputSchema: F1QueryInputSchema,
    outputSchema: F1QueryOutputSchema,
  },
  async (input) => {
    try {
      const {output} = await prompt(input);
      if (!output || !output.answer) {
        // This case handles if the prompt call itself fails to produce an output object or answer.
        return { answer: "I'm sorry, I couldn't generate a response at this time. Please try again." };
      }
      return output;
    } catch (error: any) {
      console.error("Error in f1QueryFlow:", error);
      // Check for specific API key error messages if possible, though this is a generic catch
      if (error.message && (error.message.includes('API key') || error.message.includes('FAILED_PRECONDITION'))) {
        return { answer: "AI Service Error: Could not connect due to an API key or configuration issue. Please check the application setup." };
      }
      return { answer: "An unexpected error occurred while fetching the answer. Please try again later." };
    }
  }
);

