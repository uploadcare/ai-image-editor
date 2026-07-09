// Side-effect-free entry: just the public error class and its types, importable
// on the server (unlike the main entry, which registers custom elements at
// module scope). The React wrapper depends on this staying pure.
export { AiEnhancerError, type AiEnhancerErrorCode, type AiEnhancerErrorOptions } from './entities/error/model/types';
