import { beforeAll, describe, it } from 'vitest';

import { defaultHelpers as helpers, result } from 'generator-jhipster/testing';

import entities, { encryptedEntityNames } from './__test-fixtures__/entities.mjs';

const MAIN = 'src/main/java/com/mycompany/myapp';
const TEST = 'src/test/java/com/mycompany/myapp';
const WEBAPP = 'src/main/webapp/app';

/**
 * Integration tests of the whole blueprint.
 *
 * A complete application is generated with entities that use every relationship type, a
 * relationship to the built in `User` entity and a relationship to an entity whose id is not
 * encrypted.
 */
describe('encrypt-id JHipster blueprint', () => {
  beforeAll(async function () {
    await helpers
      .runJHipster('app')
      .withJHipsterConfig({}, entities)
      .withYoRcConfig('generator-jhipster-encrypt-id', {
        encryptIdEnable: true,
        encryptIdType: 'selected',
        encryptIdEntities: encryptedEntityNames,
      })
      .withOptions({
        creationTimestamp: '2024-02-01',
        ignoreNeedlesError: true,
        blueprint: 'encrypt-id',
      })
      .withJHipsterLookup()
      .withParentBlueprintLookup();
  }, 60000);

  describe('cipher', () => {
    it('should write one cipher per encrypted entity and for the user', () => {
      for (const persistClass of ['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma', 'User']) {
        result.assertFile(`${MAIN}/service/cipher/${persistClass}IdCipher.java`);
      }
      result.assertFile(`${MAIN}/service/cipher/IdCipher.java`);
      result.assertFile(`${MAIN}/service/cipher/IdCipherException.java`);
    });

    it('should not write a cipher for an entity without encrypted id', () => {
      result.assertNoFile(`${MAIN}/service/cipher/ZetaIdCipher.java`);
    });

    it('should use the entity name as initialization vector', () => {
      result.assertFileContent(
        `${MAIN}/service/cipher/AlphaIdCipher.java`,
        'super(applicationProperties.getEncryptId().getKey(), "Alpha")',
      );
      result.assertFileContent(`${MAIN}/service/cipher/BetaIdCipher.java`, 'super(applicationProperties.getEncryptId().getKey(), "Beta")');
    });

    it('should report a tampered id as IdCipherException', () => {
      result.assertFileContent(`${MAIN}/service/cipher/IdCipher.java`, 'throw new IdCipherException("Decrypted magic not matched!");');
      result.assertNoFileContent(`${MAIN}/service/cipher/IdCipher.java`, 'throw new RuntimeException');
    });

    it('should add the key to the application properties', () => {
      result.assertFileContent(`${MAIN}/config/ApplicationProperties.java`, 'private final EncryptId encryptId = new EncryptId();');
      result.assertFileContent(`${MAIN}/config/ApplicationProperties.java`, 'public EncryptId getEncryptId()');
      result.assertFileContent('src/main/resources/config/application.yml', /encrypt-id:\n {4}key:/);
    });
  });

  describe('java dto', () => {
    it('should convert the id of an encrypted entity to a string', () => {
      result.assertFileContent(`${MAIN}/service/dto/AlphaDTO.java`, 'private String id;');
      result.assertFileContent(`${MAIN}/service/dto/AlphaDTO.java`, 'public String getId()');
      result.assertFileContent(`${MAIN}/service/dto/AlphaDTO.java`, 'public void setId(String id)');
    });

    it('should not convert a field that only looks like the id', () => {
      result.assertFileContent(`${MAIN}/service/dto/AlphaDTO.java`, 'private Long identifier;');
      result.assertFileContent(`${MAIN}/service/dto/AlphaDTO.java`, 'public Long getIdentifier()');
    });

    it('should keep the id of an entity without encrypted id', () => {
      result.assertFileContent(`${MAIN}/service/dto/ZetaDTO.java`, 'private Long id;');
    });

    it('should convert the dto test', () => {
      result.assertFileContent(`${TEST}/service/dto/AlphaDTOTest.java`, 'alphaDTO1.setId("1");');
      result.assertFileContent(`${TEST}/service/dto/AlphaDTOTest.java`, 'alphaDTO2.setId("2");');
    });
  });

  describe('java mapper', () => {
    const mapper = `${MAIN}/service/mapper/AlphaMapper.java`;

    it('should be an abstract class, an interface cannot hold the ciphers', () => {
      result.assertFileContent(mapper, 'public abstract class AlphaMapper implements EntityMapper<AlphaDTO, Alpha>');
      result.assertNoFileContent(mapper, 'public interface AlphaMapper');
    });

    it('should not declare default methods, they are illegal in a class', () => {
      result.assertNoFileContent(mapper, /^\s*default /m);
      result.assertFileContent(mapper, /public Set<EpsilonDTO> toDtoEpsilonIdSet\(Set<Epsilon> epsilon\)/);
    });

    it('should encrypt and decrypt the id of the entity itself', () => {
      result.assertFileContent(mapper, '@Mapping(target = "id", expression = "java(alphaIdCipher.encrypt(s.getId()))")');
      result.assertFileContent(mapper, '@Mapping(target = "id", expression = "java(alphaIdCipher.decrypt(alphaDTO.getId()))")');
    });

    it('should use the parameter name of the generated method inside the expression', () => {
      // MapStruct copies the expression verbatim, a different name does not compile.
      result.assertFileContent(mapper, /decrypt\((\w+)\.getId\(\)\)\)"\)\s*public abstract Alpha toEntity\(AlphaDTO \1\);/);
      result.assertFileContent(mapper, /encrypt\((\w+)\.getId\(\)\)\)"\)\s*public abstract AlphaDTO toDto\(Alpha \1\);/);
    });

    it('should encrypt the id of a One-to-One relationship', () => {
      result.assertFileContent(mapper, '@Mapping(target = "id", expression = "java(betaIdCipher.encrypt(beta.getId()))")');
      result.assertFileContent(mapper, 'public abstract BetaDTO toDtoBetaId(Beta beta);');
    });

    it('should encrypt the id of a Many-to-One relationship', () => {
      result.assertFileContent(mapper, '@Mapping(target = "id", expression = "java(gammaIdCipher.encrypt(gamma.getId()))")');
    });

    it('should encrypt the id of a Many-to-Many relationship', () => {
      result.assertFileContent(mapper, '@Mapping(target = "id", expression = "java(epsilonIdCipher.encrypt(epsilon.getId()))")');
    });

    it('should encrypt the id of a relationship to the user', () => {
      result.assertFileContent(mapper, '@Mapping(target = "id", expression = "java(userIdCipher.encrypt(user.getId()))")');
    });

    it('should encrypt the id of the owning side of a One-to-Many relationship', () => {
      result.assertFileContent(
        `${MAIN}/service/mapper/DeltaMapper.java`,
        '@Mapping(target = "id", expression = "java(alphaIdCipher.encrypt(alpha.getId()))")',
      );
    });

    it('should decrypt the ids of the related entities', () => {
      result.assertFileContent(mapper, '@Mapping(target = "id", expression = "java(betaIdCipher.decrypt(dto.getId()))")');
      result.assertFileContent(mapper, 'public abstract Beta toEntityBeta(BetaDTO dto);');
      result.assertFileContent(mapper, 'public abstract Gamma toEntityGamma(GammaDTO dto);');
      result.assertFileContent(mapper, 'public abstract Epsilon toEntityEpsilon(EpsilonDTO dto);');
      result.assertFileContent(mapper, 'public abstract User toEntityUser(UserDTO dto);');
    });

    it('should not expose the plain id of a related entity', () => {
      for (const persistClass of ['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma']) {
        result.assertNoFileContent(
          `${MAIN}/service/mapper/${persistClass}Mapper.java`,
          /@Mapping\(target = "id", source = "id"\)\s*public abstract (?!ZetaDTO)/,
        );
      }
    });

    it('should keep the plain id of a relationship to an entity without encrypted id', () => {
      result.assertFileContent(mapper, /@Mapping\(target = "id", source = "id"\)\s*public abstract ZetaDTO toDtoZetaId/);
      result.assertNoFileContent(mapper, 'toEntityZeta');
      result.assertNoFileContent(mapper, 'ZetaIdCipher');
    });

    it('should never write the encrypted id during a partial update', () => {
      result.assertFileContent(
        mapper,
        /@Mapping\(target = "id", ignore = true\)\s*public abstract void partialUpdate\(@MappingTarget Alpha entity, AlphaDTO dto\);/,
      );
    });

    it('should inject a cipher per referenced entity', () => {
      for (const persistClass of ['Alpha', 'Beta', 'Epsilon', 'Gamma', 'User']) {
        const field = `${persistClass.charAt(0).toLowerCase()}${persistClass.slice(1)}IdCipher`;
        result.assertFileContent(mapper, `import com.mycompany.myapp.service.cipher.${persistClass}IdCipher;`);
        result.assertFileContent(mapper, `protected ${persistClass}IdCipher ${field};`);
        result.assertFileContent(mapper, `public void set${persistClass}IdCipher(${persistClass}IdCipher ${field})`);
      }
    });

    it('should add the id mapping to a mapper without relationships in the dto', () => {
      const betaMapper = `${MAIN}/service/mapper/BetaMapper.java`;
      result.assertFileContent(betaMapper, '@Mapping(target = "id", expression = "java(betaIdCipher.encrypt(s.getId()))")');
      result.assertFileContent(betaMapper, '@Mapping(target = "id", expression = "java(betaIdCipher.decrypt(dto.getId()))")');
      result.assertFileContent(betaMapper, 'public abstract BetaDTO toDto(Beta s);');
      result.assertFileContent(betaMapper, 'public abstract Beta toEntity(BetaDTO dto);');
    });

    it('should leave the mapper of an entity without encrypted id untouched', () => {
      const zetaMapper = `${MAIN}/service/mapper/ZetaMapper.java`;
      result.assertFileContent(zetaMapper, 'public interface ZetaMapper extends EntityMapper<ZetaDTO, Zeta>');
      result.assertNoFileContent(zetaMapper, 'IdCipher');
    });

    it('should set every cipher used by the mapper in the mapper test', () => {
      const mapperTest = `${TEST}/service/mapper/AlphaMapperTest.java`;
      result.assertFileContent(mapperTest, 'applicationProperties.getEncryptId().setKey("test");');
      for (const persistClass of ['Alpha', 'Beta', 'Epsilon', 'Gamma', 'User']) {
        result.assertFileContent(mapperTest, `alphaMapper.set${persistClass}IdCipher(new ${persistClass}IdCipher(applicationProperties));`);
      }
    });
  });

  describe('java resource', () => {
    const resource = `${MAIN}/web/rest/AlphaResource.java`;

    it('should accept the encrypted id as path variable', () => {
      result.assertFileContent(resource, '@PathVariable("id") String id');
      result.assertNoFileContent(resource, /\bLong id\b/);
    });

    it('should decrypt the id before using the repository', () => {
      result.assertFileContent(resource, 'alphaRepository.existsById(alphaIdCipher.decrypt(id))');
    });

    it('should keep the resource of an entity without encrypted id untouched', () => {
      result.assertFileContent(`${MAIN}/web/rest/ZetaResource.java`, '@PathVariable("id") Long id');
      result.assertNoFileContent(`${MAIN}/web/rest/ZetaResource.java`, 'IdCipher');
    });
  });

  describe('java service', () => {
    it('should accept the encrypted id', () => {
      result.assertFileContent(`${MAIN}/service/AlphaService.java`, 'Optional<AlphaDTO> findOne(String id);');
      result.assertFileContent(`${MAIN}/service/AlphaService.java`, 'void delete(String id);');
    });

    it('should decrypt the id before using the repository', () => {
      const serviceImpl = `${MAIN}/service/impl/AlphaServiceImpl.java`;
      result.assertFileContent(serviceImpl, 'alphaRepository.deleteById(alphaIdCipher.decrypt(id))');
      result.assertFileContent(serviceImpl, 'alphaIdCipher.decrypt(alphaDTO.getId())');
      result.assertFileContent(serviceImpl, 'alphaRepository.findOneWithEagerRelationships(alphaIdCipher.decrypt(id))');
    });
  });

  describe('java resource integration test', () => {
    const resourceIT = `${TEST}/web/rest/AlphaResourceIT.java`;

    it('should autowire the cipher', () => {
      result.assertFileContent(resourceIT, 'import com.mycompany.myapp.service.cipher.AlphaIdCipher;');
      result.assertFileContent(resourceIT, 'private AlphaIdCipher alphaIdCipher;');
    });

    it('should call the api with an encrypted id', () => {
      result.assertFileContent(resourceIT, 'get(ENTITY_API_URL_ID, alphaIdCipher.encrypt(alpha.getId()))');
      result.assertFileContent(resourceIT, 'delete(ENTITY_API_URL_ID, alphaIdCipher.encrypt(alpha.getId()))');
      result.assertFileContent(resourceIT, 'get(ENTITY_API_URL_ID, alphaIdCipher.encrypt(Long.MAX_VALUE))');
      result.assertFileContent(resourceIT, 'put(ENTITY_API_URL_ID, alphaIdCipher.encrypt(longCount.incrementAndGet()))');
    });

    it('should not encrypt an id that already comes from the dto', () => {
      result.assertFileContent(resourceIT, 'put(ENTITY_API_URL_ID, alphaDTO.getId())');
      result.assertNoFileContent(resourceIT, 'encrypt(alphaDTO.getId())');
    });

    it('should expect an encrypted id in the response', () => {
      result.assertFileContent(resourceIT, 'jsonPath("$.id").value(alphaIdCipher.encrypt(alpha.getId()))');
      result.assertFileContent(resourceIT, 'jsonPath("$.[*].id").value(hasItem(alphaIdCipher.encrypt(alpha.getId())))');
      result.assertNoFileContent(resourceIT, 'alpha.getId().intValue()');
    });

    it('should send an encrypted id for a partial update', () => {
      result.assertFileContent(resourceIT, 'patch(ENTITY_API_URL_ID, alphaIdCipher.encrypt(partialUpdatedAlpha.getId()))');
      result.assertFileContent(resourceIT, 'om.writeValueAsBytes(alphaMapper.toDto(partialUpdatedAlpha))');
    });

    it('should keep the integration test of an entity without encrypted id untouched', () => {
      result.assertNoFileContent(`${TEST}/web/rest/ZetaResourceIT.java`, 'IdCipher');
    });
  });

  describe('java user', () => {
    it('should encrypt the id of the user dto', () => {
      result.assertFileContent(`${MAIN}/service/dto/UserDTO.java`, 'private String id;');
      result.assertFileContent(`${MAIN}/service/dto/UserDTO.java`, 'this.id = userIdCipher.encrypt(user.getId())');
      result.assertFileContent(`${MAIN}/service/dto/AdminUserDTO.java`, 'private String id;');
      result.assertFileContent(`${MAIN}/service/dto/AdminUserDTO.java`, 'this.id = userIdCipher.encrypt(user.getId())');
    });

    it('should encrypt and decrypt the id in the user mapper', () => {
      const userMapper = `${MAIN}/service/mapper/UserMapper.java`;
      result.assertFileContent(userMapper, 'user.setId(userIdCipher.decrypt(userDTO.getId()));');
      result.assertFileContent(userMapper, 'userDto.setId(userIdCipher.encrypt(user.getId()));');
    });

    it('should decrypt the id in the user service', () => {
      result.assertFileContent(`${MAIN}/service/UserService.java`, 'userIdCipher.decrypt(userDTO.getId())');
    });

    it('should pass the cipher to every user dto', () => {
      result.assertNoFileContent(`${MAIN}/service/UserService.java`, 'AdminUserDTO::new');
      result.assertNoFileContent(`${MAIN}/service/UserService.java`, 'UserDTO::new');
      result.assertNoFileContent(`${MAIN}/web/rest/UserResource.java`, 'AdminUserDTO::new');
      result.assertNoFileContent(`${MAIN}/web/rest/AccountResource.java`, 'AdminUserDTO::new');
    });

    it('should compare the encrypted id only for the dto', () => {
      const userResourceIT = `${TEST}/web/rest/UserResourceIT.java`;
      result.assertFileContent(userResourceIT, 'assertThat(userDTO.getId()).isEqualTo(userIdCipher.encrypt(DEFAULT_ID));');
      result.assertFileContent(userResourceIT, 'assertThat(user.getId()).isEqualTo(DEFAULT_ID);');
    });

    it('should pass the cipher to the user mapper test', () => {
      result.assertFileContent(`${TEST}/service/mapper/UserMapperTest.java`, 'userMapper = new UserMapper(userIdCipher);');
      result.assertFileContent(`${TEST}/service/mapper/UserMapperTest.java`, 'new AdminUserDTO(user, userIdCipher)');
    });
  });

  describe('angular model', () => {
    it('should use a string id for an encrypted entity', () => {
      result.assertFileContent(`${WEBAPP}/entities/alpha/alpha.model.ts`, 'id: string;');
    });

    it('should keep the number id of an entity without encrypted id', () => {
      result.assertFileContent(`${WEBAPP}/entities/zeta/zeta.model.ts`, 'id: number;');
    });

    it('should use a string id for the user', () => {
      result.assertFileContent(`${WEBAPP}/entities/user/user.model.ts`, 'id: string;');
      result.assertFileContent(`${WEBAPP}/admin/user-management/user-management.model.ts`, 'id: string | null');
    });
  });

  describe('angular service', () => {
    it('should use a string id for an encrypted entity', () => {
      const service = `${WEBAPP}/entities/alpha/service/alpha.service.ts`;
      result.assertFileContent(service, 'find(id: string)');
      result.assertFileContent(service, 'delete(id: string)');
      result.assertFileContent(service, /getAlphaIdentifier\(alpha: Pick<IAlpha, 'id'>\): string/);
    });

    it('should use a string id for the user', () => {
      result.assertFileContent(`${WEBAPP}/entities/user/service/user.service.ts`, 'find(id: string)');
      result.assertFileContent(`${WEBAPP}/entities/user/service/user.service.ts`, /getUserIdentifier\(user: Pick<IUser, 'id'>\): string/);
    });

    it('should keep the number id of an entity without encrypted id', () => {
      result.assertFileContent(`${WEBAPP}/entities/zeta/service/zeta.service.ts`, 'find(id: number)');
    });
  });

  describe('angular components', () => {
    it('should track an encrypted entity by a string id', () => {
      result.assertFileContent(`${WEBAPP}/entities/alpha/list/alpha.component.ts`, /trackId = \(_index: number, item: IAlpha\): string/);
      result.assertFileContent(`${WEBAPP}/admin/user-management/list/user-management.component.ts`, 'item: User): string');
    });

    it('should delete an encrypted entity by a string id', () => {
      result.assertFileContent(`${WEBAPP}/entities/alpha/delete/alpha-delete-dialog.component.ts`, 'confirmDelete(id: string)');
    });

    it('should not turn the number fields of the update form into text fields', () => {
      result.assertFileContent(`${WEBAPP}/entities/alpha/update/alpha-update.component.html`, /<input type="number"[^>]*name="counter"/);
    });
  });

  describe('angular tests', () => {
    it('should use string ids in the test samples', () => {
      result.assertFileContent(`${WEBAPP}/entities/alpha/alpha.test-samples.ts`, /id: '\d+'/);
      result.assertNoFileContent(`${WEBAPP}/entities/alpha/alpha.test-samples.ts`, /id: \d+/);
      result.assertFileContent(`${WEBAPP}/entities/user/user.test-samples.ts`, /id: '\d+'/);
    });

    it('should keep number ids in the test samples of an entity without encrypted id', () => {
      result.assertFileContent(`${WEBAPP}/entities/zeta/zeta.test-samples.ts`, /id: \d+/);
    });

    it('should use string ids in the service test', () => {
      const serviceSpec = `${WEBAPP}/entities/alpha/service/alpha.service.spec.ts`;
      result.assertFileContent(serviceSpec, "service.find('123')");
      result.assertFileContent(serviceSpec, "service.delete('123')");
      result.assertNoFileContent(serviceSpec, /"id":\d+/);
    });

    it('should use string ids in the route test', () => {
      const routeSpec = `${WEBAPP}/entities/alpha/route/alpha-routing-resolve.service.spec.ts`;
      result.assertFileContent(routeSpec, "{ id: '123' }");
      result.assertNoFileContent(routeSpec, /\{ id: \d+ \}/);
    });

    it('should use string ids in the delete dialog test', () => {
      const deleteSpec = `${WEBAPP}/entities/alpha/delete/alpha-delete-dialog.component.spec.ts`;
      result.assertFileContent(deleteSpec, "comp.confirmDelete('123')");
      result.assertFileContent(deleteSpec, "expect(service.delete).toHaveBeenCalledWith('123')");
    });

    it('should use string ids in the component tests', () => {
      for (const path of [
        `${WEBAPP}/entities/alpha/detail/alpha-detail.component.spec.ts`,
        `${WEBAPP}/entities/alpha/list/alpha.component.spec.ts`,
        `${WEBAPP}/entities/alpha/update/alpha-update.component.spec.ts`,
      ]) {
        result.assertFileContent(path, /"id":"\d+"/);
      }
    });

    it('should use string ids for the encrypted relationships of the update test', () => {
      const updateSpec = `${WEBAPP}/entities/alpha/update/alpha-update.component.spec.ts`;
      result.assertFileContent(updateSpec, /const beta\s*: IBeta = \{"id":"\d+"\}/);
      result.assertFileContent(updateSpec, /const user\s*: IUser = \{"id":"\d+"\}/);
    });

    it('should keep number ids for the relationships to entities without encrypted id', () => {
      const updateSpec = `${WEBAPP}/entities/alpha/update/alpha-update.component.spec.ts`;
      result.assertFileContent(updateSpec, /const zeta\s*: IZeta = \{"id":\d+\}/);
    });
  });
});
