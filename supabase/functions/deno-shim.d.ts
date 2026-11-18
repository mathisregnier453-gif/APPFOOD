// Déclarations minimales de l'API Deno, uniquement pour le typecheck via tsc (Node).
// En production, les fonctions tournent sur le Supabase Edge Runtime (Deno).
declare namespace Deno {
  const env: { get(key: string): string | undefined };
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}
