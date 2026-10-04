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
        .withJHipsterGenerators()
        .withConfiguredBlueprint();
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
        .withJHipsterGenerators()
        .withConfiguredBlueprint();

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

    it('should allow filtering for an entity with encrypted id', async () => {
      await runWithEntity({
        name: 'Alpha',
        enableEncryptId: true,
        dto: 'mapstruct',
        service: 'serviceImpl',
        jpaMetamodelFiltering: true,
        fields: [],
      });

      // The criteria and the query service are written by spring-boot, see encrypt-id-filtering.spec.js.
      result.assertFile('src/main/java/com/mycompany/myapp/service/cipher/EncryptedIdFilter.java');
      result.assertFileContent(
        'src/main/java/com/mycompany/myapp/service/cipher/AlphaIdCipher.java',
        'public LongFilter decryptFilter(EncryptedIdFilter<AlphaIdCipher> filter)',
      );
    });

    it('should allow range operators on filters by an encrypted id when enabled', async () => {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [
          { name: 'Alpha', enableEncryptId: true, dto: 'mapstruct', service: 'serviceImpl', jpaMetamodelFiltering: true, fields: [] },
        ])
        .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true, encryptIdRangeFilter: true })
        .withJHipsterGenerators()
        .withConfiguredBlueprint();

      result.assertFileContent(
        'src/main/java/com/mycompany/myapp/service/cipher/EncryptedIdFilter.java',
        'public class EncryptedIdFilter<C extends IdCipher> extends RangeFilter<String>',
      );
    });

    it('should reject range operators on filters by an encrypted id by default', async () => {
      await runWithEntity({
        name: 'Alpha',
        enableEncryptId: true,
        dto: 'mapstruct',
        service: 'serviceImpl',
        jpaMetamodelFiltering: true,
        fields: [],
      });

      result.assertFileContent(
        'src/main/java/com/mycompany/myapp/service/cipher/EncryptedIdFilter.java',
        'public class EncryptedIdFilter<C extends IdCipher> extends Filter<String>',
      );
    });

    it('should reject filtering by an encrypted id in a reactive application', async () => {
      await expect(
        helpers
          .run(SUB_GENERATOR_NAMESPACE)
          .withJHipsterConfig({ reactive: true }, [
            { name: 'Alpha', enableEncryptId: true, dto: 'mapstruct', service: 'serviceImpl', jpaMetamodelFiltering: true, fields: [] },
          ])
          .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true })
          .withJHipsterGenerators()
          .withConfiguredBlueprint(),
      ).rejects.toThrow('Filtering by an encrypted id is not supported in a reactive application (entity Alpha)');
    });

    it('should allow filtering for an entity without encrypted id', async () => {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [{ name: 'Zeta', dto: 'mapstruct', service: 'serviceImpl', jpaMetamodelFiltering: true, fields: [] }])
        .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true })
        .withJHipsterGenerators()
        .withConfiguredBlueprint();

      result.assertNoFile('src/main/java/com/mycompany/myapp/service/cipher/ZetaIdCipher.java');
    });

    it('should enable the encryption for the entities passed as option', async () => {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [{ name: 'Alpha', dto: 'mapstruct', service: 'serviceImpl', fields: [] }])
        .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true, encryptIdEntities: ['Alpha'] })
        .withJHipsterGenerators()
        .withConfiguredBlueprint();

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
        .withJHipsterGenerators()
        .withConfiguredBlueprint();

      result.assertFile('src/main/java/com/mycompany/myapp/service/cipher/AlphaIdCipher.java');
      result.assertNoFile('src/main/java/com/mycompany/myapp/service/cipher/ZetaIdCipher.java');
    });

    it('should always write the cipher of the user', async () => {
      await helpers
        .run(SUB_GENERATOR_NAMESPACE)
        .withJHipsterConfig({}, [{ name: 'Alpha', dto: 'mapstruct', service: 'serviceImpl', fields: [] }])
        .withOptions({ creationTimestamp: '2024-02-01', ignoreNeedlesError: true, encryptIdEntities: ['Alpha'] })
        .withJHipsterGenerators()
        .withConfiguredBlueprint();

      result.assertFile('src/main/java/com/mycompany/myapp/service/cipher/UserIdCipher.java');
    });
  });
});
