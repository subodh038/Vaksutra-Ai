import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15.x still ships legacy eslintrc-style configs, so they
// must be converted for ESLint 9 flat config via FlatCompat.
const compat = new FlatCompat();

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
