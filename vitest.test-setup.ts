import { fileURLToPath } from 'node:url';

import { defineDefaults } from 'generator-jhipster/testing';

await defineDefaults({
  blueprint: 'generator-jhipster-encrypt-id',
  blueprintPackagePath: fileURLToPath(new URL('./', import.meta.url)),
});
