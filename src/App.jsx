import React, { lazy, Suspense } from "react";
import AuthGate from "./AuthGate";
const MunicipalApp = lazy(() => import("./MunicipalApp"));
export default function App() {
  return (
    <AuthGate>
      {(user, onSignOut) => (
        <Suspense
          fallback={
            <div className="loading">
              <p>Cargando tus servicios…</p>
            </div>
          }
        >
          <MunicipalApp key={user.uid} user={user} onSignOut={onSignOut} />
        </Suspense>
      )}
    </AuthGate>
  );
}
