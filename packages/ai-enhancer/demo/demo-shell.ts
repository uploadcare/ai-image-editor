import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

type Theme = 'auto' | 'light' | 'dark';

/**
 * Controls are slotted, so they stay in the page's light DOM and the shell's own
 * shadow styles cannot reach them — `::slotted()` matches the <label> but not the
 * <select>/<input> inside it. Adopting one document stylesheet keeps the fields
 * looking like the shell's own instead of copying this block into every demo page.
 */
const CONTROL_STYLES = new CSSStyleSheet();
CONTROL_STYLES.replaceSync(`
  demo-shell label[slot='controls'] select,
  demo-shell label[slot='controls'] input:not([type='checkbox']) {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    font: inherit;
    font-size: 13px;
    border: 1px solid light-dark(#d1d5db, #3a3b41);
    border-radius: 7px;
    background: light-dark(#fff, #1e1f24);
    color: inherit;
  }
  demo-shell label[slot='controls'] select:focus-visible,
  demo-shell label[slot='controls'] input:focus-visible {
    outline: 2px solid light-dark(#2563eb, #60a5fa);
    outline-offset: 1px;
  }
  demo-shell label[slot='controls'] input[type='checkbox'] {
    width: 15px;
    height: 15px;
    margin: 0;
    accent-color: light-dark(#2563eb, #60a5fa);
  }
  /*
   * A checkbox belongs beside its text, not above it. This lives here rather than
   * in the shadow styles because :has() is not matched inside ::slotted(), and
   * document rules win over ::slotted() for slotted elements anyway.
   */
  demo-shell label[slot='controls']:has(input[type='checkbox']) {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    /* Line up with the fields in neighbouring columns, not with their labels. */
    padding-block-end: 7px;
    font-size: 13px;
    font-weight: 400;
    color: inherit;
  }
  /* The demos set size="20"/size="36" etc.; the grid decides the width now. */
  demo-shell label[slot='controls'] input[size] {
    min-width: 0;
  }
`);

/**
 * Shared chrome for the AI Enhancer demos: page heading, a toolbar with a
 * built-in theme switch (plus a `controls` slot for demo-specific inputs), a
 * stage for the demoed component, and a log panel that auto-captures the
 * editor's `uc:done` / `uc:cancel` / `uc:error` events.
 */
@customElement('demo-shell')
export class DemoShell extends LitElement {
  static override styles = css`
    :host {
      display: block;
      max-width: 1240px;
      margin: 0 auto;
    }
    nav {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin: 0 0 20px;
    }
    nav a {
      padding: 4px 12px;
      font-size: 13px;
      text-decoration: none;
      color: inherit;
      border: 1px solid light-dark(#d1d5db, #3a3b41);
      border-radius: 999px;
    }
    nav a[aria-current='page'] {
      background: light-dark(#111, #f5f5f5);
      color: light-dark(#fff, #111);
      border-color: transparent;
    }
    h1 {
      text-align: center;
      font-weight: 500;
      margin: 0 0 16px;
    }
    .description {
      text-align: center;
      color: light-dark(#4b5563, #9ca3af);
      margin: 0 0 16px;
    }
    /*
     * A grid rather than a wrapping flex row: the controls have wildly different
     * label lengths, and flex-wrap left ragged gaps and orphaned fields. Fixed
     * tracks keep every field the same width and line the labels up in columns,
     * which is what makes a form of this size legible. One column on narrow
     * screens, where the old layout was close to unusable.
     */
    .toolbar {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 10px 16px;
      align-items: end;
      margin: 0 0 20px;
      padding: 16px;
      background: light-dark(#fff, #25262b);
      border: 1px solid light-dark(#e5e7eb, #33343a);
      border-radius: 12px;
      box-shadow: 0 1px 2px light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.3));
    }
    /* Label above control, so a long label never squeezes its field. */
    .toolbar label,
    ::slotted(label) {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 12px;
      font-weight: 500;
      color: light-dark(#4b5563, #9ca3af);
    }
    /*
     * ::slotted() only reaches the slotted element itself, so fields inside a
     * slotted label cannot be styled from here — CONTROL_STYLES above covers
     * those. These rules are for the shell's own controls (the theme switch).
     */
    .toolbar select,
    .toolbar input {
      width: 100%;
      box-sizing: border-box;
      padding: 6px 8px;
      font: inherit;
      font-size: 13px;
      border: 1px solid light-dark(#d1d5db, #3a3b41);
      border-radius: 7px;
      background: light-dark(#fff, #1e1f24);
      color: inherit;
    }
    .toolbar select:focus-visible,
    .toolbar input:focus-visible {
      outline: 2px solid light-dark(#2563eb, #60a5fa);
      outline-offset: 1px;
    }
    .log {
      margin: 20px 0 0;
      padding: 10px 14px;
      background: light-dark(#fff, #25262b);
      border-radius: 10px;
      font-family: ui-monospace, Menlo, monospace;
      font-size: 12px;
      max-height: 140px;
      overflow-y: auto;
    }
    .log p {
      margin: 2px 0;
    }
  `;

  /** Page heading shown above the toolbar. */
  @property()
  public heading = '';

  /** Optional intro paragraph rendered under the heading. */
  @property()
  public description?: string;

  @state()
  private _theme: Theme = 'auto';

  @state()
  private _entries: string[] = [];

  public override connectedCallback(): void {
    super.connectedCallback();
    if (!document.adoptedStyleSheets.includes(CONTROL_STYLES)) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, CONTROL_STYLES];
    }
    this.addEventListener('uc:done', this._onUcEvent);
    this.addEventListener('uc:cancel', this._onUcEvent);
    this.addEventListener('uc:error', this._onUcEvent);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('uc:done', this._onUcEvent);
    this.removeEventListener('uc:cancel', this._onUcEvent);
    this.removeEventListener('uc:error', this._onUcEvent);
  }

  /** Prepend a timestamped line to the log panel. */
  public log(message: string): void {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    this._entries = [line, ...this._entries].slice(0, 50);
  }

  private _onUcEvent = (event: Event): void => {
    const detail = (event as CustomEvent).detail;
    if (event.type === 'uc:done') {
      this.log(`uc:done: ${JSON.stringify(detail)}`);
    } else if (event.type === 'uc:cancel') {
      this.log('uc:cancel');
    } else if (event.type === 'uc:error') {
      this.log(`uc:error: ${detail?.error?.message ?? detail?.error}`);
    }
  };

  private _onThemeChange(event: Event): void {
    this._theme = (event.target as HTMLSelectElement).value as Theme;
    document.body.classList.remove('uc-light', 'uc-dark');
    if (this._theme !== 'auto') {
      document.body.classList.add(`uc-${this._theme}`);
    }
  }

  private get _currentPage(): string {
    return window.location.pathname.split('/').pop() || 'standalone.html';
  }

  protected override render() {
    const page = this._currentPage;
    return html`
      <nav>
        <a href="./standalone.html" aria-current=${page === 'standalone.html' ? 'page' : nothing}>Standalone</a>
        <a href="./plugin.html" aria-current=${page === 'plugin.html' ? 'page' : nothing}>Plugin</a>
        <a href="./shimmer-lab.html" aria-current=${page === 'shimmer-lab.html' ? 'page' : nothing}>Shimmer Lab</a>
      </nav>
      <h1>${this.heading}</h1>
      ${this.description ? html`<p class="description">${this.description}</p>` : nothing}

      <div class="toolbar">
        <label>
          Theme
          <select .value=${this._theme} @change=${this._onThemeChange}>
            <option value="auto">auto (system)</option>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
        <slot name="controls"></slot>
      </div>

      <div class="stage"><slot></slot></div>

      ${
        this._entries.length
          ? html`<div class="log">${this._entries.map((entry) => html`<p>${entry}</p>`)}</div>`
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-shell': DemoShell;
  }
}
