---
title: Theming
---

# Theming

The editor is styled entirely through CSS custom properties on the element. When
used as a plugin, most tokens inherit from the uploader's `--uc-*` theme
automatically. Set any of these to customize:

```css
uc-ai-editor {
  --uc-ai-primary: #6d28d9;
  --uc-ai-radius: 20px;
  --uc-ai-dot-grid-color: #2a2a2a;
}
```

| Token group | Tokens |
|---|---|
| Color | `--uc-ai-foreground`, `--uc-ai-background`, `--uc-ai-floating`, `--uc-ai-floating-border`, `--uc-ai-muted`, `--uc-ai-muted-foreground`, `--uc-ai-primary`, `--uc-ai-primary-hover`, `--uc-ai-primary-foreground`, `--uc-ai-primary-transparent`, `--uc-ai-secondary`, `--uc-ai-secondary-hover`, `--uc-ai-secondary-foreground`, `--uc-ai-border`, `--uc-ai-destructive`, `--uc-ai-destructive-foreground` |
| Shape | `--uc-ai-radius`, `--uc-ai-radius-button`, `--uc-ai-radius-card`, `--uc-ai-radius-frame`, `--uc-ai-radius-input` |
| Layout & type | `--uc-ai-padding`, `--uc-ai-button-size`, `--uc-ai-font-family`, `--uc-ai-font-size` |
| Canvas / motion | `--uc-ai-dot-grid-color`, `--uc-ai-shadow-color`, `--uc-ai-dialog-shadow`, `--uc-ai-transition`, `--uc-ai-ease-in-out`, `--uc-ai-ease-out` |
| Prompt | `--uc-ai-prompt-max-height`, `--uc-ai-prompt-max-lines` |

The [Components API](/api/components#css-properties) lists the tokens captured
from the source.
