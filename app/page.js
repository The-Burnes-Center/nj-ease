import DocumentValidator from '@/components/DocumentValidator';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-black">
      <DocumentValidator />
    </main>
  );
}