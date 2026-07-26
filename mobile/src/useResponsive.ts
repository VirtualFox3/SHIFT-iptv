import { useWindowDimensions } from 'react-native';

/**
 * One source of truth for layout across iPhone and iPad.
 *
 * Uses useWindowDimensions() (not Dimensions.get()) so everything re-flows on
 * rotation and iPad split-view — Dimensions.get() is captured once at module
 * load and goes stale the moment the window changes.
 */
export interface Responsive {
  width: number;
  height: number;
  isTablet: boolean;
  landscape: boolean;
  gutter: number;       // screen edge padding
  gap: number;          // space between cards
  cardW: number;        // poster width in horizontal rails
  cardH: number;
  numColumns: number;   // columns in grid tabs
  gridCardW: number;    // exact card width so a grid row sits flush
  billboardH: number;
  titleSize: number;    // hero title
  headingSize: number;  // rail headings
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  // Smallest edge >= 600dp is the standard tablet cutoff (covers iPad mini up),
  // and it stays correct in landscape because it ignores orientation.
  const isTablet = Math.min(width, height) >= 600;
  const landscape = width > height;

  const gutter = isTablet ? 28 : 16;
  const gap = isTablet ? 14 : 10;

  const cardW = isTablet ? 172 : 132;
  const cardH = Math.round(cardW * 1.45);

  // Fit as many columns as the width allows, then divide the leftover space back
  // into the cards so rows are flush to both edges instead of ragged.
  const usable = width - gutter * 2;
  const numColumns = Math.max(2, Math.floor((usable + gap) / (cardW + gap)));
  const gridCardW = Math.floor((usable - gap * (numColumns - 1)) / numColumns);

  // A phone billboard is nearly square; on iPad that would eat the whole screen,
  // so go wider/shorter and always cap against the viewport height.
  const billboardH = Math.min(
    Math.round(width * (isTablet ? (landscape ? 0.5 : 0.72) : 1.1)),
    Math.round(height * 0.7),
  );

  return {
    width, height, isTablet, landscape,
    gutter, gap, cardW, cardH, numColumns, gridCardW, billboardH,
    titleSize: isTablet ? 52 : 32,
    headingSize: isTablet ? 22 : 17,
  };
}
