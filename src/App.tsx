import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/hooks/useOrganization";
import { ThemeProvider } from "@/hooks/useTheme";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import DashboardHome from "./pages/DashboardHome";
import GrafotecniaPage from "./pages/GrafotecniaPage";
import HivesPage from "./pages/HivesPage";
import DocumentalPage from "./pages/DocumentalPage";
import LaudosPage from "./pages/LaudosPage";
import PlagioCodigoPage from "./pages/PlagioCodigoPage";
import EmailPstPage from "./pages/EmailPstPage";
import WebCapturePage from "./pages/WebCapturePage";
import SandboxCapturePage from "./pages/SandboxCapturePage";
import ImageAnalysisPage from "./pages/ImageAnalysisPage";
import QuesitosPage from "./pages/QuesitosPage";
import ProfilePage from "./pages/ProfilePage";
import AuditPage from "./pages/AuditPage";
import EvidencesPage from "./pages/EvidencesPage";
import CasesPage from "./pages/CasesPage";
import VerifyPage from "./pages/VerifyPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ShareManagementPage from "./pages/ShareManagementPage";
import SharedViewPage from "./pages/SharedViewPage";
import VersionHistoryPage from "./pages/VersionHistoryPage";
import SmtpSettingsPage from "./pages/SmtpSettingsPage";
import TimelinePage from "./pages/TimelinePage";
import OcrPage from "./pages/OcrPage";
import TemplatesPage from "./pages/TemplatesPage";
import NetworkForensicsPage from "./pages/NetworkForensicsPage";
import EventLogPage from "./pages/EventLogPage";
import ChromePage from "./pages/ChromePage";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import OrganizationPage from "./pages/OrganizationPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Dashboard = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <OrganizationProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Dashboard><DashboardHome /></Dashboard>} />
            <Route path="/dashboard/grafotecnia" element={<Dashboard><GrafotecniaPage /></Dashboard>} />
            <Route path="/dashboard/hives" element={<Dashboard><HivesPage /></Dashboard>} />
            <Route path="/dashboard/documental" element={<Dashboard><DocumentalPage /></Dashboard>} />
            <Route path="/dashboard/laudos" element={<Dashboard><LaudosPage /></Dashboard>} />
            <Route path="/dashboard/plagio-codigo" element={<Dashboard><PlagioCodigoPage /></Dashboard>} />
            <Route path="/dashboard/email-pst" element={<Dashboard><EmailPstPage /></Dashboard>} />
            <Route path="/dashboard/web-capture" element={<Dashboard><WebCapturePage /></Dashboard>} />
            <Route path="/dashboard/sandbox" element={<Dashboard><SandboxCapturePage /></Dashboard>} />
            <Route path="/dashboard/analise-imagem" element={<Dashboard><ImageAnalysisPage /></Dashboard>} />
            <Route path="/dashboard/quesitos" element={<Dashboard><QuesitosPage /></Dashboard>} />
            <Route path="/dashboard/rede" element={<Dashboard><NetworkForensicsPage /></Dashboard>} />
            <Route path="/dashboard/event-log" element={<Dashboard><EventLogPage /></Dashboard>} />
            <Route path="/dashboard/chrome" element={<Dashboard><ChromePage /></Dashboard>} />
            <Route path="/dashboard/perfil" element={<Dashboard><ProfilePage /></Dashboard>} />
            <Route path="/dashboard/auditoria" element={<Dashboard><AuditPage /></Dashboard>} />
            <Route path="/dashboard/evidencias" element={<Dashboard><EvidencesPage /></Dashboard>} />
            <Route path="/dashboard/casos" element={<Dashboard><CasesPage /></Dashboard>} />
            <Route path="/dashboard/analytics" element={<Dashboard><AnalyticsPage /></Dashboard>} />
            <Route path="/dashboard/compartilhar" element={<Dashboard><ShareManagementPage /></Dashboard>} />
            <Route path="/dashboard/versoes" element={<Dashboard><VersionHistoryPage /></Dashboard>} />
            <Route path="/dashboard/email-config" element={<Dashboard><SmtpSettingsPage /></Dashboard>} />
            <Route path="/dashboard/timeline" element={<Dashboard><TimelinePage /></Dashboard>} />
            <Route path="/dashboard/ocr" element={<Dashboard><OcrPage /></Dashboard>} />
            <Route path="/dashboard/templates" element={<Dashboard><TemplatesPage /></Dashboard>} />
            <Route path="/dashboard/organizacao" element={<Dashboard><OrganizationPage /></Dashboard>} />
            <Route path="/verificar" element={<VerifyPage />} />
            <Route path="/compartilhado" element={<SharedViewPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </OrganizationProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
