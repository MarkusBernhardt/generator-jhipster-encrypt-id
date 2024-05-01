import * as changeCase from 'change-case';

function findRegexNeedle(generator, filePath, needle) {
  let flag = false;
  generator.editFile(filePath, content => {
    if (content.includes(needle)) {
      flag = true;
    }
    return content;
  });
  return flag;
}

function replaceRegexNeedles(generator, filePath, replaceNeedles) {
  replaceNeedles.forEach(needle => {
    generator.editFile(filePath, contents => contents.replaceAll(needle.regex, needle.content));
  });
}

function replaceLongToStringNeedles(generator, filePath, replaceNeedles) {
  replaceNeedles.forEach(needle => {
    generator.editFile(filePath, contents => contents.replaceAll(needle, needle.replace('Long', 'String')));
  });
}

function replaceNumberToStringNeedles(generator, filePath, replaceNeedles) {
  replaceNeedles.forEach(needle => {
    generator.editFile(filePath, contents => contents.replaceAll(needle, needle.replace('number', 'string')));
  });
}

function replaceNumberToTextNeedles(generator, filePath, replaceNeedles) {
  replaceNeedles.forEach(needle => {
    generator.editFile(filePath, contents => contents.replaceAll(needle, needle.replace('number', 'text')));
  });
}

function convertAngularComponent(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const path = `${clientSrcDir}/app/entities/${changeCase.kebabCase(persistClass)}/list/${changeCase.kebabCase(persistClass)}.component.ts`;

  replaceNumberToStringNeedles(generator, path, ['): number => this.']);
}

function convertAngularDeleteDialog(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const path = `${clientSrcDir}/app/entities/${changeCase.kebabCase(persistClass)}/delete/${changeCase.kebabCase(persistClass)}-delete-dialog.component.ts`;

  replaceNumberToStringNeedles(generator, path, ['confirmDelete(id: number)']);
}

function convertAngularModel(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const path = `${clientSrcDir}/app/entities/${changeCase.kebabCase(persistClass)}/${changeCase.kebabCase(persistClass)}.model.ts`;

  replaceNumberToStringNeedles(generator, path, ['id: number;']);
}

function convertAngularService(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const path = `${clientSrcDir}/app/entities/${changeCase.kebabCase(persistClass)}/service/${changeCase.kebabCase(persistClass)}.service.ts`;

  replaceNumberToStringNeedles(generator, path, ['find(id: number)', 'delete(id: number)', '>): number {']);
}

function convertAngularUpdateHtml(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const path = `${clientSrcDir}/app/entities/${changeCase.kebabCase(persistClass)}/update/${changeCase.kebabCase(persistClass)}-update.component.html`;

  replaceNumberToTextNeedles(generator, path, ['<input type="number"']);
}

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

function convertJavaDto(generator, mainJavaPackageDir, testJavaPackageDir, entity) {
  const { persistClass, entityPackage = '' } = entity;
  const dtoName = `${persistClass}DTO`;
  const dtoPath = `${mainJavaPackageDir}/${entityPackage}service/dto/${dtoName}.java`;

  replaceLongToStringNeedles(generator, dtoPath, ['private Long id', 'Long getId()', 'setId(Long id)']);

  if (!entity.builtIn) {
    const dtoTestPath = `${testJavaPackageDir}/${entityPackage}service/dto/${dtoName}Test.java`;
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

function convertJavaMapper(generator, mainJavaPackageDir, packageName, entity) {
  const { persistClass, entityPackage = '' } = entity;
  const resourcePath = `${mainJavaPackageDir}/${entityPackage}service/mapper/${persistClass}Mapper.java`;

  const regExNeedles = [
    {
      regex: new RegExp(`import ${packageName}.service.dto.${persistClass}DTO;$`, 'gm'),
      content: `import ${packageName}.service.cipher.${persistClass}Cipher;\nimport ${packageName}.service.dto.${persistClass}DTO;\nimport org.springframework.beans.factory.annotation.Autowired;\n`,
    },
    {
      regex: /public interface/gm,
      content: `public abstract class`,
    },
    {
      regex: /extends/gm,
      content: `implements`,
    },
    {
      regex: /> {/gm,
      content: `> { \n@Autowired\nprotected ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;`,
    },
    {
      regex: /^ *([A-Za-z0-9]+ toDto[A-Za-z0-9]+)/gm,
      content: `public abstract $1`,
    },
    {
      regex: /^ *([A-Za-z0-9]+ toEntity[A-Za-z0-9]+)/gm,
      content: `public abstract $1`,
    },
  ];

  if (findRegexNeedle(generator, resourcePath, `${persistClass} toEntity`)) {
    regExNeedles.push({
      regex: new RegExp(`${persistClass} toEntity`, 'gm'),
      content: `@Mapping(target = "id", expression = "java(${changeCase.camelCase(
        persistClass,
      )}Cipher.decrypt(dto.getId()))")\npublic abstract ${persistClass} toEntity`,
    });
  } else {
    regExNeedles.push({
      regex: new RegExp(`protected ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;`, 'gm'),
      content: `protected ${persistClass}Cipher ${changeCase.camelCase(
        persistClass,
      )}Cipher;\n\n@Mapping(target = "id", expression = "java(${changeCase.camelCase(
        persistClass,
      )}Cipher.decrypt(dto.getId()))")\npublic abstract ${persistClass} toEntity(${persistClass}DTO dto);`,
    });
  }

  if (findRegexNeedle(generator, resourcePath, `${persistClass}DTO toDto`)) {
    regExNeedles.push({
      regex: new RegExp(`${persistClass}DTO toDto`, 'gm'),
      content: `@Mapping(target = "id", expression = "java(${changeCase.camelCase(
        persistClass,
      )}Cipher.encrypt(s.getId()))")\npublic abstract ${persistClass}DTO toDto`,
    });
  } else {
    regExNeedles.push({
      regex: new RegExp(`protected ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;`, 'gm'),
      content: `protected ${persistClass}Cipher ${changeCase.camelCase(
        persistClass,
      )}Cipher;\n\n@Mapping(target = "id", expression = "java(${changeCase.camelCase(
        persistClass,
      )}Cipher.encrypt(s.getId()))")\npublic abstract ${persistClass}DTO toDto(${persistClass} s);`,
    });
  }

  replaceRegexNeedles(generator, resourcePath, regExNeedles);
}

function convertJavaResource(generator, mainJavaPackageDir, packageName, entity) {
  const { persistClass, entityPackage = '' } = entity;
  const resourcePath = `${mainJavaPackageDir}/${entityPackage}web/rest/${persistClass}Resource.java`;

  replaceLongToStringNeedles(generator, resourcePath, ['Long id']);

  const regExNeedles = [
    {
      regex: new RegExp(`import ${packageName}.service.dto.${persistClass}DTO;$`, 'gm'),
      content: `import ${packageName}.service.cipher.${persistClass}Cipher;\nimport ${packageName}.service.dto.${persistClass}DTO;\n`,
    },
    {
      regex: new RegExp(`private final ${persistClass}Service ${changeCase.camelCase(persistClass)}Service;$`, 'gm'),
      content: `private final ${persistClass}Cipher ${changeCase.camelCase(
        persistClass,
      )}Cipher;\n\nprivate final ${persistClass}Service ${changeCase.camelCase(persistClass)}Service;\n`,
    },
    {
      regex: new RegExp(`        ${persistClass}Service ${changeCase.camelCase(persistClass)}Service`, 'gm'),
      content: `${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher, ${persistClass}Service ${changeCase.camelCase(
        persistClass,
      )}Service`,
    },
    {
      regex: new RegExp(`this.${changeCase.camelCase(persistClass)}Service = ${changeCase.camelCase(persistClass)}Service;`, 'gm'),
      content: `this.${changeCase.camelCase(persistClass)}Cipher = ${changeCase.camelCase(
        persistClass,
      )}Cipher;\nthis.${changeCase.camelCase(persistClass)}Service = ${changeCase.camelCase(persistClass)}Service;`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.existsById\\(id\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}Repository.existsById(${changeCase.camelCase(persistClass)}Cipher.decrypt(id))`,
    },
  ];

  replaceRegexNeedles(generator, resourcePath, regExNeedles);
}

function convertJavaService(generator, mainJavaPackageDir, packageName, entity) {
  const { persistClass, entityPackage = '' } = entity;

  const servicePath = `${mainJavaPackageDir}/${entityPackage}service/${persistClass}Service.java`;
  const serviceImplPath = `${mainJavaPackageDir}/${entityPackage}service/impl/${persistClass}ServiceImpl.java`;

  replaceLongToStringNeedles(generator, servicePath, ['findOne(Long id)', 'delete(Long id)']);
  replaceLongToStringNeedles(generator, serviceImplPath, ['findOne(Long id)', 'delete(Long id)']);

  const regExNeedles = [
    {
      regex: new RegExp(`import ${packageName}.service.dto.${persistClass}DTO;$`, 'gm'),
      content: `import ${packageName}.service.cipher.${persistClass}Cipher;\nimport ${packageName}.service.dto.${persistClass}DTO;\n`,
    },
    {
      regex: new RegExp(`private final ${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository;$`, 'gm'),
      content: `private final ${persistClass}Cipher ${changeCase.camelCase(
        persistClass,
      )}Cipher;\n\nprivate final ${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository;\n`,
    },
    {
      regex: new RegExp(`        ${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository`, 'gm'),
      content: `${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher, ${persistClass}Repository ${changeCase.camelCase(
        persistClass,
      )}Repository`,
    },
    {
      regex: new RegExp(`this.${changeCase.camelCase(persistClass)}Repository = ${changeCase.camelCase(persistClass)}Repository;`, 'gm'),
      content: `this.${changeCase.camelCase(persistClass)}Cipher = ${changeCase.camelCase(
        persistClass,
      )}Cipher;\nthis.${changeCase.camelCase(persistClass)}Repository = ${changeCase.camelCase(persistClass)}Repository;`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}DTO.getId\\(\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}Cipher.decrypt(${changeCase.camelCase(persistClass)}DTO.getId())`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.findById\\(id\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}Repository.findById(${changeCase.camelCase(persistClass)}Cipher.decrypt(id))`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.deleteById\\(id\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}Repository.deleteById(${changeCase.camelCase(persistClass)}Cipher.decrypt(id))`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.findOneWithEagerRelationships\\(id\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}Repository.findOneWithEagerRelationships(${changeCase.camelCase(
        persistClass,
      )}Cipher.decrypt(id))`,
    },
  ];

  replaceRegexNeedles(generator, serviceImplPath, regExNeedles);
}

export {
  convertAngularComponent,
  convertAngularDeleteDialog,
  convertAngularModel,
  convertAngularService,
  convertAngularUpdateHtml,
  convertJavaApplicationProperties,
  convertJavaApplicationYml,
  convertJavaDto,
  convertJavaMapper,
  convertJavaResource,
  convertJavaService,
};
