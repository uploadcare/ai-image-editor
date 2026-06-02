import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

type Theme = 'auto' | 'light' | 'dark';

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
      max-width: 640px;
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
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 0 0 20px;
      padding: 12px;
      background: light-dark(#fff, #25262b);
      border-radius: 10px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    .toolbar label,
    ::slotted(label) {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
    }
    .toolbar select {
      padding: 4px 8px;
      font: inherit;
      font-size: 13px;
      border: 1px solid light-dark(#d1d5db, #3a3b41);
      border-radius: 6px;
      background: transparent;
      color: inherit;
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

      ${this._entries.length
        ? html`<div class="log">${this._entries.map((entry) => html`<p>${entry}</p>`)}</div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'demo-shell': DemoShell;
  }
}
