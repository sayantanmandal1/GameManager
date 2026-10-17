import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export function BrandMark({ size = 42 }: { size?: number }) {
  // Whole-pixel metrics keep the 2x2 grid from wrapping; percentage padding
  // would resolve against the parent's width, not the mark's.
  const pad = Math.round(size * 0.08);
  const gap = Math.round(size * 0.08);
  const tile = Math.floor((size - pad * 2 - gap) / 2);
  return (
    <View
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.2, padding: pad }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.tile, { width: tile, height: tile, backgroundColor: colors.coral }]} />
      <View style={[styles.tile, { width: tile, height: tile, marginLeft: gap, backgroundColor: colors.mint }]} />
      <View style={[styles.tile, { width: tile, height: tile, marginTop: gap, backgroundColor: colors.blue }]} />
      <View style={[styles.dot, { width: tile, height: tile, marginLeft: gap, marginTop: gap }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.text,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: { borderRadius: 2 },
  dot: { borderRadius: 999, backgroundColor: colors.sun },
});