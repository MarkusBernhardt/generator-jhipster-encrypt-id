import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';
import { javaMainPackageTemplatesBlock } from 'generator-jhipster/generators/java/support';
import * as changeCase from "change-case";

export default class extends BaseApplicationGenerator {
  async beforeQueue() {
    await this.dependsOnJHipster('java');
  }

  get [BaseApplicationGenerator.CONFIGURING_EACH_ENTITY]() {
    return this.asConfiguringEachEntityTaskGroup({
      async configuringEachEntityTemplateTask({ entityName, entityConfig }) {
        const { encryptIdEntities } = this.options;
        entityConfig.enableEncryptId = encryptIdEntities?.includes(entityName) || entityConfig.enableEncryptId;
        if (!entityConfig.enableEncryptId) return;

        if (entityConfig.dto !== "mapstruct") {
          throw new Error('DTO with mapstruct required for entity ' + entityName);
        }

        if (entityConfig.service !== 'serviceImpl') {
          throw new Error('Service with serviceImpl required for entity ' + entityName);
        }
      },
    });
  }

  get [BaseApplicationGenerator.WRITING_ENTITIES]() {
    return this.asWritingEntitiesTaskGroup({
      async writingEntitiesTemplateTask({ application, entities }) {
        await Promise.all(
          entities
            .filter(e => e.enableEncryptId)
            .map(e =>
              this.writeFiles({
                blocks: [
                  javaMainPackageTemplatesBlock({
                    templates: ['service/cipher/_persistClass_Cipher.java'],
                  }),
                ],
                context: { ...application, ...e },
              }),
            ),
        );
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return {
      async postWritingTask({ application: { mainJavaPackageDir, mainJavaResourceDir } }) {
        this.convertApplicationProperties(mainJavaPackageDir);
        this.convertApplicationYml(mainJavaResourceDir);
      },
    };
  }

  get [BaseApplicationGenerator.POST_WRITING_ENTITIES]() {
    return {
      async postWritingEntitiesTask({ application: { mainJavaPackageDir, testJavaPackageDir, packageName }, entities }) {
        for (const entity of entities.filter(e => e.enableEncryptId)) {
          this.convertDto(mainJavaPackageDir, testJavaPackageDir, entity);
          this.convertMapper(mainJavaPackageDir, packageName, entity);
          this.convertResource(mainJavaPackageDir, packageName, entity);
          this.convertService(mainJavaPackageDir, packageName, entity);
        }
      },
    };
  }

  convertApplicationProperties(mainJavaPackageDir) {
    const applicationPropertiesPath = `${mainJavaPackageDir}/config/ApplicationProperties.java`;

    const regExNeedles = [
      {
        regex: new RegExp('jhipster-needle-application-properties-property$', 'gm'),
        content: 'jhipster-needle-application-properties-property\n    private final EncryptId encryptId = new EncryptId();\n'
      },
      {
        regex: new RegExp('jhipster-needle-application-properties-property-getter$', 'gm'),
        content: 'jhipster-needle-application-properties-property-getter\n    public EncryptId getEncryptId() {\n        return encryptId;\n    }\n'
      },
      {
        regex: new RegExp('jhipster-needle-application-properties-property-class$', 'gm'),
        content: 'jhipster-needle-application-properties-property-class\n    public static class EncryptId {\n        private String key = "";\n\n        public String getKey() {\n            return key;\n        }\n\n        public void setKey(String key) {\n            this.key = key;\n        }\n    }\n'
      },
    ];

    this.replaceRegexNeedles(applicationPropertiesPath, regExNeedles);
  }

  convertApplicationYml(mainJavaResourceDir) {
    const applicationYmlPaths = [
      `${mainJavaResourceDir}/config/application.yml`,
      `${mainJavaResourceDir}/config/application-dev.yml`,
      `${mainJavaResourceDir}/config/application-prod.yml`
    ];

    const regExNeedles = [
      {
        regex: new RegExp('^# application:$', 'gm'),
        content: 'application:'
      },
      {
        regex: new RegExp('^application:$', 'gm'),
        content: 'application:\n  scmb-encrypt-id:\n    key: "change me"'
      },
    ];

    for(const applicationYmlPath of applicationYmlPaths) {
      this.replaceRegexNeedles(applicationYmlPath, regExNeedles);
    }
  }

  convertDto(mainJavaPackageDir, testJavaPackageDir, entity) {
    const { persistClass, entityPackage = '' } = entity;
    const dtoName = `${persistClass}DTO`;
    const dtoPath = `${mainJavaPackageDir}/${entityPackage}service/dto/${dtoName}.java`;

    this.replaceLongToStringNeedles(dtoPath, ['private Long id', 'Long getId()', 'setId(Long id)']);

    if(!entity.builtIn){
      const dtoTestPath = `${testJavaPackageDir}/${entityPackage}service/dto/${dtoName}Test.java`;
      const dtoVarName = `${changeCase.camelCase(persistClass)}DTO`;
      const regExNeedles = [
        {
          regex: new RegExp(`${dtoVarName}1\\.setId\\(1L\\)`, 'gm'),
          content: `${dtoVarName}1.setId("1")`
        },
        {
          regex: new RegExp(`${dtoVarName}2\\.setId\\(2L\\)`, 'gm'),
          content: `${dtoVarName}2.setId("2")`
        }
      ];
      this.replaceRegexNeedles(dtoTestPath, regExNeedles);
    }
  }

  convertMapper(mainJavaPackageDir, packageName, entity) {
    const { persistClass, entityPackage = '' } = entity;
    const resourcePath = `${mainJavaPackageDir}/${entityPackage}service/mapper/${persistClass}Mapper.java`;

    let regExNeedles = [
      {
        regex: new RegExp(`import ${packageName}.service.dto.${persistClass}DTO;$`, 'gm'),
        content: `import ${packageName}.service.cipher.${persistClass}Cipher;\nimport ${packageName}.service.dto.${persistClass}DTO;\nimport org.springframework.beans.factory.annotation.Autowired;\n`
      },
      {
        regex: new RegExp(`public interface`, 'gm'),
        content: `public abstract class`
      },
      {
        regex: new RegExp(`extends`, 'gm'),
        content: `implements`
      },
      {
        regex: new RegExp(`> \{`, 'gm'),
        content: `> { \n@Autowired\nprotected ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;`
      },
      {
        regex: new RegExp(`^ *([A-Za-z0-9]+ toDto[A-Za-z0-9]+)`, 'gm'),
        content: `public abstract $1`
      },
      {
        regex: new RegExp(`^ *([A-Za-z0-9]+ toEntity[A-Za-z0-9]+)`, 'gm'),
        content: `public abstract $1`
      },
    ];

    if(this.findRegexNeedle(resourcePath, `${persistClass} toEntity`)) {
      regExNeedles.push(
        {
          regex: new RegExp(`${persistClass} toEntity`, 'gm'),
          content: `@Mapping(target = "id", expression = "java(${changeCase.camelCase(persistClass)}Cipher.decrypt(dto.getId()))")\npublic abstract ${persistClass} toEntity`
        }
      );
    }
    else {
      regExNeedles.push(
        {
          regex: new RegExp(`protected ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;`, 'gm'),
          content: `protected ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;\n\n@Mapping(target = "id", expression = "java(${changeCase.camelCase(persistClass)}Cipher.decrypt(dto.getId()))")\npublic abstract ${persistClass} toEntity(${persistClass}DTO dto);`
        }
      );
    }

    if(this.findRegexNeedle(resourcePath, `${persistClass}DTO toDto`)) {
      regExNeedles.push(
        {
          regex: new RegExp(`${persistClass}DTO toDto`, 'gm'),
          content: `@Mapping(target = "id", expression = "java(${changeCase.camelCase(persistClass)}Cipher.encrypt(s.getId()))")\npublic abstract ${persistClass}DTO toDto`
        }
      );
    }
    else {
      regExNeedles.push(
        {
          regex: new RegExp(`protected ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;`, 'gm'),
          content: `protected ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;\n\n@Mapping(target = "id", expression = "java(${changeCase.camelCase(persistClass)}Cipher.encrypt(s.getId()))")\npublic abstract ${persistClass}DTO toDto(${persistClass} s);`
        }
      );
    }

    this.replaceRegexNeedles(resourcePath, regExNeedles);
  }

  convertResource(mainJavaPackageDir, packageName, entity) {
    const { persistClass, entityPackage = '' } = entity;
    const resourcePath = `${mainJavaPackageDir}/${entityPackage}web/rest/${persistClass}Resource.java`;

    this.replaceLongToStringNeedles(resourcePath, ['Long id']);

    const regExNeedles = [
      {
        regex: new RegExp(`import ${packageName}.service.dto.${persistClass}DTO;$`, 'gm'),
        content: `import ${packageName}.service.cipher.${persistClass}Cipher;\nimport ${packageName}.service.dto.${persistClass}DTO;\n`
      },
      {
        regex: new RegExp(`private final ${persistClass}Service ${changeCase.camelCase(persistClass)}Service;$`, 'gm'),
        content: `private final ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;\n\nprivate final ${persistClass}Service ${changeCase.camelCase(persistClass)}Service;\n`
      },
      {
        regex: new RegExp(`        ${persistClass}Service ${changeCase.camelCase(persistClass)}Service`, 'gm'),
        content: `${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher, ${persistClass}Service ${changeCase.camelCase(persistClass)}Service`
      },
      {
        regex: new RegExp(`this.${changeCase.camelCase(persistClass)}Service = ${changeCase.camelCase(persistClass)}Service;`, 'gm'),
        content: `this.${changeCase.camelCase(persistClass)}Cipher = ${changeCase.camelCase(persistClass)}Cipher;\nthis.${changeCase.camelCase(persistClass)}Service = ${changeCase.camelCase(persistClass)}Service;`
      },
      {
        regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.existsById\\(id\\)`, 'gm'),
        content: `${changeCase.camelCase(persistClass)}Repository.existsById(${changeCase.camelCase(persistClass)}Cipher.decrypt(id))`
      },
    ];

    this.replaceRegexNeedles(resourcePath, regExNeedles);
  }

  convertService(mainJavaPackageDir, packageName, entity) {
    const { persistClass, entityPackage = '' } = entity;

    const servicePath = `${mainJavaPackageDir}/${entityPackage}service/${persistClass}Service.java`;
    const serviceImplPath = `${mainJavaPackageDir}/${entityPackage}service/impl/${persistClass}ServiceImpl.java`;

    this.replaceLongToStringNeedles(servicePath, ['findOne(Long id)', 'delete(Long id)']);
    this.replaceLongToStringNeedles(serviceImplPath, ['findOne(Long id)', 'delete(Long id)']);

    const regExNeedles = [
      {
        regex: new RegExp(`import ${packageName}.service.dto.${persistClass}DTO;$`, 'gm'),
        content: `import ${packageName}.service.cipher.${persistClass}Cipher;\nimport ${packageName}.service.dto.${persistClass}DTO;\n`
      },
      {
        regex: new RegExp(`private final ${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository;$`, 'gm'),
        content: `private final ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;\n\nprivate final ${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository;\n`
      },
      {
        regex: new RegExp(`        ${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository`, 'gm'),
        content: `${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher, ${persistClass}Repository ${changeCase.camelCase(persistClass)}Repository`
      },
      {
        regex: new RegExp(`this.${changeCase.camelCase(persistClass)}Repository = ${changeCase.camelCase(persistClass)}Repository;`, 'gm'),
        content: `this.${changeCase.camelCase(persistClass)}Cipher = ${changeCase.camelCase(persistClass)}Cipher;\nthis.${changeCase.camelCase(persistClass)}Repository = ${changeCase.camelCase(persistClass)}Repository;`
      },
      {
        regex: new RegExp(`${changeCase.camelCase(persistClass)}DTO.getId\\(\\)`, 'gm'),
        content: `${changeCase.camelCase(persistClass)}Cipher.decrypt(${changeCase.camelCase(persistClass)}DTO.getId())`
      },
      {
        regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.findById\\(id\\)`, 'gm'),
        content: `${changeCase.camelCase(persistClass)}Repository.findById(${changeCase.camelCase(persistClass)}Cipher.decrypt(id))`
      },
      {
        regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.deleteById\\(id\\)`, 'gm'),
        content: `${changeCase.camelCase(persistClass)}Repository.deleteById(${changeCase.camelCase(persistClass)}Cipher.decrypt(id))`
      },
      {
        regex: new RegExp(`${changeCase.camelCase(persistClass)}Repository.findOneWithEagerRelationships\\(id\\)`, 'gm'),
        content: `${changeCase.camelCase(persistClass)}Repository.findOneWithEagerRelationships(${changeCase.camelCase(persistClass)}Cipher.decrypt(id))`
      },
    ];

    this.replaceRegexNeedles(serviceImplPath, regExNeedles);
  }

  findRegexNeedle(filePath, needle) {
    var flag = false;
    this.editFile(filePath, content => {
      if(content.includes(needle)) {
        flag = true;
      }
      return content;
    });
    return flag;
  }

  replaceRegexNeedles(filePath, replaceNeedles) {
    replaceNeedles.forEach(needle => {
      this.editFile(filePath, contents =>
        contents
          .replaceAll(needle.regex, needle.content),
      );
    });
  }

  replaceLongToStringNeedles(filePath, replaceNeedles) {
    replaceNeedles.forEach(needle => {
      this.editFile(filePath, contents =>
        contents
          .replaceAll(needle, needle.replace('Long', 'String')),
      );
    });
  }
}
