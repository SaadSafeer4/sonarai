import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';

export default function App() {
  return (
    <div className="app">
      <Header />
      <main><Outlet /></main>
      <Footer />
    </div>
  );
}
