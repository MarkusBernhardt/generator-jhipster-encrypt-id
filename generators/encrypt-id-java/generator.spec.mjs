import { beforeAll, describe, expect, it } from 'vitest';

import { defaultHelpers as helpers, result } from 'generator-jhipster/testing';

const SUB_GENERATOR = 'encrypt-id-java';
const SUB_GENERATOR_NAMESPACE = `jhipster-encrypt-id:${SUB_GENERATOR}`;

describe('SubGenerator encrypt-id-java of encrypt-id JHipster blueprint', () => {
  describe('run', () => {
    beforeAll(async function () {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [
          {
            name: 'Entities',
            enableAudit: true,
            fields: [
              {
                fieldName: 'name',
                fieldType: 'String',
              },
            ],
          },
        ])
        .withOptions({
          creationTimestamp: '2024-02-01',
          ignoreNeedlesError: true,
        })
        .withJHipsterLookup()
        .withParentBlueprintLookup();
    });

    it('should succeed', () => {
      expect(result.getStateSnapshot()).toMatchSnapshot();
    });
  });

  describe('entity configuration', () => {
    const runWithEntity = entity =>
      helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [entity])
        .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true })
        .withJHipsterLookup()
        .withParentBlueprintLookup();

    it('should require mapstruct', async () => {
      await expect(runWithEntity({ name: 'Alpha', enableEncryptId: true, service: 'serviceImpl', fields: [] })).rejects.toThrow(
        'DTO with mapstruct required for entity Alpha',
      );
    });

    it('should require a service implementation', async () => {
      await expect(runWithEntity({ name: 'Alpha', enableEncryptId: true, dto: 'mapstruct', fields: [] })).rejects.toThrow(
        'Service with serviceImpl required for entity Alpha',
      );
    });

    it('should reject filtering, the criteria would expose the plain ids', async () => {
      await expect(
        runWithEntity({
          name: 'Alpha',
          enableEncryptId: true,
          dto: 'mapstruct',
          service: 'serviceImpl',
          jpaMetamodelFiltering: true,
          fields: [],
        }),
      ).rejects.toThrow('Filtering is not supported for entity Alpha with encrypted id');
    });

    it('should allow filtering for an entity without encrypted id', async () => {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [{ name: 'Zeta', dto: 'mapstruct', service: 'serviceImpl', jpaMetamodelFiltering: true, fields: [] }])
        .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true })
        .withJHipsterLookup()
        .withParentBlueprintLookup();

      result.assertNoFile('src/main/java/com/mycompany/myapp/service/cipher/ZetaIdCipher.java');
    });

    it('should enable the encryption for the entities passed as option', async () => {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [{ name: 'Alpha', dto: 'mapstruct', service: 'serviceImpl', fields: [] }])
        .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true, encryptIdEntities: ['Alpha'] })
        .withJHipsterLookup()
        .withParentBlueprintLookup();

      result.assertFile('src/main/java/com/mycompany/myapp/service/cipher/AlphaIdCipher.java');
      result.assertFileContent('.jhipster/Alpha.json', /"enableEncryptId": true/);
    });

    it('should not enable the encryption for the other entities', async () => {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [
          { name: 'Alpha', dto: 'mapstruct', service: 'serviceImpl', fields: [] },
          { name: 'Zeta', dto: 'mapstruct', service: 'serviceImpl', fields: [] },
        ])
        .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true, encryptIdEntities: ['Alpha'] })
        .withJHipsterLookup()
        .withParentBlueprintLookup();

      result.assertFile('src/main/java/com/mycompany/myapp/service/cipher/AlphaIdCipher.java');
      result.assertNoFile('src/main/java/com/mycompany/myapp/service/cipher/ZetaIdCipher.java');
    });

    it('should always write the cipher of the user', async () => {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [{ name: 'Alpha', dto: 'mapstruct', service: 'serviceImpl', fields: [] }])
        .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true, encryptIdEntities: ['Alpha'] })
        .withJHipsterLookup()
        .withParentBlueprintLookup();

      result.assertFile('src/main/java/com/mycompany/myapp/service/cipher/UserIdCipher.java');
    });
  });
});
