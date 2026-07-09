---
title: UI & layout
---

# UI & layout

The editor's chrome is arranged from a few independent pieces. This page explains
each and the properties that position them. Every option here is an attribute, so
you can set it in HTML or as a property — and you can try them all live on the
[demo](/demo).

## The pieces

- **Canvas** — the central stage where the image (or the idle dot grid) is shown.
- **Composer** — the bar holding the **prompt input**, the **preset chips**, and
  the **aspect-ratio** picker. It's what the user types into to generate/edit.
- **History strip** — the row of result thumbnails from the current session.
- **Toolbar** — the **Cancel** / **Done** actions.

## Composer position

`composerPlacement` picks which edge the composer sits on:

```html
<uc-ai-enhancer composer-placement="top"></uc-ai-enhancer>
```

| Value | Result |
|---|---|
| `bottom` *(default)* | Composer along the bottom edge. |
| `top` | Composer along the top edge. |

## Canvas fit: docked vs. floating

`canvasFit` decides whether the composer sits **outside** the image or **floats
over** it:

| Value | Result |
|---|---|
| `available` *(default)* | The canvas shrinks to the space left by the composer, which is **docked** outside the image. |
| `full` | The canvas fills the whole area and the composer **floats** over it as an overlay. |

```html
<uc-ai-enhancer canvas-fit="full"></uc-ai-enhancer>
```

## History strip position

`historyPlacement` places the result-thumbnail strip either relative to the
composer or pinned to a canvas edge:

| Value | Result |
|---|---|
| `composer-above` *(default)* | Just above the composer (moves with it). |
| `composer-below` | Just below the composer. |
| `canvas-top` | Pinned to the top edge of the canvas. |
| `canvas-bottom` | Pinned to the bottom edge of the canvas. |

## Toolbar position

`toolbarPlacement` sets the edge for the **Cancel** / **Done** toolbar — `bottom`
(default) or `top`.

```html
<uc-ai-enhancer toolbar-placement="top"></uc-ai-enhancer>
```

## Presets-only mode

`presets-only` hides the free-text prompt so only the preset chips remain — and
picking a chip starts the generation immediately (there's nothing to type, so no
separate send step). Pair it with custom [`presets`](/api/components) per mode.

```html
<uc-ai-enhancer presets-only></uc-ai-enhancer>
```

## Putting it together

These axes are orthogonal — mix them freely. For example, a floating composer
pinned to the top, with the history along the bottom of the canvas:

```html
<uc-ai-enhancer
  composer-placement="top"
  canvas-fit="full"
  history-placement="canvas-bottom"
  toolbar-placement="top"
></uc-ai-enhancer>
```

See every property in the [Components API](/api/components).
