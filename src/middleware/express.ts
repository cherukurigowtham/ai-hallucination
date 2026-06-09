import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { GroundingSource, ZGuardOptions } from '../verifiers/BaseVerifier.js';
import { FactualVerifier } from '../verifiers/FactualVerifier.js';
import { SymbolicVerifier } from '../verifiers/SymbolicVerifier.js';
import { ZGuardParser } from '../utils/parser.js';

export interface ZGuardRequestExtensions {
  zGuard: {
    verify: (
      agentOutputText: string,
      toolSchema?: z.ZodTypeAny
    ) => Promise<{
      isValid: boolean;
      critiques: string[];
      actionableErrors: string[];
    }>;
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request extends ZGuardRequestExtensions {}
  }
}

/**
 * Z-Guard Express Middleware
 * @param getSources Callback function to retrieve grounding sources dynamically for the request.
 * @param options Z-Guard validation options.
 */
export function zGuardMiddleware(
  getSources: (req: Request) => Promise<GroundingSource[]> | GroundingSource[],
  options: ZGuardOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sources = await getSources(req);
      const factualVerifier = new FactualVerifier(sources, options);
      const symbolicVerifier = new SymbolicVerifier();

      // Attach verifier to request context
      req.zGuard = {
        verify: async (agentOutputText: string, toolSchema?: z.ZodTypeAny) => {
          const critiques: string[] = [];
          const actionableErrors: string[] = [];
          let overallValid = true;

          const checkTasks: Promise<void>[] = [];

          // 1. Parse natural language claims and check citation consistency
          const claims = ZGuardParser.parseClaims(agentOutputText);
          if (claims.length > 0) {
            checkTasks.push(
              factualVerifier.verifyAll(claims).then((factualResult) => {
                if (!factualResult.isValid) {
                  overallValid = false;
                  for (const res of factualResult.results) {
                    if (!res.validation.isValid) {
                      critiques.push(res.validation.critique);
                      if (res.validation.actionableError) {
                        actionableErrors.push(res.validation.actionableError);
                      }
                    }
                  }
                }
              })
            );
          }

          // 2. Parse tool calls and check symbolic type compliance
          if (toolSchema) {
            const parsedTool = ZGuardParser.parseToolCall(agentOutputText);
            if (parsedTool.toolCall) {
              const mockResponse = {
                factualClaim: '',
                citationId: '',
                proposedToolCall: parsedTool.toolCall,
                proposedToolArgs: parsedTool.toolArgs
              };
              
              checkTasks.push(
                Promise.resolve(symbolicVerifier.verifyToolCall(mockResponse, toolSchema)).then((symbolicResult) => {
                  if (!symbolicResult.isValid) {
                    overallValid = false;
                    critiques.push(symbolicResult.critique);
                    if (symbolicResult.actionableError) {
                      actionableErrors.push(symbolicResult.actionableError);
                    }
                  }
                })
              );
            }
          }

          // Await all checks concurrently
          await Promise.all(checkTasks);

          return {
            isValid: overallValid,
            critiques,
            actionableErrors
          };
        }
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
