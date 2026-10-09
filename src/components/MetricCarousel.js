import { ScrollView } from 'react-native';

export default function MetricCarousel({ children, pageWidth, onPageChange }) {
  return <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32} onScroll={(event) => {
    const width = event.nativeEvent.layoutMeasurement.width || pageWidth;
    if (width > 0) onPageChange(Math.round(event.nativeEvent.contentOffset.x / width));
  }}>{children}</ScrollView>;
}
