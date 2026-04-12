import { Suspense } from "react";
import { LoginPage } from "./LoginPage";

export const metadata = {
  title: "Acceso",
};

interface LoginRouteProps {
  params: Promise<{ locale: string }>;
}

export default async function LoginRoute({ params }: LoginRouteProps) {
  const { locale } = await params;

  return (
    <Suspense>
      <LoginPage locale={locale} />
    </Suspense>
  );
}
