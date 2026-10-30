import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
