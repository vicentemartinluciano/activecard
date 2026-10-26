// La estructura de Biblioteca se comparte con Android y con el detalle de carpeta.
import LibraryContent from './LibraryContent';
import { Screen } from './ui';

export default function DesktopLibraryHome(props) {
  return <Screen><LibraryContent {...props} /></Screen>;
}
