import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthProvider from "./context/AuthContext";
import DataProvider from "./context/DataContext";
import CrmProvider from "./context/CrmContext";
import TeamProvider from "./context/TeamContext";
import ProductProvider from "./context/ProductContext";
import PricingProvider from "./context/PricingContext";
import UploadProvider from "./context/UploadContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DataProvider>
            <CrmProvider>
              <ProductProvider>
                <TeamProvider>
                    <PricingProvider>
                    <UploadProvider>
                      <App />
                    </UploadProvider>
                  </PricingProvider>
                </TeamProvider>
              </ProductProvider>
            </CrmProvider>
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
