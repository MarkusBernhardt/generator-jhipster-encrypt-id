import { describe, expect, it } from 'vitest';

import {
  addConstructorParameter,
  collectEncryptedIdFilters,
  collectNestedDtoClasses,
  encryptCriteria,
  encryptQueryService,
  encryptResourceITFiltering,
  hasEncryptedId,
  quoteObjectIds,
} from './encrypt-id-util.js';

describe('encrypt-id-util', () => {
  describe('collectNestedDtoClasses', () => {
    it('should find the dto of a single valued relationship', () => {
      expect([...collectNestedDtoClasses('    private BetaDTO beta;')]).toEqual(['Beta']);
    });

    it('should find the dto of a collection valued relationship', () => {
      expect([...collectNestedDtoClasses('    private Set<EpsilonDTO> epsilons = new HashSet<>();')]).toEqual(['Epsilon']);
    });

    it('should report every related dto exactly once', () => {
      const dto = [
        '    private String id;',
        '    private Long identifier;',
        '    private BetaDTO beta;',
        '    private BetaDTO otherBeta;',
        '    private Set<EpsilonDTO> epsilons = new HashSet<>();',
        '    private UserDTO user;',
      ].join('\n');

      expect([...collectNestedDtoClasses(dto)].sort()).toEqual(['Beta', 'Epsilon', 'User']);
    });

    it('should ignore a missing file', () => {
      expect([...collectNestedDtoClasses()]).toEqual([]);
    });
  });

  describe('addConstructorParameter', () => {
    const add = content => addConstructorParameter(content, 'AccountResource', 'UserIdCipher', 'userIdCipher');

    it('should add the parameter to a constructor written on a single line', () => {
      expect(add('    public AccountResource(MailService mailService) {')).toBe(
        '    public AccountResource(MailService mailService, UserIdCipher userIdCipher) {',
      );
    });

    it('should add the parameter to a constructor spread over several lines', () => {
      const content = [
        '    public AccountResource(',
        '        UserService userService,',
        '        MailService mailService',
        '    ) {',
      ].join('\n');
      const expected = [
        '    public AccountResource(',
        '        UserService userService,',
        '        MailService mailService, UserIdCipher userIdCipher',
        '    ) {',
      ].join('\n');

      expect(add(content)).toBe(expected);
    });

    it('should add the parameter to a constructor without parameters', () => {
      expect(add('    public AccountResource() {')).toBe('    public AccountResource(UserIdCipher userIdCipher) {');
    });

    it('should leave the constructor of another class alone', () => {
      expect(add('    public UserResource(MailService mailService) {')).toBe('    public UserResource(MailService mailService) {');
    });
  });

  describe('quoteObjectIds', () => {
    const encrypted = new Set(['Alpha', 'Beta', 'User']);
    const quote = content => quoteObjectIds(content, encrypted, 'Alpha');

    it('should quote the id of the entity the file belongs to', () => {
      expect(quote('const entity = {id: 123};')).toBe("const entity = {id: '123'};");
      expect(quote('  id: 12323};')).toBe("  id: '12323'};");
    });

    it('should quote the id of an encrypted relationship', () => {
      expect(quote('const beta : IBeta = {id: 9373};')).toBe("const beta : IBeta = {id: '9373'};");
      expect(quote('const users: IUser[] = [{id: 42}];')).toBe("const users: IUser[] = [{id: '42'}];");
    });

    it('should keep the id of a relationship that is not encrypted', () => {
      expect(quote('const zeta : IZeta = {id: 9373};')).toBe('const zeta : IZeta = {id: 9373};');
      expect(quote('const zetas: IZeta[] = [{id: 42}];')).toBe('const zetas: IZeta[] = [{id: 42}];');
    });

    it('should take the entity of a compare block from the name of the block', () => {
      const content = [
        "    describe('compareZeta', () => {",
        '      const entity = {id: 9373};',
        '    });',
        "    describe('compareBeta', () => {",
        '      const entity = {id: 42};',
        '    });',
      ].join('\n');
      const expected = [
        "    describe('compareZeta', () => {",
        '      const entity = {id: 9373};',
        '    });',
        "    describe('compareBeta', () => {",
        "      const entity = {id: '42'};",
        '    });',
      ].join('\n');

      expect(quote(content)).toBe(expected);
    });

    it('should not convert a field that only looks like the id', () => {
      expect(quote('  identifier: 123,')).toBe('  identifier: 123,');
      expect(quote('  counter: 7,')).toBe('  counter: 7,');
    });

    it('should not quote an id twice', () => {
      expect(quote("const entity = {id: '123'};")).toBe("const entity = {id: '123'};");
    });
  });

  describe('filtering', () => {
    const PACKAGE = 'com.mycompany.myapp';
    const client = { persistClass: 'Client', enableEncryptId: true };
    const onboarding = { persistClass: 'Onboarding', enableEncryptId: true };
    const zeta = { persistClass: 'Zeta' };
    const user = { persistClass: 'User', builtInUser: true };
    const field = (fieldName, extra = {}) => ({
      fieldName,
      propertyJavaFilterName: fieldName,
      propertyFilterSupplierName: `get${fieldName[0].toUpperCase()}${fieldName.slice(1)}`,
      ...extra,
    });
    // The name of a relationship tells nothing about the entity it references: a debtor is a client.
    const relationship = (relationshipName, otherEntity) => ({
      relationshipName,
      relationshipFieldName: relationshipName,
      otherEntity,
      propertyJavaFilterName: `${relationshipName}Id`,
      propertyFilterSupplierName: `get${relationshipName[0].toUpperCase()}${relationshipName.slice(1)}Id`,
    });
    const mandate = {
      name: 'Mandate',
      entityClass: 'Mandate',
      entityClassPlural: 'Mandates',
      entityInstance: 'mandate',
      persistClass: 'Mandate',
      persistInstance: 'mandate',
      enableEncryptId: true,
      fields: [field('id', { id: true }), field('identifier'), field('deviceId')],
      relationships: [
        relationship('onboardings', onboarding),
        relationship('debtor', client),
        relationship('creditor', client),
        relationship('zeta', zeta),
        relationship('user', user),
      ],
    };
    const mandateFilters = collectEncryptedIdFilters(mandate);

    describe('hasEncryptedId', () => {
      it('should be true for a selected entity and the user', () => {
        expect(hasEncryptedId(client)).toBe(true);
        expect(hasEncryptedId(user)).toBe(true);
        expect(hasEncryptedId(zeta)).toBe(false);
        expect(hasEncryptedId(undefined)).toBe(false);
      });
    });

    describe('collectEncryptedIdFilters', () => {
      it('should take the cipher of the referenced entity, not the name of the filter', () => {
        expect(
          mandateFilters.map(({ filterName, supplier, cipherClass, cipherVar, own }) => [
            filterName,
            supplier,
            cipherClass,
            cipherVar,
            own,
          ]),
        ).toEqual([
          ['id', 'getId', 'MandateIdCipher', 'mandateIdCipher', true],
          ['onboardingsId', 'getOnboardingsId', 'OnboardingIdCipher', 'onboardingIdCipher', false],
          ['debtorId', 'getDebtorId', 'ClientIdCipher', 'clientIdCipher', false],
          ['creditorId', 'getCreditorId', 'ClientIdCipher', 'clientIdCipher', false],
          ['userId', 'getUserId', 'UserIdCipher', 'userIdCipher', false],
        ]);
      });

      it('should keep the property to retype it', () => {
        expect(mandateFilters[0].property).toBe(mandate.fields[0]);
        expect(mandateFilters[2].property).toBe(mandate.relationships[1]);
      });

      it('should skip a relationship to an entity without encrypted id and a field that only looks like the id', () => {
        const names = mandateFilters.map(filter => filter.filterName);
        expect(names).not.toContain('zetaId');
        expect(names).not.toContain('identifier');
        expect(names).not.toContain('deviceId');
      });

      it('should keep the own id of an entity without encrypted id, but not its relationships to encrypted entities', () => {
        const filters = collectEncryptedIdFilters({ ...mandate, enableEncryptId: false });
        expect(filters.map(filter => filter.filterName)).toEqual(['onboardingsId', 'debtorId', 'creditorId', 'userId']);
      });

      it('should find nothing for an entity without fields and relationships', () => {
        expect(collectEncryptedIdFilters({ persistClass: 'Empty' })).toEqual([]);
      });
    });

    describe('encryptCriteria', () => {
      const criteria = [
        'package com.mycompany.myapp.service.criteria;',
        '',
        'import tech.jhipster.service.filter.*;',
        '',
        '/**',
        ' * {@code /mandates?id.greaterThan=5&attr1.contains=something&attr2.specified=false}',
        ' */',
        'public class MandateCriteria implements Serializable, Criteria {',
        '    private EncryptedIdFilter<MandateIdCipher> id;',
        '}',
      ].join('\n');

      it('should import the filter and every cipher once', () => {
        const result = encryptCriteria(criteria, PACKAGE, mandateFilters);
        for (const importedClass of ['EncryptedIdFilter', 'MandateIdCipher', 'OnboardingIdCipher', 'ClientIdCipher', 'UserIdCipher']) {
          expect(result.match(new RegExp(`import com\\.mycompany\\.myapp\\.service\\.cipher\\.${importedClass};`, 'g'))).toHaveLength(1);
        }
      });

      it('should not show a range on an encrypted id in the example', () => {
        const result = encryptCriteria(criteria, PACKAGE, mandateFilters);
        expect(result).toContain('{@code /mandates?id.in=<encrypted id>&attr1.contains=something');
        expect(result).not.toContain('id.greaterThan');
      });

      it('should show a range on an encrypted id in the example with range operators', () => {
        const result = encryptCriteria(criteria, PACKAGE, mandateFilters, { rangeFilter: true });
        expect(result).toContain('{@code /mandates?id.greaterThan=<encrypted id>&attr1.contains=something');
      });

      it('should keep the example of an entity without encrypted id', () => {
        const filters = mandateFilters.filter(filter => !filter.own);
        expect(encryptCriteria(criteria, PACKAGE, filters)).toContain('?id.greaterThan=5&');
      });

      it('should be idempotent', () => {
        const once = encryptCriteria(criteria, PACKAGE, mandateFilters);
        expect(encryptCriteria(once, PACKAGE, mandateFilters)).toBe(once);
      });
    });

    describe('encryptQueryService', () => {
      // The raw output of the JHipster template, before prettier.
      const queryService = [
        'import tech.jhipster.service.QueryService;',
        '',
        'import com.mycompany.myapp.repository.MandateRepository;',
        '',
        'public class MandateQueryService extends QueryService<Mandate> {',
        '',
        '    private static final Logger LOG = LoggerFactory.getLogger(MandateQueryService.class);',
        '',
        '    private final MandateRepository mandateRepository;',
        '',
        '    private final MandateMapper mandateMapper;',
        '',
        '    public MandateQueryService(MandateRepository mandateRepository, MandateMapper mandateMapper) {',
        '        this.mandateRepository = mandateRepository;',
        '        this.mandateMapper = mandateMapper;',
        '    }',
        '',
        '    protected Specification<Mandate> createSpecification(MandateCriteria criteria) {',
        '                buildRangeSpecification(criteria.getId(), Mandate_.id)',
        '                ,',
        '                buildRangeSpecification(criteria.getIdentifier(), Mandate_.identifier)',
        '                ,',
        '                buildSpecification(criteria.getOnboardingsId(),',
        '                    root -> root.join(Mandate_.onboardings, JoinType.LEFT).get(Onboarding_.id))',
        '                ,',
        '                buildSpecification(criteria.getDebtorId(),',
        '                    root -> root.join(Mandate_.debtor, JoinType.LEFT).get(Client_.id))',
        '                ,',
        '                buildSpecification(criteria.getCreditorId(),',
        '                    root -> root.join(Mandate_.creditor, JoinType.LEFT).get(Client_.id))',
        '                ,',
        '                buildSpecification(criteria.getZetaId(),',
        '                    root -> root.join(Mandate_.zeta, JoinType.LEFT).get(Zeta_.id))',
        '                ,',
        '                buildSpecification(criteria.getUserId(),',
        '                    root -> root.join(Mandate_.user, JoinType.LEFT).get(User_.id))',
        '    }',
        '}',
      ].join('\n');
      const encrypt = content => encryptQueryService(content, PACKAGE, mandateFilters);

      it('should decrypt every filter on an encrypted id with the cipher of the referenced entity', () => {
        const result = encrypt(queryService);
        expect(result).toContain('buildRangeSpecification(mandateIdCipher.decryptFilter(criteria.getId()), Mandate_.id)');
        expect(result).toContain('buildSpecification(onboardingIdCipher.decryptFilter(criteria.getOnboardingsId()),');
        expect(result).toContain('buildSpecification(clientIdCipher.decryptFilter(criteria.getDebtorId()),');
        expect(result).toContain('buildSpecification(clientIdCipher.decryptFilter(criteria.getCreditorId()),');
        expect(result).toContain('buildSpecification(userIdCipher.decryptFilter(criteria.getUserId()),');
      });

      it('should leave the other filters alone', () => {
        const result = encrypt(queryService);
        expect(result).toContain('buildRangeSpecification(criteria.getIdentifier(), Mandate_.identifier)');
        expect(result).toContain('buildSpecification(criteria.getZetaId(),');
      });

      it('should inject a cipher used by several filters once, into a field after the logger', () => {
        const result = encrypt(queryService);
        expect(result.match(/protected ClientIdCipher clientIdCipher;/g)).toHaveLength(1);
        expect(result).toContain(
          [
            '    private static final Logger LOG = LoggerFactory.getLogger(MandateQueryService.class);',
            '',
            '    @Autowired',
            '    protected MandateIdCipher mandateIdCipher;',
            '',
            '    public void setMandateIdCipher(MandateIdCipher mandateIdCipher) {',
            '        this.mandateIdCipher = mandateIdCipher;',
            '    }',
            '',
            '    @Autowired',
            '    protected OnboardingIdCipher onboardingIdCipher;',
          ].join('\n'),
        );
        expect(result).toContain('import org.springframework.beans.factory.annotation.Autowired;');
        expect(result).toContain('import com.mycompany.myapp.service.cipher.ClientIdCipher;');
      });

      it('should leave the constructor and the repository untouched', () => {
        const result = encrypt(queryService);
        for (const line of [
          'import com.mycompany.myapp.repository.MandateRepository;',
          '    private final MandateRepository mandateRepository;',
          '    public MandateQueryService(MandateRepository mandateRepository, MandateMapper mandateMapper) {',
          '        this.mandateRepository = mandateRepository;\n        this.mandateMapper = mandateMapper;\n    }',
        ]) {
          expect(result).toContain(line);
        }
      });

      it('should be idempotent', () => {
        expect(encrypt(encrypt(queryService))).toBe(encrypt(queryService));
      });
    });

    describe('encryptResourceITFiltering', () => {
      const resourceIT = [
        'import com.mycompany.myapp.repository.MandateRepository;',
        '',
        'class MandateResourceIT {',
        '',
        '    @Autowired',
        '    private MockMvc restMandateMockMvc;',
        '',
        '    @Test',
        '    @Transactional',
        '    void getMandatesByIdFiltering() throws Exception {',
        '        insertedMandate = mandateRepository.saveAndFlush(mandate);',
        '',
        '        Long id = mandate.getId();',
        '',
        '        defaultMandateFiltering("id.equals=" + id, "id.notEquals=" + id);',
        '',
        '        defaultMandateFiltering("id.greaterThanOrEqual=" + id, "id.greaterThan=" + id);',
        '',
        '        defaultMandateFiltering("id.lessThanOrEqual=" + id, "id.lessThan=" + id);',
        '    }',
        '',
        '    @Test',
        '    @Transactional',
        '    void getAllMandatesByDeviceIdIsEqualToSomething() throws Exception {',
        '        defaultMandateFiltering("deviceId.equals=" + DEFAULT_DEVICE_ID, "deviceId.equals=" + UPDATED_DEVICE_ID);',
        '    }',
        '',
        '    @Test',
        '    @Transactional',
        '    void getAllMandatesByDebtorIsEqualToSomething() throws Exception {',
        '        mandateRepository.saveAndFlush(mandate);',
        '        Long debtorId = debtor.getId();',
        '        // Get all the mandateList where debtor equals to debtorId',
        '        defaultMandateShouldBeFound("debtorId.equals=" + debtorId);',
        '',
        '        // Get all the mandateList where debtor equals to (debtorId + 1)',
        '        defaultMandateShouldNotBeFound("debtorId.equals=" + (debtorId + 1));',
        '    }',
        '',
        '    @Test',
        '    @Transactional',
        '    void getAllMandatesByZetaIsEqualToSomething() throws Exception {',
        '        mandateRepository.saveAndFlush(mandate);',
        '        Long zetaId = zeta.getId();',
        '        defaultMandateShouldNotBeFound("zetaId.equals=" + (zetaId + 1));',
        '    }',
        '}',
      ].join('\n');
      const encrypt = (content, entity = mandate, filters = mandateFilters) =>
        encryptResourceITFiltering(content, PACKAGE, entity, filters);

      it('should filter by the encrypted own id and replace the range tests', () => {
        const result = encrypt(resourceIT);
        expect(result).toContain('String id = mandateIdCipher.encrypt(mandate.getId());');
        expect(result).toContain('defaultMandateFiltering("id.in=" + id, "id.notIn=" + id);');
        expect(result).toContain('defaultMandateFiltering("id.specified=true", "id.specified=false");');
        expect(result).not.toContain('Long id = mandate.getId();');
        expect(result).not.toContain('greaterThanOrEqual');
        expect(result).not.toContain('lessThan');
      });

      it('should filter a relationship by the id encrypted with the cipher of the referenced entity', () => {
        const result = encrypt(resourceIT);
        expect(result).toContain('String debtorId = clientIdCipher.encrypt(debtor.getId());');
        expect(result).toContain('defaultMandateShouldNotBeFound("debtorId.equals=" + clientIdCipher.encrypt(debtor.getId() + 1));');
        expect(result).toContain('defaultMandateShouldBeRejected("debtorId.equals=" + debtor.getId());');
        expect(result).not.toContain('(debtorId + 1)');
      });

      it('should leave a field that only looks like an id and a relationship to an entity without encrypted id alone', () => {
        const result = encrypt(resourceIT);
        expect(result).toContain(
          'defaultMandateFiltering("deviceId.equals=" + DEFAULT_DEVICE_ID, "deviceId.equals=" + UPDATED_DEVICE_ID);',
        );
        expect(result).toContain('Long zetaId = zeta.getId();');
        expect(result).toContain('defaultMandateShouldNotBeFound("zetaId.equals=" + (zetaId + 1));');
      });

      it('should test every filter on an encrypted id, including the back references', () => {
        const result = encrypt(resourceIT);
        expect(result).toContain('void getAllMandatesByEncryptedIdFilters() throws Exception {');
        expect(result).toContain('String encryptedId = mandateIdCipher.encrypt(Long.MAX_VALUE);');
        expect(result).toContain('defaultMandateShouldBeRejected("id.equals=" + encryptedId + encryptedId);');
        expect(result).toContain('defaultMandateShouldBeRejected("id.equals=" + encryptedId.toUpperCase(Locale.ROOT));');
        expect(result).toContain('defaultMandateShouldNotBeFound("onboardingsId.equals=" + onboardingIdCipher.encrypt(Long.MAX_VALUE));');
        expect(result).toContain('defaultMandateShouldBeFound("onboardingsId.equals=");');
        expect(result).toContain('defaultMandateShouldBeRejected("onboardingsId.equals=" + plainId);');
        expect(result).toContain(
          'defaultMandateShouldBeRejected("onboardingsId.in=" + onboardingIdCipher.encrypt(Long.MAX_VALUE) + "," + plainId);',
        );
        expect(result).toContain('defaultMandateShouldBeRejected("onboardingsId.notEquals=" + userIdCipher.encrypt(plainId));');
        expect(result).toContain(
          'defaultMandateRangeShouldBeRejected("onboardingsId.greaterThan=" + onboardingIdCipher.encrypt(Long.MAX_VALUE));',
        );
        expect(result).toContain('defaultMandateShouldNotBeFound("creditorId.equals=" + clientIdCipher.encrypt(Long.MAX_VALUE));');
        expect(result).not.toContain('"zetaId.equals=" + plainId');
      });

      it('should use the cipher of the entity itself as foreign cipher of a filter on user ids', () => {
        const result = encrypt(resourceIT);
        expect(result).toContain('defaultMandateShouldBeRejected("userId.notEquals=" + mandateIdCipher.encrypt(plainId));');
      });

      it('should skip the foreign id of a filter on user ids in an entity without encrypted id', () => {
        const entity = { ...mandate, enableEncryptId: false };
        const result = encrypt(resourceIT, entity, collectEncryptedIdFilters(entity));
        expect(result).toContain('defaultMandateShouldBeRejected("userId.equals=" + plainId);');
        expect(result).not.toContain('"userId.notEquals="');
        expect(result).toContain('Long id = mandate.getId();');
        expect(result).toContain('String encryptedId = onboardingIdCipher.encrypt(Long.MAX_VALUE);');
      });

      it('should add the helpers once', () => {
        const result = encrypt(resourceIT);
        expect(result.match(/private void defaultMandateShouldBeRejected\(String filter\)/g)).toHaveLength(1);
        expect(result.match(/private void defaultMandateRangeShouldBeRejected\(String filter\)/g)).toHaveLength(1);
        expect(result).toContain('.andExpect(jsonPath("$.title").value("Invalid id"))');
        expect(result).toContain('.andExpect(jsonPath("$.message").value("error.validation"));');
      });

      it('should autowire and import every cipher once', () => {
        const result = encrypt(resourceIT);
        for (const persistClass of ['Client', 'Mandate', 'Onboarding', 'User']) {
          expect(result.match(new RegExp(`@Autowired\\n\\s*private ${persistClass}IdCipher \\w+;`, 'g'))).toHaveLength(1);
          expect(
            result.match(new RegExp(`import com\\.mycompany\\.myapp\\.service\\.cipher\\.${persistClass}IdCipher;`, 'g')),
          ).toHaveLength(1);
        }
        expect(result).toContain('import java.util.Locale;');
      });

      it('should not autowire a cipher that is autowired already', () => {
        const withCipher = resourceIT.replace(
          'private MockMvc restMandateMockMvc;',
          'private MockMvc restMandateMockMvc;\n\n    @Autowired\n    private MandateIdCipher mandateIdCipher;',
        );
        expect(encrypt(withCipher).match(/private MandateIdCipher mandateIdCipher;/g)).toHaveLength(1);
      });

      it('should be idempotent', () => {
        expect(encrypt(encrypt(resourceIT))).toBe(encrypt(resourceIT));
      });

      describe('with range operators', () => {
        const encryptWithRanges = content => encryptResourceITFiltering(content, PACKAGE, mandate, mandateFilters, { rangeFilter: true });

        it('should keep the range tests of the own id with encrypted ids', () => {
          const result = encryptWithRanges(resourceIT);
          expect(result).toContain('String id = mandateIdCipher.encrypt(mandate.getId());');
          expect(result).toContain('defaultMandateFiltering("id.greaterThanOrEqual=" + id, "id.greaterThan=" + id);');
          expect(result).toContain('defaultMandateFiltering("id.lessThanOrEqual=" + id, "id.lessThan=" + id);');
          expect(result).toContain('defaultMandateFiltering("id.in=" + id, "id.notIn=" + id);');
          expect(result).toContain('defaultMandateFiltering("id.specified=true", "id.specified=false");');
        });

        it('should accept an encrypted range value and reject a plain or foreign one', () => {
          const result = encryptWithRanges(resourceIT);
          expect(result).toContain('defaultMandateShouldNotBeFound("debtorId.greaterThan=" + clientIdCipher.encrypt(Long.MAX_VALUE));');
          expect(result).toContain('defaultMandateShouldBeRejected("debtorId.lessThan=" + plainId);');
          expect(result).toContain('defaultMandateShouldBeRejected("debtorId.lessThan=" + userIdCipher.encrypt(plainId));');
          expect(result).toContain('defaultMandateShouldBeRejected("userId.lessThan=" + mandateIdCipher.encrypt(plainId));');
          expect(result).not.toContain('RangeShouldBeRejected');
        });

        it('should be idempotent', () => {
          expect(encryptWithRanges(encryptWithRanges(resourceIT))).toBe(encryptWithRanges(resourceIT));
        });
      });
    });
  });
});
