module.exports = {
  // Configuración Jest para Node.js CLI tool
  testEnvironment: 'node',

  // Patrones de archivos de test
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.spec.js', '**/__tests__/**/*.js'],

  // Configuración de coverage
  collectCoverageFrom: ['src/**/*.js', '!**/node_modules/**', '!**/tests/**'],

  // Threshold mínimo de coverage
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Formato de reportes de coverage
  coverageReporters: ['text', 'html', 'lcov'],

  // Directorio para reportes de coverage
  coverageDirectory: 'coverage',

  // Limpiar mocks automáticamente después de cada test
  clearMocks: true,

  // Restaurar mocks automáticamente después de cada test
  restoreMocks: true,

  // Configuración adicional para mejor output
  verbose: true,

  // Configuración de timeout para tests
  testTimeout: 10000
};
