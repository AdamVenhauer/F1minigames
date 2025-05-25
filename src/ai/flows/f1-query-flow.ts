
'use server';
/**
 * @fileOverview An F1 knowledge query flow.
 *
 * - f1QueryFlow - A function that answers F1-related questions.
 * - F1QueryInput - The input type for the f1QueryFlow function.
 * - F1QueryOutput - The return type for the f1QueryFlow function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit'; // Genkit re-exports z from zod

const F1QueryInputSchema = z.object({
  userQuery: z.string().describe('The user\'s question about Formula 1.'),
});
export type F1QueryInput = z.infer<typeof F1QueryInputSchema>;

const F1QueryOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the F1 question.'),
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

User Query: {{{userQuery}}}

Provide your answer.`,
});

const f1QueryFlow = ai.defineFlow(
  {
    name: 'f1QueryFlow',
    inputSchema: F1QueryInputSchema,
    outputSchema: F1QueryOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      // This case handles if the prompt call itself fails to produce an output object.
      // The FAILED_PRECONDITION error (API key) is usually caught before this, on the Genkit client side,
      // but this makes the flow itself a bit more robust.
      return { answer: "I'm sorry, I couldn't generate a response at this time. Please check the application setup." };
    }
    return output;
  }
);

