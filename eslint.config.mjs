import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const NO_DEEP_RELATIVE = {
  group: ["../../*"],
  message: "R-34: import via @/* rather than climbing out of the folder.",
};

const NO_SUPABASE = {
  group: ["@supabase/*"],
  message:
    "R-01: supabase.from() never leaves src/lib/db/. Go through a service, then an RPC wrapper.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "ds-bundle/**",
    ".ds-sync/**",
    ".design-sync/**",
  ]),


  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_DEEP_RELATIVE] }],
    },
  },

  {
    files: ["src/lib/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            NO_DEEP_RELATIVE,
            {
              group: ["react", "react-dom", "react/*", "react-dom/*"],
              message:
                "R-04: src/lib/domain/ is pure. No React. Pass values in, return values out.",
            },
            {
              group: ["next", "next/*"],
              message:
                "R-04: src/lib/domain/ is pure. No next/*. The domain must run in a bare test process.",
            },
            {
              group: ["@supabase/*", "@/lib/db", "@/lib/db/*"],
              message:
                "R-04: src/lib/domain/ is pure. Services call the domain, never the reverse.",
            },
            {
              group: [
                "@/lib/services",
                "@/lib/services/*",
                "@/lib/messaging/*",
                "@/lib/payments/*",
                "@/lib/audit/*",
                "@/components/*",
                "@/app/*",
              ],
              message:
                "R-04: src/lib/domain/ sits at the bottom of the layer stack and imports nothing above it.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "R-04: no I/O in src/lib/domain/. Take the data as an argument.",
        },
      ],
    },
  },

  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_DEEP_RELATIVE, NO_SUPABASE] }],
    },
  },

  {
    files: ["src/app/(console)/**/*.{ts,tsx}", "src/components/console/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            NO_DEEP_RELATIVE,
            NO_SUPABASE,
            {
              group: ["@/components/marketing", "@/components/marketing/*"],
              message:
                "R-08/R-22: decorative libraries live in components/marketing/ and never reach (console).",
            },
            {
              group: ["@/app/(site)/*"],
              message:
                "R-08: (site) and (console) are separate root layouts. No cross-imports.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/app/(site)/**/*.{ts,tsx}", "src/components/marketing/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            NO_DEEP_RELATIVE,
            NO_SUPABASE,
            {
              group: ["@/app/(console)/*", "@/components/console", "@/components/console/*"],
              message:
                "R-08: (site) and (console) are separate root layouts. Console density must not leak into the booking flow.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["src/app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_DEEP_RELATIVE, NO_SUPABASE] }],
    },
  },

  {
    files: ["src/components/ui/carousel.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
