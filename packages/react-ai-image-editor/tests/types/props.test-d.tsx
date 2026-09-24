import type { AspectRatio, UcAiImageEditor } from '@uploadcare/ai-image-editor';
import type { LitElement } from 'lit';
// `jsx: react` in this package's tsconfig, so the classic transform needs it
// in scope — the same import a consumer on that setting writes.
import React, { type Ref } from 'react';
import { expectTypeOf, test } from 'vitest';
import { AiImageEditor, type AiImageEditorProps } from '../../src';

/**
 * The wrapper derives its props from the element, which keeps them in step but
 * means nothing states what the surface actually is. These tests do: every
 * member the element publishes has to be listed below as a prop or as a
 * method, so adding either to the element fails here until someone decides
 * which it is — a method silently becoming a prop is the failure this catches.
 */

/** Everything `<uc-ai-image-editor>` adds on top of `LitElement`. */
type ElementMembers = keyof Omit<UcAiImageEditor, keyof LitElement>;

/** Props the wrapper owns; the element has no say in them. */
type WrapperOnlyProps =
  | 'apiRef'
  | 'className'
  | 'composerAutoHide'
  | 'fallback'
  | 'onCancel'
  | 'onChange'
  | 'onDone'
  | 'onError';

/** Element members reachable as props. */
type ElementProps = Exclude<keyof AiImageEditorProps, WrapperOnlyProps>;

/** Element members that are methods, reached through `apiRef` instead. */
type ElementMethods = 'invalidateAuthToken';

test('every element option is a prop', () => {
  expectTypeOf<ElementProps>().toEqualTypeOf<
    | 'pubkey'
    | 'sourceUuid'
    | 'sourceFileInfo'
    | 'outputFilename'
    | 'metadata'
    | 'authToken'
    | 'cacheAuthToken'
    | 'baseUrl'
    | 'cdnCname'
    | 'cdnCnamePrefixed'
    | 'secureDeliveryProxyUrlResolver'
    | 'aspectRatios'
    | 'localeName'
    | 'localeDefinitionOverride'
    | 'presetsOnly'
    | 'presets'
    | 'composerPlacement'
    | 'canvasFit'
    | 'sizing'
    | 'historyPlacement'
    | 'toolbarPlacement'
  >();
});

test('every element member is either a prop or a method', () => {
  // The exhaustiveness check: a new member on the element lands in neither
  // list and this stops compiling.
  expectTypeOf<ElementMembers>().toEqualTypeOf<ElementProps | ElementMethods>();
});

test('methods stay off the props and are reached through apiRef', () => {
  expectTypeOf<AiImageEditorProps>().not.toHaveProperty('invalidateAuthToken');
  expectTypeOf<AiImageEditorProps['apiRef']>().toEqualTypeOf<Ref<UcAiImageEditor> | undefined>();
  expectTypeOf<UcAiImageEditor['invalidateAuthToken']>().toEqualTypeOf<() => void>();
});

test('the props carry the element types, not widened ones', () => {
  expectTypeOf<AiImageEditorProps['pubkey']>().toEqualTypeOf<string>();
  expectTypeOf<AiImageEditorProps['aspectRatios']>().toEqualTypeOf<AspectRatio[] | null | undefined>();
  expectTypeOf<AiImageEditorProps['cacheAuthToken']>().toEqualTypeOf<boolean | undefined>();
  // A token or a function returning one, the same union the element takes.
  expectTypeOf<UcAiImageEditor['authToken']>().toEqualTypeOf<AiImageEditorProps['authToken']>();
});

test('pubkey is required and the rest are not', () => {
  <AiImageEditor pubkey="demopublickey" />;
  // @ts-expect-error `pubkey` is the one prop with no sensible default.
  <AiImageEditor />;
});

test('a wrong prop type is rejected', () => {
  // @ts-expect-error a public key is a string
  <AiImageEditor pubkey={42} />;
  // @ts-expect-error `aspectRatios` is a list, not a single ratio
  <AiImageEditor pubkey="k" aspectRatios={{ w: 1, h: 1 }} />;
  // @ts-expect-error there is no such prop, and a typo should not pass silently
  <AiImageEditor pubkey="k" authtoken="eyJ" />;
});

test('callbacks receive what the events carry', () => {
  <AiImageEditor
    pubkey="k"
    onDone={(detail) => expectTypeOf(detail.file).toBeObject()}
    onChange={(result) => expectTypeOf(result).toEqualTypeOf<Parameters<NonNullable<AiImageEditorProps['onDone']>>[0] | null>()}
    onError={(error) => expectTypeOf(error.code).toBeString()}
    onCancel={() => undefined}
  />;
});
