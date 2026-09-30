/**
 * FAYQ brand mark.
 *
 * Thin compatibility wrapper over the canonical `Wordmark` component, so every
 * existing import renders the same approved mark without duplicated markup.
 */
import { Wordmark } from './Wordmark';

export interface BrandMarkProps {
  /** `sm` for inline/auth contexts, `md` for a dedicated panel. */
  size?: 'sm' | 'md';
  /** Show the localized slogan under the name. */
  withSlogan?: boolean;
}

export function BrandMark({ size = 'sm', withSlogan = true }: BrandMarkProps): JSX.Element {
  if (size === 'md') {
    return (
      <div className="text-center">
        <Wordmark variant="full" markSize={48} />
        {!withSlogan ? null : null}
      </div>
    );
  }
  return <Wordmark variant="compact" markSize={36} />;
}
