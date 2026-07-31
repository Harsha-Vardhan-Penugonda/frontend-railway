import { Routes, Route, Link } from 'react-router-dom';
import GeneratorPage from './pages/GeneratorPage';
import DashboardPage from './pages/DashboardPage';
import RecordPage from './pages/RecordPage';
import AddTrainPage from './pages/AddTrainPage';

export default function App() {
  return (
    <div>
      <nav className="bg-gray-800 text-white text-sm px-4 py-2 flex gap-4">
        <Link to="/" className="hover:underline">Generator</Link>
        <Link to="/admin" className="hover:underline">Audio Dashboard</Link>
        <Link to="/add-train" className="hover:underline">Add Train</Link>
      </nav>
      <Routes>
        <Route path="/" element={<GeneratorPage />} />
        <Route path="/admin" element={<DashboardPage />} />
        <Route path="/record/:key" element={<RecordPage />} />
        <Route path="/add-train" element={<AddTrainPage />} />
      </Routes>
    </div>
  );
}
