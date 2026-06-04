import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastContainer } from './components/Toast';
import Store from './pages/Store';
import Detail from './pages/Detail';
import SkillDetail from './pages/SkillDetail';
import Library from './pages/Library';
import Inspector from './pages/Inspector';
import History from './pages/History';
import Settings from './pages/Settings';

function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/store" replace />} />
          <Route path="/store" element={<Store />} />
          {/* MCP Server 详情 */}
          <Route path="/detail/:source/:id" element={<Detail />} />
          {/* Skill 详情 */}
          <Route path="/skill/:id" element={<SkillDetail />} />
          {/* 兼容旧的 URL 格式 */}
          <Route path="/detail/:id" element={<Navigate to="/store" replace />} />
          {/* Library (原 Installed) */}
          <Route path="/library" element={<Library />} />
          <Route path="/installed" element={<Navigate to="/library" replace />} />
          <Route path="/inspector" element={<Inspector />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      <ToastContainer />
    </>
  );
}

export default App;
