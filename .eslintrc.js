module.exports = {
  env: {
    commonjs: true,
    es6: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    "space-before-function-paren": ["error", "always"],
    semi: ["error", "never"],
    "comma-dangle": ["error", "never"],
    "no-bitwise": ["error", { "allow": ["~", "|", "&", "^", ">>" , "<<", ">>>"] }]
  },
};
