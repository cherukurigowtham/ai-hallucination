import { z } from 'zod';
import { AgentResponse, ValidationResult } from './BaseVerifier.js';

export class SymbolicVerifier {
  /**
   * Verifies a tool call's structure against a Zod schema definition.
   */
  verifyToolCall(response: AgentResponse, schema: z.ZodTypeAny): ValidationResult {
    const { proposedToolCall, proposedToolArgs } = response;

    // If no tool call is requested, it's structurally valid
    if (!proposedToolCall) {
      return {
        isValid: true,
        critique: 'No tool execution requested.'
      };
    }

    if (!proposedToolArgs) {
      return {
        isValid: false,
        critique: `Symbolic Error: Missing arguments for tool call '${proposedToolCall}'.`,
        actionableError: 'Provide a structured arguments object conforming to the required schema.'
      };
    }

    // Validate using Zod schema
    const result = schema.safeParse(proposedToolArgs);

    if (!result.success) {
      // Format Zod errors into a readable compiler-like traceback
      const errorDetails = result.error.errors
        .map((err) => {
          const path = err.path.join('.');
          return `'${path || 'root'}': ${err.message}`;
        })
        .join(', ');

      return {
        isValid: false,
        critique: `Symbolic Error: Schema violation in tool arguments for '${proposedToolCall}': ${errorDetails}`,
        actionableError: `Adjust arguments to conform to schema: ${errorDetails}`
      };
    }

    return {
      isValid: true,
      critique: `Symbolic verification passed for tool call '${proposedToolCall}'.`
    };
  }
}
