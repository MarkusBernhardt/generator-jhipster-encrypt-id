import * as changeCase from 'change-case';

/* -------------------------------------------------------------------------- */
/* generic helpers                                                            */
/* -------------------------------------------------------------------------- */

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a regular expression for a literal needle that only matches whole words.
 *
 * `Long id` must not match `Long idNumber` and `private Long id` must not match
 * `private Long identifier`, otherwise unrelated fields get converted as well.
 */
function literalRegex(needle) {
  const prefix = /^\w/.test(needle) ? '\\b' : '';
  const suffix = /\w$/.test(needle) ? '\\b' : '';
  return new RegExp(`${prefix}${escapeRegExp(needle)}${suffix}`, 'g');
}

function readFileContent(generator, filePath) {
  let fileContent;
  generator.editFile(filePath, { ignoreNonExisting: true }, content => {
    fileContent = content;
    return content;
  });
  return fileContent;
}

function transformFile(generator, filePath, transform) {
  generator.editFile(filePath, { ignoreNonExisting: true }, content => transform(content));
}

function replaceRegexNeedles(generator, filePath, replaceNeedles) {
  replaceNeedles.forEach(needle => {
    generator.editFile(filePath, { ignoreNonExisting: true }, contents => contents.replaceAll(needle.regex, needle.content));
  });
}

function replaceLiteralNeedles(generator, filePath, needles, from, to) {
  needles.forEach(needle => {
    const regex = literalRegex(needle);
    const replacement = needle.replace(from, to);
    generator.editFile(filePath, { ignoreNonExisting: true }, contents => contents.replace(regex, replacement));
  });
}

function replaceLongToStringNeedles(generator, filePath, replaceNeedles) {
  replaceLiteralNeedles(generator, filePath, replaceNeedles, 'Long', 'String');
}

function replaceNumberToStringNeedles(generator, filePath, replaceNeedles) {
  replaceLiteralNeedles(generator, filePath, replaceNeedles, 'number', 'string');
}

/** Directory prefix of an entity, `''` unless the entity lives in its own package. */
function entityDir({ entityPackage }) {
  return entityPackage ? `${entityPackage.replace(/\./g, '/')}/` : '';
}

/** Java package of an entity, equal to the application package unless the entity lives in its own package. */
function entityPackageName(packageName, { entityPackage }) {
  return entityPackage ? `${packageName}.${entityPackage}` : packageName;
}

const cipherField = persistClass => `${changeCase.camelCase(persistClass)}IdCipher`;

/** Insert a snippet right before the closing brace of the top level type. */
function appendToClassBody(content, snippet) {
  const index = content.lastIndexOf('}');
  if (index < 0) {
    return content;
  }
  return `${content.slice(0, index)}${snippet}\n${content.slice(index)}`;
}

/* -------------------------------------------------------------------------- */
/* angular                                                                    */
/* -------------------------------------------------------------------------- */

const entityDirName = persistClass => changeCase.kebabCase(persistClass);

function convertAngularComponent(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const path = `${clientSrcDir}/app/entities/${name}/list/${name}.component.ts`;

  replaceNumberToStringNeedles(generator, path, ['): number => this.']);
}

function convertAngularDeleteDialog(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const path = `${clientSrcDir}/app/entities/${name}/delete/${name}-delete-dialog.component.ts`;

  replaceNumberToStringNeedles(generator, path, ['confirmDelete(id: number)']);
}

function convertAngularDeleteDialogSpec(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const path = `${clientSrcDir}/app/entities/${name}/delete/${name}-delete-dialog.component.spec.ts`;

  const regExNeedles = [
    { regex: /confirmDelete\((\d+)\)/gm, content: "confirmDelete('$1')" },
    { regex: /(delete\)\.toHaveBeenCalledWith)\((\d+)\)/gm, content: "$1('$2')" },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertAngularModel(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const path = `${clientSrcDir}/app/entities/${name}/${name}.model.ts`;

  replaceNumberToStringNeedles(generator, path, ['id: number;']);
}

function convertAngularRouteSpec(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const path = `${clientSrcDir}/app/entities/${name}/route/${name}-routing-resolve.service.spec.ts`;

  const regExNeedles = [
    { regex: /\{ id: (\d+) \}/gm, content: "{ id: '$1' }" },
    { regex: /(find\)\.toBeCalledWith|find\)\.toHaveBeenCalledWith)\((\d+)\)/gm, content: "$1('$2')" },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertAngularService(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const path = `${clientSrcDir}/app/entities/${name}/service/${name}.service.ts`;

  replaceNumberToStringNeedles(generator, path, ['find(id: number)', 'delete(id: number)', '>): number {']);
}

function convertAngularServiceSpec(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const path = `${clientSrcDir}/app/entities/${name}/service/${name}.service.spec.ts`;

  const regExNeedles = [
    { regex: /(service\.(?:find|delete))\((\d+)\)/gm, content: "$1('$2')" },
    { regex: /"id":(\d+)/gm, content: '"id":"$1"' },
    { regex: /\{ id: (\d+) \}/gm, content: "{ id: '$1' }" },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

/**
 * Quote the numeric ids of the jest fixtures. Ids of relationships to entities that are
 * not encrypted have to stay numeric.
 */
function quoteJsonIds(content, encryptedClasses) {
  const preserved = [];
  const marker = index => `/*encrypt-id-keep-${index}*/`;
  const typedIdRegex = /(:\s*I(\w+)(?:\[\])?\s*=\s*\[?\s*\{\s*"id"\s*:\s*)(\d+)/g;

  let quoted = content.replace(typedIdRegex, (match, prefix, otherClass) => {
    if (encryptedClasses.has(otherClass)) {
      return match;
    }
    preserved.push(match);
    return marker(preserved.length - 1);
  });
  quoted = quoted.replace(/("id"\s*:\s*)(\d+)/g, '$1"$2"');
  return quoted.replace(/\/\*encrypt-id-keep-(\d+)\*\//g, (match, index) => preserved[Number(index)]);
}

/** The component tests use the numeric ids of the entity and of all its relationships. */
function convertAngularComponentSpecs(generator, clientSrcDir, entity, encryptedClasses) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const paths = [
    `${clientSrcDir}/app/entities/${name}/detail/${name}-detail.component.spec.ts`,
    `${clientSrcDir}/app/entities/${name}/list/${name}.component.spec.ts`,
    `${clientSrcDir}/app/entities/${name}/update/${name}-update.component.spec.ts`,
  ];

  for (const path of paths) {
    transformFile(generator, path, content => quoteJsonIds(content, encryptedClasses));
  }
}

function convertAngularTestSamples(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const path = `${clientSrcDir}/app/entities/${name}/${name}.test-samples.ts`;

  const regExNeedles = [{ regex: /^(\s*)id: (\d+)(,?)$/gm, content: "$1id: '$2'$3" }];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertAngularUserManagement(generator, clientSrcDir) {
  const path = `${clientSrcDir}/app/admin/user-management/user-management.model.ts`;

  replaceNumberToStringNeedles(generator, path, ['id: number | null']);
}

function convertAngularUserManagementList(generator, clientSrcDir) {
  const path = `${clientSrcDir}/app/admin/user-management/list/user-management.component.ts`;

  replaceNumberToStringNeedles(generator, path, ['item: User): number']);
}

/**
 * The `User` entity is always encrypted, so the shared user model used by the
 * relationships of the other entities has to use a string id as well.
 */
function convertAngularUser(generator, clientSrcDir) {
  const modelPath = `${clientSrcDir}/app/entities/user/user.model.ts`;
  const servicePath = `${clientSrcDir}/app/entities/user/service/user.service.ts`;
  const serviceSpecPath = `${clientSrcDir}/app/entities/user/service/user.service.spec.ts`;
  const testSamplesPath = `${clientSrcDir}/app/entities/user/user.test-samples.ts`;

  replaceNumberToStringNeedles(generator, modelPath, ['id: number;']);
  replaceNumberToStringNeedles(generator, servicePath, ['find(id: number)', 'delete(id: number)', '>): number {']);

  replaceRegexNeedles(generator, serviceSpecPath, [
    { regex: /(service\.(?:find|delete))\((\d+)\)/gm, content: "$1('$2')" },
    { regex: /"id":(\d+)/gm, content: '"id":"$1"' },
    { regex: /\{ id: (\d+) \}/gm, content: "{ id: '$1' }" },
  ]);
  replaceRegexNeedles(generator, testSamplesPath, [{ regex: /^(\s*)id: (\d+)(,?)$/gm, content: "$1id: '$2'$3" }]);
}

/**
 * Only the id input has to become a text input. Converting every number input
 * would also break the numeric fields of the entity.
 */
function convertAngularUpdateHtml(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const name = entityDirName(persistClass);
  const path = `${clientSrcDir}/app/entities/${name}/update/${name}-update.component.html`;

  const regExNeedles = [{ regex: /<input type="number"([^>]*\bname="id")/gm, content: '<input type="text"$1' }];

  replaceRegexNeedles(generator, path, regExNeedles);
}

/* -------------------------------------------------------------------------- */
/* java - application wide                                                    */
/* -------------------------------------------------------------------------- */

function convertJavaApplicationProperties(generator, mainJavaPackageDir) {
  const applicationPropertiesPath = `${mainJavaPackageDir}/config/ApplicationProperties.java`;

  const regExNeedles = [
    {
      regex: /jhipster-needle-application-properties-property$/gm,
      content: 'jhipster-needle-application-properties-property\n    private final EncryptId encryptId = new EncryptId();\n',
    },
    {
      regex: /jhipster-needle-application-properties-property-getter$/gm,
      content:
        'jhipster-needle-application-properties-property-getter\n    public EncryptId getEncryptId() {\n        return encryptId;\n    }\n',
    },
    {
      regex: /jhipster-needle-application-properties-property-class$/gm,
      content:
        'jhipster-needle-application-properties-property-class\n    public static class EncryptId {\n        private String key = "";\n\n        public String getKey() {\n            return key;\n        }\n\n        public void setKey(String key) {\n            this.key = key;\n        }\n    }\n',
    },
  ];

  replaceRegexNeedles(generator, applicationPropertiesPath, regExNeedles);
}

function convertJavaApplicationYml(generator, mainJavaResourceDir) {
  const applicationYmlPaths = [
    `${mainJavaResourceDir}/config/application.yml`,
    `${mainJavaResourceDir}/config/application-dev.yml`,
    `${mainJavaResourceDir}/config/application-prod.yml`,
  ];

  const regExNeedles = [
    {
      regex: /^# application:$/gm,
      content: 'application:',
    },
    {
      regex: /^application:$/gm,
      content: 'application:\n  encrypt-id:\n    key: "change me"',
    },
  ];

  for (const applicationYmlPath of applicationYmlPaths) {
    replaceRegexNeedles(generator, applicationYmlPath, regExNeedles);
  }
}

/* -------------------------------------------------------------------------- */
/* java - entity                                                              */
/* -------------------------------------------------------------------------- */

function convertJavaDto(generator, mainJavaPackageDir, testJavaPackageDir, entity) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const dtoName = `${persistClass}DTO`;
  const dtoPath = `${mainJavaPackageDir}/${dir}service/dto/${dtoName}.java`;

  replaceLongToStringNeedles(generator, dtoPath, ['private Long id', 'Long getId()', 'setId(Long id)']);

  if (!entity.builtIn) {
    const dtoTestPath = `${testJavaPackageDir}/${dir}service/dto/${dtoName}Test.java`;
    const dtoVarName = `${changeCase.camelCase(persistClass)}DTO`;
    const regExNeedles = [
      {
        regex: new RegExp(`${dtoVarName}1\\.setId\\(1L\\)`, 'gm'),
        content: `${dtoVarName}1.setId("1")`,
      },
      {
        regex: new RegExp(`${dtoVarName}2\\.setId\\(2L\\)`, 'gm'),
        content: `${dtoVarName}2.setId("2")`,
      },
    ];
    replaceRegexNeedles(generator, dtoTestPath, regExNeedles);
  }
}

/** Collect the DTO types the given DTO source references, e.g. `Beta` for `private BetaDTO beta;`. */
function collectNestedDtoClasses(dtoContent = '') {
  const classes = new Set();
  const regex = /^\s*private\s+(?:Set<\s*)?(\w+)DTO\s*>?\s+\w+/gm;
  let match = regex.exec(dtoContent);
  while (match !== null) {
    classes.add(match[1]);
    match = regex.exec(dtoContent);
  }
  return classes;
}

function addIdMapping(source, { declarationRegex, annotation, fallback }) {
  const match = declarationRegex.exec(source);
  if (match === null) {
    return appendToClassBody(source, fallback);
  }
  return source.replace(
    declarationRegex,
    (full, indent, declaration, parameter) => `${indent}${annotation(parameter)}\n${indent}${declaration}`,
  );
}

/**
 * Rewrite a MapStruct entity mapper so that
 * - the id of the entity itself is encrypted/decrypted,
 * - the ids of all *related* encrypted entities are encrypted/decrypted as well,
 * - `partialUpdate` never writes the (encrypted) id into the entity.
 *
 * Returns the set of entities whose cipher is used by the mapper.
 */
function convertJavaMapper(generator, mainJavaPackageDir, packageName, entity, encryptedClasses) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const mapperPath = `${mainJavaPackageDir}/${dir}service/mapper/${persistClass}Mapper.java`;
  const dtoPath = `${mainJavaPackageDir}/${dir}service/dto/${persistClass}DTO.java`;

  const nestedDtoClasses = [...collectNestedDtoClasses(readFileContent(generator, dtoPath))].filter(
    otherClass => otherClass !== persistClass && encryptedClasses.has(otherClass),
  );
  const cipherClasses = new Set([persistClass, ...nestedDtoClasses]);
  const selfCipher = cipherField(persistClass);

  transformFile(generator, mapperPath, content => {
    // MapStruct can only add the ciphers to a class, an interface cannot hold state.
    let source = content.replace(/\bpublic interface\s+(\w+Mapper)\b/, 'public abstract class $1');
    source = source.replace(/\bextends\s+EntityMapper\s*</, 'implements EntityMapper<');

    // `default` is not a valid modifier for a class method.
    source = source.replace(/^([ \t]*)default\s+/gm, '$1public ');

    // Implicitly public abstract interface methods have to be declared explicitly in a class.
    source = source.replace(
      /^([ \t]*)(?!public\b|protected\b|private\b|abstract\b|@)([\w.]+(?:<[^>\n]*>)?)(\s+)(toDto\w*|toEntity\w*|partialUpdate)(\s*\([^)]*\)\s*;)/gm,
      '$1public abstract $2$3$4$5',
    );

    // Relationships: `@Mapping(target = "id", source = "id")` would expose the plain id of the related entity.
    source = source.replace(/@Mapping\(target = "id", source = "id"\)([\s\S]*?\);)/g, (match, tail) => {
      const declaration = /(\w+)DTO\s+toDto\w+\s*\(\s*(\w+)\s+(\w+)\s*\)\s*;/.exec(tail);
      if (declaration === null) {
        return match;
      }
      const [, otherClass, otherParamType, otherParamName] = declaration;
      if (otherClass !== otherParamType || !encryptedClasses.has(otherClass)) {
        return match;
      }
      cipherClasses.add(otherClass);
      return `@Mapping(target = "id", expression = "java(${cipherField(otherClass)}.encrypt(${otherParamName}.getId()))")${tail}`;
    });

    // The id of the entity itself. MapStruct copies the expression verbatim into the generated
    // implementation, so the parameter name of the declared method has to be used.
    source = addIdMapping(source, {
      declarationRegex: new RegExp(
        `^([ \\t]*)((?:public abstract\\s+)?${persistClass}DTO\\s+toDto\\s*\\(\\s*${persistClass}\\s+(\\w+)\\s*\\)\\s*;)`,
        'm',
      ),
      annotation: parameter => `@Mapping(target = "id", expression = "java(${selfCipher}.encrypt(${parameter}.getId()))")`,
      fallback:
        `\n    @Mapping(target = "id", expression = "java(${selfCipher}.encrypt(s.getId()))")\n` +
        `    public abstract ${persistClass}DTO toDto(${persistClass} s);\n`,
    });

    source = addIdMapping(source, {
      declarationRegex: new RegExp(
        `^([ \\t]*)((?:public abstract\\s+)?${persistClass}\\s+toEntity\\s*\\(\\s*${persistClass}DTO\\s+(\\w+)\\s*\\)\\s*;)`,
        'm',
      ),
      annotation: parameter => `@Mapping(target = "id", expression = "java(${selfCipher}.decrypt(${parameter}.getId()))")`,
      fallback:
        `\n    @Mapping(target = "id", expression = "java(${selfCipher}.decrypt(dto.getId()))")\n` +
        `    public abstract ${persistClass} toEntity(${persistClass}DTO dto);\n`,
    });

    // A partial update must never write the id, MapStruct would parse the encrypted id as a number.
    source = appendToClassBody(
      source,
      `
    @Named("partialUpdate")
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    public abstract void partialUpdate(@MappingTarget ${persistClass} entity, ${persistClass}DTO dto);
`,
    );

    // Without these methods MapStruct generates nested mappings that parse the encrypted id as a number.
    source = nestedDtoClasses.reduce(
      (current, otherClass) =>
        appendToClassBody(
          current,
          `
    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "id", expression = "java(${cipherField(otherClass)}.decrypt(dto.getId()))")
    public abstract ${otherClass} toEntity${otherClass}(${otherClass}DTO dto);
`,
        ),
      source,
    );

    const sortedCipherClasses = [...cipherClasses].sort();

    const fields = sortedCipherClasses
      .map(
        cipherClass => `
    @Autowired
    protected ${cipherClass}IdCipher ${cipherField(cipherClass)};

    public void set${cipherClass}IdCipher(${cipherClass}IdCipher ${cipherField(cipherClass)}) {
        this.${cipherField(cipherClass)} = ${cipherField(cipherClass)};
    }
`,
      )
      .join('');
    source = source.replace(/(public abstract class \w+Mapper[^{]*\{)/, (match, classDeclaration) => `${classDeclaration}\n${fields}`);

    const imports = sortedCipherClasses.map(cipherClass => `import ${packageName}.service.cipher.${cipherClass}IdCipher;`).join('\n');
    return source.replace(
      /import org\.mapstruct/,
      () => `${imports}\nimport org.springframework.beans.factory.annotation.Autowired;\nimport org.mapstruct`,
    );
  });

  return cipherClasses;
}

function convertJavaMapperTest(generator, testJavaPackageDir, packageName, entity, cipherClasses) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const resourcePath = `${testJavaPackageDir}/${dir}service/mapper/${persistClass}MapperTest.java`;
  const mapperVar = changeCase.camelCase(persistClass);
  const sortedCipherClasses = [...cipherClasses].sort();

  const imports = sortedCipherClasses.map(cipherClass => `import ${packageName}.service.cipher.${cipherClass}IdCipher;`).join('\n');
  const setters = sortedCipherClasses
    .map(cipherClass => `${mapperVar}Mapper.set${cipherClass}IdCipher(new ${cipherClass}IdCipher(applicationProperties));`)
    .join('\n');

  const regExNeedles = [
    {
      regex: /import org.junit.jupiter.api.Test;/gm,
      content: `${imports}\nimport ${packageName}.config.ApplicationProperties;\nimport org.junit.jupiter.api.Test;`,
    },
    {
      regex: new RegExp(`${mapperVar}Mapper = new ${persistClass}MapperImpl\\(\\);`, 'gm'),
      content:
        `${mapperVar}Mapper = new ${persistClass}MapperImpl();\n` +
        `ApplicationProperties applicationProperties = new ApplicationProperties();\n` +
        `applicationProperties.getEncryptId().setKey("test");\n${setters}`,
    },
  ];

  replaceRegexNeedles(generator, resourcePath, regExNeedles);
}

function convertJavaResource(generator, mainJavaPackageDir, packageName, entity) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const entityPackage = entityPackageName(packageName, entity);
  const resourcePath = `${mainJavaPackageDir}/${dir}web/rest/${persistClass}Resource.java`;
  const entityVar = changeCase.camelCase(persistClass);

  replaceLongToStringNeedles(generator, resourcePath, ['Long id']);

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(entityPackage)}\\.service\\.dto\\.${persistClass}DTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.${persistClass}IdCipher;\nimport ${entityPackage}.service.dto.${persistClass}DTO;\n`,
    },
    {
      regex: new RegExp(`private final ${persistClass}Repository ${entityVar}Repository;`, 'gm'),
      content: `private final ${persistClass}Repository ${entityVar}Repository;\n\nprivate final ${persistClass}IdCipher ${entityVar}IdCipher;`,
    },
    {
      regex: new RegExp(` {4}${persistClass}Repository ${entityVar}Repository`, 'gm'),
      content: `${persistClass}Repository ${entityVar}Repository,\n${persistClass}IdCipher ${entityVar}IdCipher`,
    },
    {
      regex: new RegExp(`this.${entityVar}Repository = ${entityVar}Repository;`, 'gm'),
      content: `this.${entityVar}Repository = ${entityVar}Repository;\nthis.${entityVar}IdCipher = ${entityVar}IdCipher;`,
    },
    {
      regex: new RegExp(`${entityVar}Repository.existsById\\(id\\)`, 'gm'),
      content: `${entityVar}Repository.existsById(${entityVar}IdCipher.decrypt(id))`,
    },
  ];

  replaceRegexNeedles(generator, resourcePath, regExNeedles);
}

/**
 * The generated integration test talks to the REST API, so it has to use encrypted
 * ids in the urls and expect encrypted ids in the responses.
 */
function convertJavaResourceIT(generator, testJavaPackageDir, packageName, entity) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const entityPackage = entityPackageName(packageName, entity);
  const resourceITPath = `${testJavaPackageDir}/${dir}web/rest/${persistClass}ResourceIT.java`;
  const entityVar = changeCase.camelCase(persistClass);
  const dtoVar = `${entityVar}DTO`;
  const cipherVar = cipherField(persistClass);

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(entityPackage)}\\.service\\.dto\\.${persistClass}DTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.${persistClass}IdCipher;\nimport ${entityPackage}.service.dto.${persistClass}DTO;`,
    },
    {
      regex: new RegExp(`private MockMvc rest${persistClass}MockMvc;`, 'gm'),
      content: `private MockMvc rest${persistClass}MockMvc;\n\n    @Autowired\n    private ${persistClass}IdCipher ${cipherVar};`,
    },
    // The response contains the encrypted id, not the numeric database id.
    {
      regex: new RegExp(`\\b${entityVar}\\.getId\\(\\)\\.intValue\\(\\)`, 'gm'),
      content: `${cipherVar}.encrypt(${entityVar}.getId())`,
    },
    // A partial update sends the entity itself, its id has to be encrypted as well.
    {
      regex: new RegExp(`om\\.writeValueAsBytes\\(partialUpdated${persistClass}\\)`, 'gm'),
      content: `om.writeValueAsBytes(${entityVar}Mapper.toDto(partialUpdated${persistClass}))`,
    },
  ];

  replaceRegexNeedles(generator, resourceITPath, regExNeedles);

  // Every id used as a path variable has to be encrypted, unless it already comes from a DTO.
  transformFile(generator, resourceITPath, content =>
    content.replace(/ENTITY_API_URL_ID,\s*([A-Za-z_][A-Za-z0-9_.]*(?:\(\))?)/g, (match, expression) =>
      expression.startsWith(`${dtoVar}.`) ? match : `ENTITY_API_URL_ID, ${cipherVar}.encrypt(${expression})`,
    ),
  );
}

function convertJavaService(generator, mainJavaPackageDir, packageName, entity) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const entityPackage = entityPackageName(packageName, entity);
  const entityVar = changeCase.camelCase(persistClass);

  const servicePath = `${mainJavaPackageDir}/${dir}service/${persistClass}Service.java`;
  const serviceImplPath = `${mainJavaPackageDir}/${dir}service/impl/${persistClass}ServiceImpl.java`;

  replaceLongToStringNeedles(generator, servicePath, ['findOne(Long id)', 'delete(Long id)']);
  replaceLongToStringNeedles(generator, serviceImplPath, ['findOne(Long id)', 'delete(Long id)']);

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(entityPackage)}\\.service\\.dto\\.${persistClass}DTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.${persistClass}IdCipher;\nimport ${entityPackage}.service.dto.${persistClass}DTO;\n`,
    },
    {
      regex: new RegExp(`private final ${persistClass}Mapper ${entityVar}Mapper;`, 'gm'),
      content: `private final ${persistClass}Mapper ${entityVar}Mapper;\n\nprivate final ${persistClass}IdCipher ${entityVar}IdCipher;`,
    },
    {
      regex: new RegExp(` {4}${persistClass}Mapper ${entityVar}Mapper`, 'gm'),
      content: `${persistClass}Mapper ${entityVar}Mapper,\n${persistClass}IdCipher ${entityVar}IdCipher`,
    },
    {
      regex: new RegExp(`this.${entityVar}Mapper = ${entityVar}Mapper;`, 'gm'),
      content: `this.${entityVar}Mapper = ${entityVar}Mapper;\nthis.${entityVar}IdCipher = ${entityVar}IdCipher;`,
    },
    {
      regex: new RegExp(`${entityVar}DTO.getId\\(\\)`, 'gm'),
      content: `${entityVar}IdCipher.decrypt(${entityVar}DTO.getId())`,
    },
    {
      regex: new RegExp(`${entityVar}Repository.findById\\(id\\)`, 'gm'),
      content: `${entityVar}Repository.findById(${entityVar}IdCipher.decrypt(id))`,
    },
    {
      regex: new RegExp(`${entityVar}Repository.deleteById\\(id\\)`, 'gm'),
      content: `${entityVar}Repository.deleteById(${entityVar}IdCipher.decrypt(id))`,
    },
    {
      regex: new RegExp(`${entityVar}Repository.findOneWithEagerRelationships\\(id\\)`, 'gm'),
      content: `${entityVar}Repository.findOneWithEagerRelationships(${entityVar}IdCipher.decrypt(id))`,
    },
  ];

  replaceRegexNeedles(generator, serviceImplPath, regExNeedles);
}

/* -------------------------------------------------------------------------- */
/* java - user                                                                */
/* -------------------------------------------------------------------------- */

function convertJavaUserDTO(generator, mainJavaPackageDir, packageName) {
  const userPath = `${mainJavaPackageDir}/service/dto/UserDTO.java`;
  const adminUserPath = `${mainJavaPackageDir}/service/dto/AdminUserDTO.java`;

  replaceLongToStringNeedles(generator, userPath, ['Long id', 'Long getId()', 'setId(Long id)']);
  replaceLongToStringNeedles(generator, adminUserPath, ['Long id', 'Long getId()', 'setId(Long id)']);

  const regExNeedles = [
    {
      regex: /import java.io.Serializable;/gm,
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport java.io.Serializable;\n`,
    },
    {
      regex: /UserDTO\(User user\)/gm,
      content: `UserDTO(User user, UserIdCipher userIdCipher)`,
    },
    {
      regex: /this.id = user.getId\(\)/gm,
      content: `this.id = userIdCipher.encrypt(user.getId())`,
    },
  ];

  replaceRegexNeedles(generator, userPath, regExNeedles);
  replaceRegexNeedles(generator, adminUserPath, regExNeedles);
}

function convertJavaUserMapper(generator, mainJavaPackageDir, packageName) {
  const path = `${mainJavaPackageDir}/service/mapper/UserMapper.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(packageName)}\\.service\\.dto\\.UserDTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport ${packageName}.service.dto.UserDTO;\n`,
    },
    {
      regex: /public class UserMapper \{/gm,
      content: `public class UserMapper {\n\nprivate final UserIdCipher userIdCipher;\npublic UserMapper(UserIdCipher userIdCipher) {\nthis.userIdCipher = userIdCipher;\n}`,
    },
    {
      regex: /user.setId\(userDTO.getId\(\)\);/gm,
      content: `user.setId(userIdCipher.decrypt(userDTO.getId()));`,
    },
    {
      regex: /userDto.setId\(user.getId\(\)\);/gm,
      content: `userDto.setId(userIdCipher.encrypt(user.getId()));`,
    },
    {
      regex: /DTO\(user\);/gm,
      content: `DTO(user, userIdCipher);`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaUserMapperTest(generator, testJavaPackageDir, packageName) {
  const path = `${testJavaPackageDir}/service/mapper/UserMapperTest.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(packageName)}\\.service\\.dto\\.UserDTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport ${packageName}.config.ApplicationProperties;\nimport ${packageName}.service.dto.UserDTO;\n`,
    },
    {
      regex: /userMapper = new UserMapper\(/gm,
      content: `ApplicationProperties applicationProperties = new ApplicationProperties();\napplicationProperties.getEncryptId().setKey("test");\nUserIdCipher userIdCipher = new UserIdCipher(applicationProperties);\nuserMapper = new UserMapper(userIdCipher`,
    },
    {
      regex: /userDto = new AdminUserDTO\(user/gm,
      content: `userDto = new AdminUserDTO(user, userIdCipher`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaAccountResource(generator, mainJavaPackageDir, packageName) {
  const path = `${mainJavaPackageDir}/web/rest/AccountResource.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(packageName)}\\.service\\.dto\\.AdminUserDTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport ${packageName}.service.dto.AdminUserDTO;\n`,
    },
    {
      regex: /private final MailService mailService;/gm,
      content: `private final MailService mailService;\n\nprivate final UserIdCipher userIdCipher;`,
    },
    {
      regex: /MailService mailService\) \{/gm,
      content: `MailService mailService, UserIdCipher userIdCipher) {`,
    },
    {
      regex: /this.mailService = mailService;/gm,
      content: `this.mailService = mailService;\nthis.userIdCipher = userIdCipher;`,
    },
    {
      regex: /\(AdminUserDTO::new\)/gm,
      content: `(user -> new AdminUserDTO(user, userIdCipher))`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaAccountResourceIT(generator, testJavaPackageDir, packageName) {
  const path = `${testJavaPackageDir}/web/rest/AccountResourceIT.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(packageName)}\\.service\\.dto\\.AdminUserDTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport ${packageName}.service.dto.AdminUserDTO;\n`,
    },
    {
      regex: /private MockMvc restAccountMockMvc;/gm,
      content: `private MockMvc restAccountMockMvc;\n\n@Autowired\nprivate UserIdCipher userIdCipher;`,
    },
    {
      regex: /new AdminUserDTO\(testUser4.orElseThrow\(\)/gm,
      content: `new AdminUserDTO(testUser4.orElseThrow(), userIdCipher`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaUserResource(generator, mainJavaPackageDir, packageName) {
  const path = `${mainJavaPackageDir}/web/rest/UserResource.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(packageName)}\\.service\\.dto\\.AdminUserDTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport ${packageName}.service.dto.AdminUserDTO;\n`,
    },
    {
      regex: /private final MailService mailService;/gm,
      content: `private final MailService mailService;\n\nprivate final UserIdCipher userIdCipher;`,
    },
    {
      regex: /MailService mailService\) \{/gm,
      content: `MailService mailService, UserIdCipher userIdCipher) {`,
    },
    {
      regex: /this.mailService = mailService;/gm,
      content: `this.mailService = mailService;\nthis.userIdCipher = userIdCipher;`,
    },
    {
      regex: /\(AdminUserDTO::new\)/gm,
      content: `(user -> new AdminUserDTO(user, userIdCipher))`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaUserService(generator, mainJavaPackageDir, packageName) {
  const path = `${mainJavaPackageDir}/service/UserService.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(packageName)}\\.service\\.dto\\.UserDTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport ${packageName}.service.dto.UserDTO;\n`,
    },
    {
      regex: /private final UserRepository userRepository;/gm,
      content: `private final UserRepository userRepository;\n\nprivate final UserIdCipher userIdCipher;`,
    },
    {
      regex: /, CacheManager cacheManager/gm,
      content: `, CacheManager cacheManager, UserIdCipher userIdCipher`,
    },
    {
      regex: /this.cacheManager = cacheManager;/gm,
      content: `this.cacheManager = cacheManager;\nthis.userIdCipher = userIdCipher;`,
    },
    {
      regex: /userDTO.getId\(\)/gm,
      content: `userIdCipher.decrypt(userDTO.getId())`,
    },
    {
      regex: /\(AdminUserDTO::new\)/gm,
      content: `(user -> new AdminUserDTO(user, userIdCipher))`,
    },
    {
      regex: /\(UserDTO::new\)/gm,
      content: `(user -> new UserDTO(user, userIdCipher))`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaUserResourceIT(generator, testJavaPackageDir, packageName) {
  const path = `${testJavaPackageDir}/web/rest/UserResourceIT.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(packageName)}\\.service\\.dto\\.AdminUserDTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport ${packageName}.service.dto.AdminUserDTO;\n`,
    },
    {
      regex: /private UserMapper userMapper;/gm,
      content: `private UserMapper userMapper;\n@Autowired\nprivate UserIdCipher userIdCipher;`,
    },
    {
      regex: /AdminUserDTO\(\);\n {8}user.setId\(DEFAULT_ID\)/gm,
      content: `AdminUserDTO();\n        user.setId(userIdCipher.encrypt(DEFAULT_ID))`,
    },
    {
      regex: /userDTO.setId\(DEFAULT_ID\)/gm,
      content: `userDTO.setId(userIdCipher.encrypt(DEFAULT_ID))`,
    },
    {
      regex: /user.setId\(updatedUser.getId\(\)\)/gm,
      content: `user.setId(userIdCipher.encrypt(updatedUser.getId()))`,
    },
    {
      regex: /userDTO.setId\(updatedUser.getId\(\)\)/gm,
      content: `userDTO.setId(userIdCipher.encrypt(updatedUser.getId()))`,
    },
    // Only the id of the DTO is encrypted, the id of the User entity stays numeric.
    {
      regex: /assertThat\(userDTO\.getId\(\)\)\.isEqualTo\(DEFAULT_ID\)/gm,
      content: `assertThat(userDTO.getId()).isEqualTo(userIdCipher.encrypt(DEFAULT_ID))`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

export {
  collectNestedDtoClasses,
  convertAngularComponent,
  convertAngularComponentSpecs,
  convertAngularDeleteDialog,
  convertAngularDeleteDialogSpec,
  convertAngularModel,
  convertAngularRouteSpec,
  convertAngularService,
  convertAngularServiceSpec,
  convertAngularTestSamples,
  convertAngularUpdateHtml,
  convertAngularUser,
  convertAngularUserManagement,
  convertAngularUserManagementList,
  convertJavaAccountResource,
  convertJavaAccountResourceIT,
  convertJavaApplicationProperties,
  convertJavaApplicationYml,
  convertJavaDto,
  convertJavaMapper,
  convertJavaMapperTest,
  convertJavaResource,
  convertJavaResourceIT,
  convertJavaService,
  convertJavaUserDTO,
  convertJavaUserMapper,
  convertJavaUserMapperTest,
  convertJavaUserResource,
  convertJavaUserResourceIT,
  convertJavaUserService,
  quoteJsonIds,
};
