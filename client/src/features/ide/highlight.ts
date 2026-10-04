import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const ideHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.name, color: 'var(--color-ink)' },
  { tag: [tags.keyword, tags.modifier], color: 'var(--ide-keyword)' },
  { tag: [tags.string, tags.regexp, tags.attributeValue, tags.color, tags.url, tags.atom], color: 'var(--ide-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.unit], color: 'var(--ide-number)' },
  { tag: tags.comment, color: 'var(--ide-comment)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--ide-function)' },
  { tag: [tags.operator, tags.punctuation], color: 'var(--ide-operator)' },
  { tag: tags.tagName, color: 'var(--ide-tag)' },
  { tag: tags.attributeName, color: 'var(--ide-attribute)' },
  { tag: tags.propertyName, color: 'var(--ide-property)' },
  { tag: [tags.className, tags.labelName], color: 'var(--ide-selector)' },
  { tag: [tags.typeName, tags.namespace, tags.standard(tags.variableName)], color: 'var(--ide-builtin)' },
  { tag: [tags.meta, tags.annotation, tags.processingInstruction], color: 'var(--ide-meta)' },
  { tag: tags.self, color: 'var(--ide-keyword)' },
  { tag: tags.invalid, color: 'var(--ide-invalid)', textDecoration: 'underline' },
]));
