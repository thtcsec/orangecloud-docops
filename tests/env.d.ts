declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}

type D1Migration = {
  name: string;
  queries: string[];
};
