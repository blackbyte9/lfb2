import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#cfd3dd] text-[#131820]">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-5">
        <h1 className="text-[2rem] font-normal leading-none tracking-tight text-[#161b24] sm:text-[2.1rem]">
          Schulbuch Manager
        </h1>
      </main>

      <SiteFooter />
    </div>
  );
}
