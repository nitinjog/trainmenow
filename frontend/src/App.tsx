import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './stores/userStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import OnboardingPage from './pages/OnboardingPage';
import LearnPage from './pages/LearnPage';
import QuizPage from './pages/QuizPage';
import CertificatePage from './pages/CertificatePage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useUserStore();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/onboarding" element={<PrivateRoute><OnboardingPage /></PrivateRoute>} />
        <Route path="/learn/:moduleId" element={<PrivateRoute><LearnPage /></PrivateRoute>} />
        <Route path="/quiz/:moduleId" element={<PrivateRoute><QuizPage /></PrivateRoute>} />
        <Route path="/certificate/:id" element={<PrivateRoute><CertificatePage /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
