import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './runtime.android';

registerWidgetTaskHandler(widgetTaskHandler);
