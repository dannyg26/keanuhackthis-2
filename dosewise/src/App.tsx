import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import RequireAuth from "./components/RequireAuth";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RiskEngine from "./pages/RiskEngine";
import Adherence from "./pages/Adherence";
import Bills from "./pages/Bills";
import MedGuide from "./pages/MedGuide";
import Savings from "./pages/Savings";
import BodyMap from "./pages/BodyMap";
import FindCare from "./pages/FindCare";
import Insurance from "./pages/Insurance";
import Tools from "./pages/Tools";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/risk" element={<RiskEngine />} />
              <Route path="/adherence" element={<Adherence />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/savings" element={<Savings />} />
              <Route path="/body" element={<BodyMap />} />
              <Route path="/medguide" element={<MedGuide />} />
              <Route path="/find-care" element={<FindCare />} />
              <Route path="/insurance" element={<Insurance />} />
              <Route path="/tools" element={<Tools />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
