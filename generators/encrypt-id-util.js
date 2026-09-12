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

/**
 * Add a parameter to the constructor of a class.
 *
 * The parameter list of a generated constructor is written on a single line by some
 * templates and spread over several lines by others, so the whole signature is matched
 * instead of one of its parameters.
 */
function addConstructorParameter(content, className, type, name) {
  const signatureRegex = new RegExp(`(public ${escapeRegExp(className)}\\(\\s*)([^)]*?)(\\s*\\)\\s*\\{)`);

  return content.replace(signatureRegex, (match, open, parameters, close) =>
    parameters.trim() === '' ? `${open}${type} ${name}${close}` : `${open}${parameters}, ${type} ${name}${close}`,
  );
}

/* -------------------------------------------------------------------------- */
/* angular                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Directory of the client files of an entity.
 *
 * JHipster derives it from the entity, it is `alpha` for a generated entity and
 * `admin/user-management` for the built in user administration.
 */
const entityClientDir = (clientSrcDir, { entityFolderName }) => `${clientSrcDir}/app/entities/${entityFolderName}`;

function convertAngularModel(generator, clientSrcDir, entity) {
  const path = `${entityClientDir(clientSrcDir, entity)}/${entity.entityFileName}.model.ts`;

  // `id: number;` for a generated entity, `id?: number | null;` for the user administration.
  replaceNumberToStringNeedles(generator, path, ['id: number;', 'id?: number | null;']);
}

function convertAngularService(generator, clientSrcDir, entity) {
  const path = `${entityClientDir(clientSrcDir, entity)}/service/${entity.entityFileName}.service.ts`;

  replaceNumberToStringNeedles(generator, path, ['find(id: number)', 'delete(id: number)', '>): number {']);
}

function convertAngularList(generator, clientSrcDir, entity) {
  const path = `${entityClientDir(clientSrcDir, entity)}/list/${entity.entityFileName}.ts`;

  replaceNumberToStringNeedles(generator, path, ['): number => this.']);
}

function convertAngularDeleteDialog(generator, clientSrcDir, entity) {
  const path = `${entityClientDir(clientSrcDir, entity)}/delete/${entity.entityFileName}-delete-dialog.ts`;

  replaceNumberToStringNeedles(generator, path, ['confirmDelete(id: number)']);
}

/** The service is called with the encrypted id, so the test has to pass a string. */
function convertAngularServiceSpec(generator, clientSrcDir, entity) {
  const path = `${entityClientDir(clientSrcDir, entity)}/service/${entity.entityFileName}.service.spec.ts`;

  const regExNeedles = [{ regex: /(service\.(?:find|delete))\((\d+)\)/gm, content: "$1('$2')" }];

  replaceRegexNeedles(generator, path, regExNeedles);
}

/** The delete dialog is called with the encrypted id, so the test has to pass a string. */
function convertAngularDeleteDialogSpec(generator, clientSrcDir, entity) {
  const path = `${entityClientDir(clientSrcDir, entity)}/delete/${entity.entityFileName}-delete-dialog.spec.ts`;

  const regExNeedles = [
    { regex: /confirmDelete\((\d+)\)/gm, content: "confirmDelete('$1')" },
    { regex: /(delete\)\.toHaveBeenCalledWith)\((\d+)\)/gm, content: "$1('$2')" },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

/**
 * The route resolver is called with the encrypted id of the url, so the mocked route
 * parameter of the test has to be a string as well.
 */
function convertAngularRouteSpec(generator, clientSrcDir, entity) {
  const path = `${entityClientDir(clientSrcDir, entity)}/route/${entity.entityFileName}-routing-resolve.service.spec.ts`;

  const regExNeedles = [
    { regex: /\{ id: (\d+) \}/gm, content: "{ id: '$1' }" },
    { regex: /(find\)\.toHaveBeenCalledWith)\((\d+)\)/gm, content: "$1('$2')" },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

/**
 * Only the id input has to become a text input. Converting every number input
 * would also break the numeric fields of the entity.
 */
function convertAngularUpdateHtml(generator, clientSrcDir, entity) {
  const path = `${entityClientDir(clientSrcDir, entity)}/update/${entity.entityFileName}-update.html`;

  const regExNeedles = [{ regex: /<input type="number"([^>]*\bname="id")/gm, content: '<input type="text"$1' }];

  replaceRegexNeedles(generator, path, regExNeedles);
}

/**
 * Quote the numeric ids of the test fixtures.
 *
 * The entity an id belongs to is taken from the type of the declaration
 * (`const beta: IBeta = { id: 1 }`), from the surrounding `describe('compare<Entity>')`
 * block or, if neither is present, from the entity the file belongs to. Ids of entities
 * without an encrypted id have to stay numeric.
 */
function quoteObjectIds(content, encryptedClasses, ownerClass) {
  let compareClass;

  return content
    .split('\n')
    .map(line => {
      if (line.includes('describe(')) {
        compareClass = /\bdescribe\(\s*'compare(\w+)'/.exec(line)?.[1];
      }

      const otherClass = /:\s*I(\w+)(?:\[\])?\s*=/.exec(line)?.[1] ?? compareClass ?? ownerClass;
      if (!encryptedClasses.has(otherClass)) {
        return line;
      }

      return line.replace(/\bid\s*:\s*(\d+)/g, "id: '$1'");
    })
    .join('\n');
}

/** The test fixtures use the numeric ids of the entity and of all its relationships. */
function convertAngularTestFixtures(generator, clientSrcDir, entity, encryptedClasses) {
  const dir = entityClientDir(clientSrcDir, entity);
  const { entityFileName, persistClass } = entity;
  const paths = [
    `${dir}/${entityFileName}.test-samples.ts`,
    `${dir}/detail/${entityFileName}-detail.spec.ts`,
    `${dir}/list/${entityFileName}.spec.ts`,
    `${dir}/service/${entityFileName}.service.spec.ts`,
    `${dir}/update/${entityFileName}-update.spec.ts`,
  ];

  for (const path of paths) {
    transformFile(generator, path, content => quoteObjectIds(content, encryptedClasses, persistClass));
  }
}

/* -------------------------------------------------------------------------- */
/* java - application wide                                                    */
/* -------------------------------------------------------------------------- */

function convertJavaApplicationProperties(generator, javaPackageSrcDir) {
  const applicationPropertiesPath = `${javaPackageSrcDir}/config/ApplicationProperties.java`;

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

function convertJavaApplicationYml(generator, srcMainResources) {
  const applicationYmlPaths = [
    `${srcMainResources}/config/application.yml`,
    `${srcMainResources}/config/application-dev.yml`,
    `${srcMainResources}/config/application-prod.yml`,
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

function convertJavaDto(generator, javaPackageSrcDir, javaPackageTestDir, entity) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const dtoName = `${persistClass}DTO`;
  const dtoPath = `${javaPackageSrcDir}/${dir}service/dto/${dtoName}.java`;

  replaceLongToStringNeedles(generator, dtoPath, ['private Long id', 'Long getId()', 'setId(Long id)']);

  if (!entity.builtIn) {
    const dtoTestPath = `${javaPackageTestDir}/${dir}service/dto/${dtoName}Test.java`;
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
function convertJavaMapper(generator, javaPackageSrcDir, packageName, entity, encryptedClasses) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const mapperPath = `${javaPackageSrcDir}/${dir}service/mapper/${persistClass}Mapper.java`;
  const dtoPath = `${javaPackageSrcDir}/${dir}service/dto/${persistClass}DTO.java`;

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

function convertJavaMapperTest(generator, javaPackageTestDir, packageName, entity, cipherClasses) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const resourcePath = `${javaPackageTestDir}/${dir}service/mapper/${persistClass}MapperTest.java`;
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

function convertJavaResource(generator, javaPackageSrcDir, packageName, entity) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const entityPackage = entityPackageName(packageName, entity);
  const resourcePath = `${javaPackageSrcDir}/${dir}web/rest/${persistClass}Resource.java`;
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
function convertJavaResourceIT(generator, javaPackageTestDir, packageName, entity) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const entityPackage = entityPackageName(packageName, entity);
  const resourceITPath = `${javaPackageTestDir}/${dir}web/rest/${persistClass}ResourceIT.java`;
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

function convertJavaService(generator, javaPackageSrcDir, packageName, entity) {
  const { persistClass } = entity;
  const dir = entityDir(entity);
  const entityPackage = entityPackageName(packageName, entity);
  const entityVar = changeCase.camelCase(persistClass);

  const servicePath = `${javaPackageSrcDir}/${dir}service/${persistClass}Service.java`;
  const serviceImplPath = `${javaPackageSrcDir}/${dir}service/impl/${persistClass}ServiceImpl.java`;

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

function convertJavaUserDTO(generator, javaPackageSrcDir, packageName) {
  const userPath = `${javaPackageSrcDir}/service/dto/UserDTO.java`;
  const adminUserPath = `${javaPackageSrcDir}/service/dto/AdminUserDTO.java`;

  replaceLongToStringNeedles(generator, userPath, ['Long id', 'Long getId()', 'setId(Long id)']);
  replaceLongToStringNeedles(generator, adminUserPath, ['Long id', 'Long getId()', 'setId(Long id)']);

  const regExNeedles = [
    {
      regex: /import java.io.Serializable;/gm,
      content: `import com.fasterxml.jackson.annotation.JsonCreator;\nimport ${packageName}.service.cipher.UserIdCipher;\nimport java.io.Serializable;\n`,
    },
    // Jackson picks a constructor with several parameters as a creator, which breaks the
    // deserialization of the dto, so the constructor has to be excluded explicitly.
    {
      regex: /public (\w*UserDTO)\(User user\)/gm,
      content: `@JsonCreator(mode = JsonCreator.Mode.DISABLED)\npublic $1(User user, UserIdCipher userIdCipher)`,
    },
    {
      regex: /this.id = user.getId\(\)/gm,
      content: `this.id = userIdCipher.encrypt(user.getId())`,
    },
  ];

  replaceRegexNeedles(generator, userPath, regExNeedles);
  replaceRegexNeedles(generator, adminUserPath, regExNeedles);
}

function convertJavaUserMapper(generator, javaPackageSrcDir, packageName) {
  const path = `${javaPackageSrcDir}/service/mapper/UserMapper.java`;

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

function convertJavaUserMapperTest(generator, javaPackageTestDir, packageName) {
  const path = `${javaPackageTestDir}/service/mapper/UserMapperTest.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(packageName)}\\.service\\.dto\\.UserDTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport ${packageName}.config.ApplicationProperties;\nimport ${packageName}.service.dto.UserDTO;\n`,
    },
    // The cipher is a field, the assertions of the test methods use it as well.
    {
      regex: /private UserMapper userMapper;/gm,
      content: `private UserMapper userMapper;\n\nprivate UserIdCipher userIdCipher;`,
    },
    {
      regex: /userMapper = new UserMapper\(/gm,
      content: `ApplicationProperties applicationProperties = new ApplicationProperties();\napplicationProperties.getEncryptId().setKey("test");\nuserIdCipher = new UserIdCipher(applicationProperties);\nuserMapper = new UserMapper(userIdCipher`,
    },
    {
      regex: /userDto = new AdminUserDTO\(user/gm,
      content: `userDto = new AdminUserDTO(user, userIdCipher`,
    },
    // The dto carries the encrypted id, the entity the plain one, so they cannot be compared directly.
    {
      regex: /assertThat\(convertedUserDto\.getId\(\)\)\.isEqualTo\(user\.getId\(\)\);/gm,
      content: `assertThat(convertedUserDto.getId()).isEqualTo(userIdCipher.encrypt(user.getId()));`,
    },
    {
      regex: /assertThat\(convertedUser\.getId\(\)\)\.isEqualTo\(userDto\.getId\(\)\);/gm,
      content: `assertThat(convertedUser.getId()).isEqualTo(userIdCipher.decrypt(userDto.getId()));`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaAccountResource(generator, javaPackageSrcDir, packageName) {
  const path = `${javaPackageSrcDir}/web/rest/AccountResource.java`;

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
      regex: /this.mailService = mailService;/gm,
      content: `this.mailService = mailService;\nthis.userIdCipher = userIdCipher;`,
    },
    {
      regex: /\(AdminUserDTO::new\)/gm,
      content: `(user -> new AdminUserDTO(user, userIdCipher))`,
    },
  ];

  transformFile(generator, path, content => addConstructorParameter(content, 'AccountResource', 'UserIdCipher', 'userIdCipher'));
  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaAccountResourceIT(generator, javaPackageTestDir, packageName) {
  const path = `${javaPackageTestDir}/web/rest/AccountResourceIT.java`;

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

function convertJavaUserResource(generator, javaPackageSrcDir, packageName) {
  const path = `${javaPackageSrcDir}/web/rest/UserResource.java`;

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
      regex: /this.mailService = mailService;/gm,
      content: `this.mailService = mailService;\nthis.userIdCipher = userIdCipher;`,
    },
    {
      regex: /\(AdminUserDTO::new\)/gm,
      content: `(user -> new AdminUserDTO(user, userIdCipher))`,
    },
    // Creating a user answers with the User entity, which would expose the plain id.
    {
      regex: /ResponseEntity<User> createUser\(/gm,
      content: `ResponseEntity<AdminUserDTO> createUser(`,
    },
    {
      regex: /\.body\(newUser\)/gm,
      content: `.body(new AdminUserDTO(newUser, userIdCipher))`,
    },
    // The id of the entity is a Long, the id of the dto the encrypted String.
    {
      regex: /\.getId\(\)\.equals\(userDTO\.getId\(\)\)/gm,
      content: `.getId().equals(userIdCipher.decrypt(userDTO.getId()))`,
    },
  ];

  transformFile(generator, path, content => addConstructorParameter(content, 'UserResource', 'UserIdCipher', 'userIdCipher'));
  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaUserService(generator, javaPackageSrcDir, packageName) {
  const path = `${javaPackageSrcDir}/service/UserService.java`;

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

  transformFile(generator, path, content => addConstructorParameter(content, 'UserService', 'UserIdCipher', 'userIdCipher'));
  replaceRegexNeedles(generator, path, regExNeedles);
}

/**
 * The public user api returns the encrypted id, so the json path of the test has to
 * match a string instead of a number.
 */
function convertJavaPublicUserResourceIT(generator, javaPackageTestDir, packageName) {
  const path = `${javaPackageTestDir}/web/rest/PublicUserResourceIT.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${escapeRegExp(packageName)}\\.repository\\.UserRepository;`, 'gm'),
      content: `import ${packageName}.repository.UserRepository;\nimport ${packageName}.service.cipher.UserIdCipher;`,
    },
    {
      regex: /private MockMvc restUserMockMvc;/gm,
      content: `private MockMvc restUserMockMvc;\n\n    @Autowired\n    private UserIdCipher userIdCipher;`,
    },
    {
      regex: /\$\.\[\?\(@\.id == %d\)\]([^"]*)"\.formatted\(user\.getId\(\)\)/gm,
      content: `$.[?(@.id == '%s')]$1".formatted(userIdCipher.encrypt(user.getId()))`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

function convertJavaUserResourceIT(generator, javaPackageTestDir, packageName) {
  const path = `${javaPackageTestDir}/web/rest/UserResourceIT.java`;

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
  addConstructorParameter,
  collectNestedDtoClasses,
  convertAngularDeleteDialog,
  convertAngularDeleteDialogSpec,
  convertAngularList,
  convertAngularModel,
  convertAngularRouteSpec,
  convertAngularService,
  convertAngularServiceSpec,
  convertAngularTestFixtures,
  convertAngularUpdateHtml,
  convertJavaAccountResource,
  convertJavaAccountResourceIT,
  convertJavaApplicationProperties,
  convertJavaApplicationYml,
  convertJavaDto,
  convertJavaMapper,
  convertJavaMapperTest,
  convertJavaPublicUserResourceIT,
  convertJavaResource,
  convertJavaResourceIT,
  convertJavaService,
  convertJavaUserDTO,
  convertJavaUserMapper,
  convertJavaUserMapperTest,
  convertJavaUserResource,
  convertJavaUserResourceIT,
  convertJavaUserService,
  quoteObjectIds,
};
