import { useEffect } from 'react';
import { useStore } from './store/store';
import Layout from './components/Layout/Layout';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';

export default function App() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <Layout />
      <ConfirmModal />
    </>
  );
}
