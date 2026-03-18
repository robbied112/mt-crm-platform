import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import AuthProvider from "./context/AuthContext";
import DataProvider from "./context/DataContext";
import CrmProvider from "./context/CrmContext";
import PricingProvider from "./context/PricingContext";
import UploadProvider from "./context/UploadContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <CrmProvider>
            <PricingProvider>
              <UploadProvider>
                <App />
              </UploadProvider>
            </PricingProvider>
          </CrmProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
