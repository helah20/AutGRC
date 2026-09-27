import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { Loading } from './components/ui.jsx';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyWork from './pages/MyWork.jsx';
import Generator from './pages/Generator.jsx';
import Documents from './pages/Documents.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import Roles from './pages/Roles.jsx';
import RoleDetail from './pages/RoleDetail.jsx';
import RaciList from './pages/RaciList.jsx';
import RaciBuilder from './pages/RaciBuilder.jsx';
import Controls from './pages/Controls.jsx';
import Frameworks from './pages/Frameworks.jsx';
import Mappings from './pages/Mappings.jsx';
import Evidence from './pages/Evidence.jsx';
import GapAssessments from './pages/GapAssessments.jsx';
import GapAssessmentDetail from './pages/GapAssessmentDetail.jsx';
import Hierarchy from './pages/Hierarchy.jsx';
import Findings from './pages/Findings.jsx';
import Imports from './pages/Imports.jsx';
import Reports from './pages/Reports.jsx';
import SearchPage from './pages/SearchPage.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loading label="Starting AutGRC…" /></div>;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-work" element={<MyWork />} />
        <Route path="/generator" element={<Generator />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/policies" element={<Documents fixedType="policy" />} />
        <Route path="/standards" element={<Documents fixedType="standard" />} />
        <Route path="/procedures" element={<Documents fixedType="procedure" />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/roles/:id" element={<RoleDetail />} />
        <Route path="/raci" element={<RaciList />} />
        <Route path="/raci/:id" element={<RaciBuilder />} />
        <Route path="/controls" element={<Controls />} />
        <Route path="/controls/:id" element={<Controls />} />
        <Route path="/frameworks" element={<Frameworks />} />
        <Route path="/mappings" element={<Mappings />} />
        <Route path="/evidence" element={<Evidence />} />
        <Route path="/gap-assessment" element={<GapAssessments />} />
        <Route path="/gap-assessment/:id" element={<GapAssessmentDetail />} />
        <Route path="/hierarchy" element={<Hierarchy />} />
        <Route path="/findings" element={<Findings />} />
        <Route path="/imports" element={<Imports />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  );
}
