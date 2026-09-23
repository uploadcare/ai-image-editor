import { rememberAuthToken, resolveAuthToken } from './demo-env.ts';

/**
 * The "Auth token" control, shared by the two demo pages.
 *
 * Built here rather than written into each page's markup because a credential
 * comes with caveats that have to stay true in one place: the value lives in
 * this browser only, never in the URL (see `resolveAuthToken`), and the field
 * is the only thing that shows it.
 *
 * Plain DOM, not a custom element: the shell styles its toolbar with
 * `demo-shell label[slot='controls'] input`, which a shadow root would hide the
 * field from.
 *
 * @param shell the `<demo-shell>` whose toolbar gets the field
 * @param onChange called with the trimmed token after it has been remembered
 * @returns a function that refreshes the field from storage
 */
export function mountAuthTokenField(shell: Element, onChange: (authToken: string) => void): () => void {
  const label = document.createElement('label');
  label.slot = 'controls';
  label.append('Auth token');

  const input = document.createElement('input');
  input.type = 'text';
  input.size = 30;
  input.placeholder = 'blank = send none';
  input.title = 'For a project with signed uploads enabled. Kept in this browser only, never in the URL.';
  label.append(input);
  shell.append(label);

  input.addEventListener('change', () => {
    const authToken = input.value.trim();
    rememberAuthToken(authToken);
    onChange(authToken);
  });

  return () => {
    input.value = resolveAuthToken();
  };
}
