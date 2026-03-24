/**
 * GrainFilter — inline SVG filter definition for noise grain.
 *
 * Each Boss Deck page that uses grain includes this component INSIDE its
 * .bd-page wrapper. This ensures html2canvas clones the filter def along
 * with the page subtree, so filter: url(#<id>) resolves correctly.
 */
export function GrainFilter({ id }: { id: string }) {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves={3} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
    </svg>
  );
}
