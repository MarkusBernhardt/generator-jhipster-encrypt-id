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
  const path = `${clientSrcDir}/app/entities/${changeCase.kebabCase(persistClass)}/delete/${changeCase.kebabCase(
    persistClass,
  )}-delete-dialog.component.ts`;

  replaceNumberToStringNeedles(generator, path, ['confirmDelete(id: number)']);
}

function convertAngularModel(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const path = `${clientSrcDir}/app/entities/${changeCase.kebabCase(persistClass)}/${changeCase.kebabCase(persistClass)}.model.ts`;

  replaceNumberToStringNeedles(generator, path, ['id: number;']);
}

function convertAngularService(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const path = `${clientSrcDir}/app/entities/${changeCase.kebabCase(persistClass)}/service/${changeCase.kebabCase(
    persistClass,
  )}.service.ts`;

  replaceNumberToStringNeedles(generator, path, ['find(id: number)', 'delete(id: number)', '>): number {']);
}

function convertAngularUserManagement(generator, clientSrcDir) {
  const path = `${clientSrcDir}/app/admin/user-management/user-management.model.ts`;

  replaceNumberToStringNeedles(generator, path, ['id: number | null']);
}

function convertAngularUserManagementList(generator, clientSrcDir) {
  const path = `${clientSrcDir}/app/admin/user-management/list/user-management.component.ts`;

  replaceNumberToStringNeedles(generator, path, [', item: User): number']);
}

function convertAngularUpdateHtml(generator, clientSrcDir, entity) {
  const { persistClass } = entity;
  const path = `${clientSrcDir}/app/entities/${changeCase.kebabCase(persistClass)}/update/${changeCase.kebabCase(
    persistClass,
  )}-update.component.html`;

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
  const { persistClass } = entity;
  const resourcePath = `${mainJavaPackageDir}/service/mapper/${persistClass}Mapper.java`;

  const regExNeedles = [
    {
      regex: /import org.mapstruct/gm,
      content: `import ${packageName}.service.cipher.${persistClass}IdCipher;\nimport org.springframework.beans.factory.annotation.Autowired;\nimport org.mapstruct`,
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
      )}IdCipher.decrypt(dto.getId()))")\npublic abstract ${persistClass} toEntity`,
    });
  } else {
    regExNeedles.push({
      regex: /> \{/gm,
      content: `> {\n@Mapping(target = "id", expression = "java(${changeCase.camelCase(
        persistClass,
      )}IdCipher.decrypt(dto.getId()))")\npublic abstract ${persistClass} toEntity(${persistClass}DTO dto);`,
    });
  }

  if (findRegexNeedle(generator, resourcePath, `${persistClass}DTO toDto`)) {
    regExNeedles.push({
      regex: new RegExp(`${persistClass}DTO toDto`, 'gm'),
      content: `@Mapping(target = "id", expression = "java(${changeCase.camelCase(
        persistClass,
      )}IdCipher.encrypt(s.getId()))")\npublic abstract ${persistClass}DTO toDto`,
    });
  } else {
    regExNeedles.push({
      regex: /> \{/gm,
      content: `> {\n@Mapping(target = "id", expression = "java(${changeCase.camelCase(
        persistClass,
      )}IdCipher.encrypt(s.getId()))")\npublic abstract ${persistClass}DTO toDto(${persistClass} s);`,
    });
  }

  regExNeedles.push({
    regex: /> \{/gm,
    content: `> {\n    @Autowired\n    protected ${persistClass}IdCipher ${changeCase.camelCase(
      persistClass,
    )}IdCipher;\n\npublic void set${persistClass}IdCipher(${persistClass}IdCipher ${changeCase.camelCase(persistClass)}IdCipher) {
        this.${changeCase.camelCase(persistClass)}IdCipher = ${changeCase.camelCase(persistClass)}IdCipher;
    }`,
  });

  replaceRegexNeedles(generator, resourcePath, regExNeedles);
}

function convertJavaMapperTest(generator, testJavaPackageDir, packageName, entity) {
  const { persistClass } = entity;
  const resourcePath = `${testJavaPackageDir}/service/mapper/${persistClass}MapperTest.java`;

  const regExNeedles = [
    {
      regex: /import org.junit.jupiter.api.Test;/gm,
      content: `import ${packageName}.service.cipher.${persistClass}IdCipher;\nimport de.scmb.sultan.config.ApplicationProperties;\nimport org.junit.jupiter.api.Test;`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}Mapper = new ${persistClass}MapperImpl\\(\\);`, 'gm'),
      content: `${changeCase.camelCase(
        persistClass,
      )}Mapper = new ${persistClass}MapperImpl();\nApplicationProperties applicationProperties = new ApplicationProperties();\napplicationProperties.getEncryptId().setKey("test");\n${changeCase.camelCase(
        persistClass,
      )}Mapper.set${persistClass}IdCipher(new ${persistClass}IdCipher(applicationProperties));`,
    },
  ];

  replaceRegexNeedles(generator, resourcePath, regExNeedles);
}

function convertJavaResource(generator, mainJavaPackageDir, packageName, entity) {
  const { persistClass, entityPackage = '' } = entity;
  const resourcePath = `${mainJavaPackageDir}/${entityPackage}web/rest/${persistClass}Resource.java`;

  replaceLongToStringNeedles(generator, resourcePath, ['Long id']);

  const regExNeedles = [
    {
      regex: new RegExp(`import ${packageName}.service.dto.${persistClass}DTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.${persistClass}IdCipher;\nimport ${packageName}.service.dto.${persistClass}DTO;\n`,
    },
    {
      regex: new RegExp(`private final ${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository;`, 'gm'),
      content: `private final ${persistClass}Repository ${changeCase.camelCase(
        persistClass,
      )}Repository;\n\nprivate final ${persistClass}IdCipher ${changeCase.camelCase(persistClass)}IdCipher;`,
    },
    {
      regex: new RegExp(` {4}${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository`, 'gm'),
      content: `${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository,\n${persistClass}IdCipher ${changeCase.camelCase(
        persistClass,
      )}IdCipher`,
    },
    {
      regex: new RegExp(`this.${changeCase.camelCase(persistClass)}Repository = ${changeCase.camelCase(persistClass)}Repository;`, 'gm'),
      content: `this.${changeCase.camelCase(persistClass)}Repository = ${changeCase.camelCase(
        persistClass,
      )}Repository;\nthis.${changeCase.camelCase(persistClass)}IdCipher = ${changeCase.camelCase(persistClass)}IdCipher;`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.existsById\\(id\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}Repository.existsById(${changeCase.camelCase(persistClass)}IdCipher.decrypt(id))`,
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
      regex: new RegExp(`import ${packageName}.service.dto.${persistClass}DTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.${persistClass}IdCipher;\nimport ${packageName}.service.dto.${persistClass}DTO;\n`,
    },
    {
      regex: new RegExp(`private final ${persistClass}Mapper ${changeCase.camelCase(persistClass)}Mapper;`, 'gm'),
      content: `private final ${persistClass}Mapper ${changeCase.camelCase(
        persistClass,
      )}Mapper;\n\nprivate final ${persistClass}IdCipher ${changeCase.camelCase(persistClass)}IdCipher;`,
    },
    {
      regex: new RegExp(` {4}${persistClass}Mapper ${changeCase.camelCase(persistClass)}Mapper`, 'gm'),
      content: `${persistClass}Mapper ${changeCase.camelCase(persistClass)}Mapper,\n${persistClass}IdCipher ${changeCase.camelCase(
        persistClass,
      )}IdCipher`,
    },
    {
      regex: new RegExp(`this.${changeCase.camelCase(persistClass)}Mapper = ${changeCase.camelCase(persistClass)}Mapper;`, 'gm'),
      content: `this.${changeCase.camelCase(persistClass)}Mapper = ${changeCase.camelCase(
        persistClass,
      )}Mapper;\nthis.${changeCase.camelCase(persistClass)}IdCipher = ${changeCase.camelCase(persistClass)}IdCipher;`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}DTO.getId\\(\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}IdCipher.decrypt(${changeCase.camelCase(persistClass)}DTO.getId())`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.findById\\(id\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}Repository.findById(${changeCase.camelCase(persistClass)}IdCipher.decrypt(id))`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.deleteById\\(id\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}Repository.deleteById(${changeCase.camelCase(persistClass)}IdCipher.decrypt(id))`,
    },
    {
      regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.findOneWithEagerRelationships\\(id\\)`, 'gm'),
      content: `${changeCase.camelCase(persistClass)}Repository.findOneWithEagerRelationships(${changeCase.camelCase(
        persistClass,
      )}IdCipher.decrypt(id))`,
    },
  ];

  replaceRegexNeedles(generator, serviceImplPath, regExNeedles);
}

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
      regex: new RegExp(`import ${packageName}.service.dto.UserDTO;`, 'gm'),
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
      regex: new RegExp(`import ${packageName}.service.dto.UserDTO;`, 'gm'),
      content: `import ${packageName}.service.cipher.UserIdCipher;\nimport de.scmb.sultan.config.ApplicationProperties;\nimport ${packageName}.service.dto.UserDTO;\n`,
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
      regex: new RegExp(`import ${packageName}.service.dto.AdminUserDTO;`, 'gm'),
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
      regex: new RegExp(`import ${packageName}.service.dto.AdminUserDTO;`, 'gm'),
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
      regex: new RegExp(`import ${packageName}.service.dto.AdminUserDTO;`, 'gm'),
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
      regex: new RegExp(`import ${packageName}.service.dto.UserDTO;`, 'gm'),
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
      regex: new RegExp(`import ${packageName}.service.dto.AdminUserDTO;`, 'gm'),
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
      regex: /isEqualTo\(DEFAULT_ID\)/gm,
      content: `isEqualTo(userIdCipher.encrypt(DEFAULT_ID))`,
    },
  ];

  replaceRegexNeedles(generator, path, regExNeedles);
}

export {
  convertAngularComponent,
  convertAngularDeleteDialog,
  convertAngularModel,
  convertAngularService,
  convertAngularUserManagement,
  convertAngularUserManagementList,
  convertAngularUpdateHtml,
  convertJavaAccountResource,
  convertJavaAccountResourceIT,
  convertJavaApplicationProperties,
  convertJavaApplicationYml,
  convertJavaDto,
  convertJavaMapper,
  convertJavaMapperTest,
  convertJavaResource,
  convertJavaService,
  convertJavaUserDTO,
  convertJavaUserMapper,
  convertJavaUserMapperTest,
  convertJavaUserResource,
  convertJavaUserResourceIT,
  convertJavaUserService,
};
