module.exports = {
  env: {
    es2021: true,
    node: true
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: ["build/"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  rules: {
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "indent": ["warn", 2, { "SwitchCase": 1 }],
    "no-self-assign": "off",
    "no-trailing-spaces": "warn",
    "object-curly-spacing": ["warn", "always"],
    "prefer-template": "warn",
    "quotes": ["warn", "double", { "avoidEscape": true, "allowTemplateLiterals": true }],
    "require-await": "warn",
    "semi": "warn",
    "no-console": "warn",
    "eol-last": ["warn", "always"]
  }
};
