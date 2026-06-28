// ==========================================
// LangChain Integration Example for Z-Guard
// ==========================================

const { verify } = require('../dist/index.js');

/**
 * Custom LangChain Output Parser integrating Z-Guard neuro-symbolic validations.
 * If a hallucination is detected at runtime, it throws an error that can trigger self-correction.
 */
class ZGuardLangChainParser {
  constructor(options = {}) {
    this.sources = options.sources || [];
    this.schema = options.schema;
    this.geminiApiKey = options.geminiApiKey;
    this.openAIApiKey = options.openAIApiKey;
    this.anthropicApiKey = options.anthropicApiKey;
    this.nliThreshold = options.nliThreshold ?? 0.8;
  }

  async parse(text) {
    const result = await verify(text, {
      sources: this.sources,
      schema: this.schema,
      geminiApiKey: this.geminiApiKey,
      openAIApiKey: this.openAIApiKey,
      anthropicApiKey: this.anthropicApiKey,
      nliThreshold: this.nliThreshold
    });

    if (!result.isValid) {
      throw new Error(
        `Z-Guard Hallucination Intercepted!\n` +
        `Critiques: ${result.critiques.join('; ')}\n` +
        `Corrections: ${result.actionableErrors.join('; ')}`
      );
    }

    return text;
  }

  getFormatInstructions() {
    return 'Your response must only contain claims fully grounded in references and valid tool parameters.';
  }
}

module.exports = { ZGuardLangChainParser };
