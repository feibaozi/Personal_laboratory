import { HashRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './app/page';
import { WardrobePage } from './app/wardrobe/page';
import { StylistPage } from './app/stylist/page';
import { BoardPage } from './app/board/page';
import { CalendarPage } from './app/calendar/page';
import { PackingPage } from './app/packing/page';
import { ShoppingPage } from './app/shopping/page';
import { SettingsPage } from './app/settings/page';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/wardrobe" element={<WardrobePage />} />
          <Route path="/stylist" element={<StylistPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/packing" element={<PackingPage />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
