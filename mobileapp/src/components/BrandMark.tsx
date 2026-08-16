import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export function BrandMark({ size = 42 }: { size?: number }) {
  const tile = size * 0.38;
  const gap = size * 0.08;
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.2 }]}>
      <View style={[styles.tile, { width: tile, height: tile, backgroundColor: colors.coral }]} />
      <View style={[styles.tile, { width: tile, height: tile, marginLeft: gap, backgroundColor: colors.mint }]} />
      <View style={[styles.tile, { width: tile, height: tile, marginTop: gap, backgroundColor: colors.blue }]} />
      <View style={[styles.dot, { width: tile, height: tile, marginLeft: gap, marginTop: gap }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    padding: '8%',
    backgroundColor: colors.text,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: { borderRadius: 2 },
  dot: { borderRadius: 999, backgroundColor: colors.sun },
});