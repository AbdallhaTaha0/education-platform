import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const javaScriptHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: 'var(--ide-keyword)' },
  { tag: [tags.string, tags.regexp], color: 'var(--ide-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--ide-number)' },
  { tag: tags.comment, color: 'var(--ide-comment)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--ide-function)' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--ide-operator)' },
]));
