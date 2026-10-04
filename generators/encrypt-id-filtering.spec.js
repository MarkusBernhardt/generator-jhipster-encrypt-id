import { beforeAll, describe, it } from 'vitest';

import { defaultHelpers as helpers, result } from 'generator-jhipster/testing';

import { encryptedEntityNames, filteredEntities } from './__test-fixtures__/entities.js';

const MAIN = 'src/main/java/com/mycompany/myapp';
const TEST = 'src/test/java/com/mycompany/myapp';
const WEBAPP = 'src/main/webapp/app';

/**
 * Integration tests of filtering (`jpaMetamodelFiltering`) together with encrypted ids.
 *
 * A filter on an encrypted id has to take the encrypted id and decrypt it with the cipher of the referenced
 * entity, a plain database id must never be accepted.
 */
describe('encrypt-id JHipster blueprint with filtering', () => {
  beforeAll(async function () {
    await helpers
      .runJHipster('app')
      .withJHipsterConfig({}, filteredEntities)
      .withBlueprintConfig({
        encryptIdEnable: true,
        encryptIdType: 'selected',
        encryptIdEntities: encryptedEntityNames,
      })
      .withOptions({
        creationTimestamp: '2024-02-01',
        ignoreNeedlesError: true,
      })
      .withJHipsterGenerators()
      .withConfiguredBlueprint();
  }, 60000);

  describe('cipher', () => {
    const filter = `${MAIN}/service/cipher/EncryptedIdFilter.java`;

    it('should write the filter for encrypted ids, typed by the cipher of the referenced entity', () => {
      result.assertFileContent(filter, 'public class EncryptedIdFilter<C extends IdCipher> extends Filter<String>');
      result.assertFileContent(filter, 'public EncryptedIdFilter(EncryptedIdFilter<C> filter)');
      result.assertFileContent(filter, 'public EncryptedIdFilter<C> copy()');
      result.assertFile(`${MAIN}/service/cipher/InvalidIdException.java`);
    });

    it('should reject range operators instead of ignoring them', () => {
      for (const operator of ['GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual']) {
        result.assertFileContent(
          filter,
          new RegExp(`@Deprecated\\n\\s*public void set${operator}\\(String \\w+\\) \\{\\n\\s*throw rangeNotSupported\\(\\);`),
        );
      }
    });

    it('should decrypt a filter into a filter on the database ids without a range', () => {
      const cipher = `${MAIN}/service/cipher/IdCipher.java`;
      result.assertFileContent(cipher, 'protected final LongFilter toLongFilter(EncryptedIdFilter<?> filter)');
      result.assertFileContent(cipher, 'decrypted.setIn(decryptValues(filter.getIn()));');
      result.assertFileContent(cipher, 'decrypted.setNotIn(decryptValues(filter.getNotIn()));');
      result.assertFileContent(cipher, 'decrypted.setSpecified(filter.getSpecified());');
      result.assertFileContent(cipher, 'return id == null || id.isEmpty() ? null : decrypt(id);');
      result.assertNoFileContent(cipher, /setGreaterThan|setLessThan/);
    });

    it('should decrypt a filter only with the cipher of the entity the ids belong to', () => {
      for (const persistClass of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'User']) {
        result.assertFileContent(
          `${MAIN}/service/cipher/${persistClass}IdCipher.java`,
          `public LongFilter decryptFilter(EncryptedIdFilter<${persistClass}IdCipher> filter) {`,
        );
      }
      result.assertNoFile(`${MAIN}/service/cipher/ZetaIdCipher.java`);
    });

    it('should test the conversion of a filter in the generated application', () => {
      const test = `${TEST}/service/cipher/IdCipherTest.java`;
      result.assertFileContent(test, 'void decryptsAFilterOnEncryptedIdsIntoAFilterOnDatabaseIds()');
      result.assertFileContent(test, 'void treatsAnEmptyFilterValueAsNoValue()');
      result.assertFileContent(test, 'void rejectsAFilterWithOneInvalidId()');
      result.assertFileContent(test, 'void rejectsRangeOperatorsOnAFilterOnEncryptedIds()');
      result.assertFileContent(test, 'void decryptsAFilterWithTheCipherOfTheEntity()');
    });
  });

  describe('java criteria', () => {
    const criteria = `${MAIN}/service/criteria/AlphaCriteria.java`;

    it('should take the encrypted id of the entity', () => {
      result.assertFileContent(criteria, 'import com.mycompany.myapp.service.cipher.EncryptedIdFilter;');
      result.assertFileContent(criteria, 'import com.mycompany.myapp.service.cipher.AlphaIdCipher;');
      result.assertFileContent(criteria, 'private EncryptedIdFilter<AlphaIdCipher> id;');
      result.assertFileContent(criteria, 'public EncryptedIdFilter<AlphaIdCipher> id()');
      result.assertFileContent(criteria, 'map(EncryptedIdFilter<AlphaIdCipher>::copy)');
      result.assertFileContent(criteria, 'setId(new EncryptedIdFilter<AlphaIdCipher>())');
    });

    it('should not show a range on the encrypted id in the example', () => {
      result.assertFileContent(criteria, '{@code /alphas?id.in=<encrypted id>&');
      result.assertNoFileContent(criteria, 'id.greaterThan=5');
    });

    it('should take the encrypted id for every relationship type and the user', () => {
      const expected = {
        // One-to-One owner, Many-to-One, One-to-Many, Many-to-Many owner and the user
        betaId: 'BetaIdCipher',
        gammaId: 'GammaIdCipher',
        deltasId: 'DeltaIdCipher',
        epsilonsId: 'EpsilonIdCipher',
        userId: 'UserIdCipher',
      };
      for (const [filter, cipherClass] of Object.entries(expected)) {
        result.assertFileContent(criteria, `private EncryptedIdFilter<${cipherClass}> ${filter};`);
        result.assertFileContent(criteria, `import com.mycompany.myapp.service.cipher.${cipherClass};`);
      }
    });

    it('should take the encrypted id for the inverse sides', () => {
      // One-to-One inverse
      result.assertFileContent(`${MAIN}/service/criteria/BetaCriteria.java`, 'private EncryptedIdFilter<AlphaIdCipher> alphaId;');
      // back reference of a Many-to-One
      result.assertFileContent(`${MAIN}/service/criteria/GammaCriteria.java`, 'private EncryptedIdFilter<AlphaIdCipher> alphasId;');
    });

    it('should keep a numeric field that only looks like the id', () => {
      result.assertFileContent(criteria, 'private LongFilter identifier;');
    });

    it('should keep the plain id of a relationship to an entity without encrypted id', () => {
      result.assertFileContent(criteria, 'private LongFilter zetaId;');
    });

    it('should take the encrypted id in an entity without encrypted id', () => {
      const zetaCriteria = `${MAIN}/service/criteria/ZetaCriteria.java`;
      result.assertFileContent(zetaCriteria, 'private LongFilter id;');
      result.assertFileContent(zetaCriteria, 'private EncryptedIdFilter<AlphaIdCipher> alphasId;');
      result.assertFileContent(zetaCriteria, 'id.greaterThan=5');
    });

    it('should not write a criteria for an entity without filtering', () => {
      result.assertNoFile(`${MAIN}/service/criteria/DeltaCriteria.java`);
    });
  });

  describe('java query service', () => {
    const queryService = `${MAIN}/service/AlphaQueryService.java`;

    it('should decrypt the id of the entity with its own cipher', () => {
      result.assertFileContent(queryService, 'buildRangeSpecification(alphaIdCipher.decryptFilter(criteria.getId()), Alpha_.id)');
    });

    it('should decrypt every relationship with the cipher of the referenced entity', () => {
      result.assertFileContent(queryService, 'buildSpecification(betaIdCipher.decryptFilter(criteria.getBetaId()),');
      result.assertFileContent(queryService, 'buildSpecification(gammaIdCipher.decryptFilter(criteria.getGammaId()),');
      result.assertFileContent(queryService, 'buildSpecification(deltaIdCipher.decryptFilter(criteria.getDeltasId()),');
      result.assertFileContent(queryService, 'buildSpecification(epsilonIdCipher.decryptFilter(criteria.getEpsilonsId()),');
      result.assertFileContent(queryService, 'buildSpecification(userIdCipher.decryptFilter(criteria.getUserId()),');
      result.assertFileContent(`${MAIN}/service/BetaQueryService.java`, 'alphaIdCipher.decryptFilter(criteria.getAlphaId())');
      result.assertFileContent(`${MAIN}/service/GammaQueryService.java`, 'alphaIdCipher.decryptFilter(criteria.getAlphasId())');
    });

    it('should not decrypt a relationship to an entity without encrypted id', () => {
      result.assertFileContent(queryService, 'buildSpecification(criteria.getZetaId(),');
      result.assertNoFileContent(queryService, 'zetaIdCipher');
    });

    it('should inject every cipher once into a field, without touching the constructor', () => {
      for (const persistClass of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'User']) {
        const cipherClass = `${persistClass}IdCipher`;
        const cipherVar = `${persistClass[0].toLowerCase()}${persistClass.slice(1)}IdCipher`;
        result.assertFileContent(queryService, new RegExp(`@Autowired\\n\\s*protected ${cipherClass} ${cipherVar};`));
        result.assertFileContent(queryService, `public void set${cipherClass}(${cipherClass} ${cipherVar}) {`);
        result.assertFileContent(queryService, `import com.mycompany.myapp.service.cipher.${cipherClass};`);
      }
      result.assertFileContent(
        queryService,
        /public AlphaQueryService\(\s*AlphaRepository alphaRepository,\s*AlphaMapper alphaMapper\s*\) \{/,
      );
      result.assertNoFileContent(queryService, /private final \w+IdCipher/);
    });

    it('should decrypt the relationship of an entity without encrypted id', () => {
      const zetaQueryService = `${MAIN}/service/ZetaQueryService.java`;
      result.assertFileContent(zetaQueryService, 'buildRangeSpecification(criteria.getId(), Zeta_.id)');
      result.assertFileContent(zetaQueryService, 'buildSpecification(alphaIdCipher.decryptFilter(criteria.getAlphasId()),');
      result.assertFileContent(
        zetaQueryService,
        /public ZetaQueryService\(\s*ZetaRepository zetaRepository,\s*ZetaMapper zetaMapper\s*\) \{/,
      );
    });

    it('should leave no filter on an encrypted id undecrypted', () => {
      const encryptedFilters = {
        Alpha: ['Id', 'BetaId', 'GammaId', 'DeltasId', 'EpsilonsId', 'UserId'],
        Beta: ['Id', 'AlphaId'],
        Gamma: ['Id', 'AlphasId'],
        Zeta: ['AlphasId'],
      };
      for (const [entity, suppliers] of Object.entries(encryptedFilters)) {
        result.assertNoFileContent(
          `${MAIN}/service/${entity}QueryService.java`,
          new RegExp(`Specification\\(criteria\\.get(${suppliers.join('|')})\\(\\)`),
        );
      }
    });
  });

  describe('java resource integration test', () => {
    const resourceIT = `${TEST}/web/rest/AlphaResourceIT.java`;

    it('should filter by the encrypted id', () => {
      result.assertFileContent(resourceIT, 'String id = alphaIdCipher.encrypt(alpha.getId());');
      result.assertFileContent(resourceIT, 'defaultAlphaFiltering("id.equals=" + id, "id.notEquals=" + id);');
      result.assertFileContent(resourceIT, 'defaultAlphaFiltering("id.in=" + id, "id.notIn=" + id);');
      result.assertFileContent(resourceIT, 'defaultAlphaFiltering("id.specified=true", "id.specified=false");');
      result.assertNoFileContent(resourceIT, 'Long id = alpha.getId();');
      result.assertNoFileContent(resourceIT, '"id.greaterThanOrEqual=" + id');
    });

    it('should filter a relationship by the id encrypted with the cipher of the referenced entity', () => {
      result.assertFileContent(resourceIT, 'String betaId = betaIdCipher.encrypt(beta.getId());');
      result.assertFileContent(resourceIT, 'defaultAlphaShouldNotBeFound("betaId.equals=" + betaIdCipher.encrypt(beta.getId() + 1));');
      result.assertFileContent(resourceIT, 'defaultAlphaShouldBeRejected("betaId.equals=" + beta.getId());');
      result.assertFileContent(resourceIT, 'String epsilonsId = epsilonIdCipher.encrypt(epsilons.getId());');
      result.assertFileContent(resourceIT, 'String userId = userIdCipher.encrypt(user.getId());');
      result.assertNoFileContent(resourceIT, /Long (beta|gamma|epsilons|user)Id = /);
    });

    it('should test every filter on an encrypted id, including the back references', () => {
      result.assertFileContent(resourceIT, 'void getAllAlphasByEncryptedIdFilters() throws Exception {');
      for (const [filter, cipherVar] of [
        ['id', 'alphaIdCipher'],
        ['betaId', 'betaIdCipher'],
        ['deltasId', 'deltaIdCipher'],
        ['gammaId', 'gammaIdCipher'],
        ['userId', 'userIdCipher'],
        ['epsilonsId', 'epsilonIdCipher'],
      ]) {
        result.assertFileContent(resourceIT, `defaultAlphaShouldNotBeFound("${filter}.equals=" + ${cipherVar}.encrypt(Long.MAX_VALUE));`);
        result.assertFileContent(resourceIT, `defaultAlphaShouldBeFound("${filter}.equals=");`);
        result.assertFileContent(resourceIT, `defaultAlphaShouldBeRejected("${filter}.equals=" + plainId);`);
        result.assertFileContent(
          resourceIT,
          `defaultAlphaRangeShouldBeRejected("${filter}.greaterThan=" + ${cipherVar}.encrypt(Long.MAX_VALUE));`,
        );
      }
      result.assertFileContent(resourceIT, 'defaultAlphaShouldBeRejected("betaId.notEquals=" + userIdCipher.encrypt(plainId));');
      result.assertFileContent(resourceIT, 'defaultAlphaShouldBeRejected("userId.notEquals=" + alphaIdCipher.encrypt(plainId));');
      result.assertNoFileContent(resourceIT, '"zetaId.equals=" + plainId');
      result.assertFileContent(`${TEST}/web/rest/GammaResourceIT.java`, 'defaultGammaShouldBeFound("alphasId.equals=");');
      result.assertFileContent(`${TEST}/web/rest/BetaResourceIT.java`, 'defaultBetaShouldBeFound("alphaId.equals=");');
    });

    it('should reject an invalid id and a range operator on the list and the count', () => {
      result.assertFileContent(resourceIT, 'private void defaultAlphaShouldBeRejected(String filter) throws Exception {');
      result.assertFileContent(resourceIT, 'private void defaultAlphaRangeShouldBeRejected(String filter) throws Exception {');
      result.assertFileContent(resourceIT, '.perform(get(ENTITY_API_URL + "/count?" + filter))');
      result.assertFileContent(resourceIT, '.andExpect(jsonPath("$.message").value("error.validation"));');
    });

    it('should autowire the cipher of every referenced entity once', () => {
      for (const persistClass of ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'User']) {
        result.assertFileContent(resourceIT, `import com.mycompany.myapp.service.cipher.${persistClass}IdCipher;`);
        result.assertFileContent(resourceIT, new RegExp(`@Autowired\\n\\s*private ${persistClass}IdCipher \\w+;`));
      }
      result.assertNoFileContent(resourceIT, /private AlphaIdCipher alphaIdCipher;[\s\S]*private AlphaIdCipher alphaIdCipher;/);
    });

    it('should keep the plain id of a relationship to an entity without encrypted id', () => {
      result.assertFileContent(resourceIT, 'Long zetaId = zeta.getId();');
      result.assertFileContent(resourceIT, 'defaultAlphaShouldNotBeFound("zetaId.equals=" + (zetaId + 1));');
    });

    it('should keep the plain own id of an entity without encrypted id', () => {
      const zetaIT = `${TEST}/web/rest/ZetaResourceIT.java`;
      result.assertFileContent(zetaIT, 'Long id = zeta.getId();');
      result.assertFileContent(zetaIT, 'defaultZetaFiltering("id.greaterThanOrEqual=" + id, "id.greaterThan=" + id);');
      result.assertFileContent(zetaIT, 'defaultZetaShouldBeRejected("alphasId.equals=" + plainId);');
      result.assertNoFileContent(zetaIT, '"id.equals=" + plainId');
    });
  });

  describe('angular', () => {
    it('should keep sending the encrypted id from the list of the referenced entity', () => {
      result.assertFileContent(`${WEBAPP}/entities/gamma/list/gamma.html`, `'filter[gammaId.in]': gamma.id`);
    });
  });
});

describe('encrypt-id JHipster blueprint without filtering', () => {
  beforeAll(async function () {
    await helpers
      .runJHipster('app')
      .withJHipsterConfig(
        {},
        filteredEntities.map(entity => ({ ...entity, jpaMetamodelFiltering: false })),
      )
      .withBlueprintConfig({
        encryptIdEnable: true,
        encryptIdType: 'selected',
        encryptIdEntities: encryptedEntityNames,
      })
      .withOptions({
        creationTimestamp: '2024-02-01',
        ignoreNeedlesError: true,
      })
      .withJHipsterGenerators()
      .withConfiguredBlueprint();
  }, 60000);

  it('should write the filter for encrypted ids next to the cipher anyway', () => {
    result.assertFile(`${MAIN}/service/cipher/EncryptedIdFilter.java`);
  });

  it('should write neither criteria nor query services', () => {
    for (const entity of ['Alpha', 'Beta', 'Gamma', 'Zeta']) {
      result.assertNoFile(`${MAIN}/service/criteria/${entity}Criteria.java`);
      result.assertNoFile(`${MAIN}/service/${entity}QueryService.java`);
      result.assertNoFileContent(`${TEST}/web/rest/${entity}ResourceIT.java`, 'EncryptedIdFilters');
    }
  });
});

describe('encrypt-id JHipster blueprint with filtering and range operators', () => {
  beforeAll(async function () {
    await helpers
      .runJHipster('app')
      .withJHipsterConfig({}, filteredEntities)
      .withBlueprintConfig({
        encryptIdEnable: true,
        encryptIdType: 'selected',
        encryptIdEntities: encryptedEntityNames,
        encryptIdRangeFilter: true,
      })
      .withOptions({
        creationTimestamp: '2024-02-01',
        ignoreNeedlesError: true,
      })
      .withJHipsterGenerators()
      .withConfiguredBlueprint();
  }, 60000);

  it('should accept range operators with encrypted ids', () => {
    const filter = `${MAIN}/service/cipher/EncryptedIdFilter.java`;
    result.assertFileContent(filter, 'public class EncryptedIdFilter<C extends IdCipher> extends RangeFilter<String>');
    result.assertFileContent(filter, 'public EncryptedIdFilter<C> copy()');
    result.assertNoFileContent(filter, /rangeNotSupported|setGreaterThan/);
  });

  it('should decrypt the values of the range operators', () => {
    const cipher = `${MAIN}/service/cipher/IdCipher.java`;
    for (const operator of ['GreaterThan', 'GreaterThanOrEqual', 'LessThan', 'LessThanOrEqual']) {
      result.assertFileContent(cipher, `decrypted.set${operator}(decryptValue(filter.get${operator}()));`);
    }
  });

  it('should test the range operators of a filter in the generated application', () => {
    const test = `${TEST}/service/cipher/IdCipherTest.java`;
    result.assertFileContent(test, 'void decryptsTheRangeOperatorsOfAFilterOnEncryptedIds()');
    result.assertNoFileContent(test, 'void rejectsRangeOperatorsOnAFilterOnEncryptedIds()');
  });

  it('should keep the type of the filters and the decryption', () => {
    result.assertFileContent(`${MAIN}/service/criteria/AlphaCriteria.java`, 'private EncryptedIdFilter<GammaIdCipher> gammaId;');
    result.assertFileContent(`${MAIN}/service/criteria/AlphaCriteria.java`, '{@code /alphas?id.greaterThan=<encrypted id>&');
    result.assertFileContent(
      `${MAIN}/service/AlphaQueryService.java`,
      'buildRangeSpecification(alphaIdCipher.decryptFilter(criteria.getId()), Alpha_.id)',
    );
  });

  it('should keep the range tests of the own id with encrypted ids', () => {
    const resourceIT = `${TEST}/web/rest/AlphaResourceIT.java`;
    result.assertFileContent(resourceIT, 'String id = alphaIdCipher.encrypt(alpha.getId());');
    result.assertFileContent(resourceIT, 'defaultAlphaFiltering("id.greaterThanOrEqual=" + id, "id.greaterThan=" + id);');
    result.assertFileContent(resourceIT, 'defaultAlphaFiltering("id.lessThanOrEqual=" + id, "id.lessThan=" + id);');
    result.assertFileContent(resourceIT, 'defaultAlphaFiltering("id.in=" + id, "id.notIn=" + id);');
    result.assertFileContent(resourceIT, 'defaultAlphaFiltering("id.specified=true", "id.specified=false");');
  });

  it('should accept an encrypted range value and reject a plain or foreign one for every filter', () => {
    const resourceIT = `${TEST}/web/rest/AlphaResourceIT.java`;
    result.assertFileContent(resourceIT, 'defaultAlphaShouldNotBeFound("deltasId.greaterThan=" + deltaIdCipher.encrypt(Long.MAX_VALUE));');
    result.assertFileContent(resourceIT, 'defaultAlphaShouldBeRejected("deltasId.lessThan=" + plainId);');
    result.assertFileContent(resourceIT, 'defaultAlphaShouldBeRejected("deltasId.lessThan=" + userIdCipher.encrypt(plainId));');
    result.assertFileContent(resourceIT, 'defaultAlphaShouldBeRejected("userId.lessThan=" + alphaIdCipher.encrypt(plainId));');
    result.assertNoFileContent(resourceIT, 'RangeShouldBeRejected');
    result.assertFileContent(`${TEST}/web/rest/ZetaResourceIT.java`, 'defaultZetaShouldBeRejected("alphasId.lessThan=" + plainId);');
  });

  it('should store the switch in the blueprint configuration', () => {
    result.assertJsonFileContent('.yo-rc.json', { 'generator-jhipster-encrypt-id': { encryptIdRangeFilter: true } });
  });
});
