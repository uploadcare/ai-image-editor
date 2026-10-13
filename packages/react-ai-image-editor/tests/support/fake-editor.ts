/**
 * Deterministic stand-in for the real Lit element, for a `vi.mock('@uploadcare/ai-image-editor')` factory: accessors
 * live on the prototype (like Lit's `@property`) so the adapter's prop-splitting treats them as element properties.
 */
export function defineFakeEditor() {
  class UcAiImageEditor extends HTMLElement {
    #pubkey = '';
    get pubkey() {
      return this.#pubkey;
    }
    set pubkey(value: string) {
      this.#pubkey = value;
    }
  }
  customElements.define('uc-ai-image-editor', UcAiImageEditor);
  return { UcAiImageEditor };
}
