import { Redirect, useLocalSearchParams } from 'expo-router';
import ChatAuditor from '../../components/ChatAuditor';
import SectionSwipe from '../../components/SectionSwipe';
import { Screen } from '../../components/ui';

export default function Gimnasio() {
  const { folderId } = useLocalSearchParams();
  if (folderId != null) return <Redirect href={{ pathname: '/gimnasio/ideas', params: { folderId } }} />;
  return <SectionSwipe index={2}><Screen safeTop><ChatAuditor root /></Screen></SectionSwipe>;
}
