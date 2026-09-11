import { Suspense } from "react";
import { LoginScreen } from "./login-screen";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
