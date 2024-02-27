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
      async postWritingEntitiesTask({ application: { mainJavaPackageDir, testJavaPackageDir }, entities }) {
        for (const entity of entities.filter(e => e.enableEncryptId)) {
          this.convertDto(mainJavaPackageDir, testJavaPackageDir, entity);
          this.convertService(mainJavaPackageDir, entity);
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
        content: 'application:\n  encrypt-id:\n    key: "change me"'
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

    this.replaceLongToStringNeedles(dtoPath, ['private Long id', 'Long getId() {', 'setId(Long id) {']);

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

  convertService(mainJavaPackageDir, entity) {
    const { persistClass, entityPackage = '' } = entity;

    const regExNeedles = [
      {
        regex: new RegExp(`import de.scmb.sultan.service.dto.${persistClass}DTO;$`, 'gm'),
        content: `import de.scmb.sultan.service.cipher.${persistClass}Cipher;\nimport de.scmb.sultan.service.dto.${persistClass}DTO;\n`
      },
      {
        regex: new RegExp(`private final ${persistClass}Mapper ${changeCase.camelCase(persistClass)}Mapper;$`, 'gm'),
        content: `private final ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher;\n\nprivate final ${persistClass}Mapper ${changeCase.camelCase(persistClass)}Mapper;\n`
      },
      {
        regex: new RegExp(`        ${persistClass}Mapper ${changeCase.camelCase(persistClass)}Mapper`, 'gm'),
        content: `${persistClass}Mapper ${changeCase.camelCase(persistClass)}Mapper, ${persistClass}Cipher ${changeCase.camelCase(persistClass)}Cipher`
      },
      {
        regex: new RegExp(`this.${changeCase.camelCase(persistClass)}Mapper = ${changeCase.camelCase(persistClass)}Mapper;`, 'gm'),
        content: `this.${changeCase.camelCase(persistClass)}Mapper = ${changeCase.camelCase(persistClass)}Mapper;\nthis.${changeCase.camelCase(persistClass)}Cipher = ${changeCase.camelCase(persistClass)}Cipher;`
      },
      {
        regex: new RegExp(`${changeCase.camelCase(persistClass)}DTO.getId\\(\\)`, 'gm'),
        content: `${changeCase.camelCase(persistClass)}Cipher.decrypt(${changeCase.camelCase(persistClass)}DTO.getId())`
      },
    ];

    const serviceImplPath = `${mainJavaPackageDir}/${entityPackage}service/impl/${persistClass}ServiceImpl.java`;
    this.replaceRegexNeedles(serviceImplPath, regExNeedles);
  }

  replaceRegexNeedles(filePath, replaceNeedles) {
    replaceNeedles.forEach(needle => {
      this.editFile(filePath, contents =>
        contents
          .replace(needle.regex, needle.content),
      );
    });
  }

  replaceLongToStringNeedles(filePath, replaceNeedles) {
    replaceNeedles.forEach(needle => {
      this.editFile(filePath, contents =>
        contents
          .replace(needle, needle.replace('Long', 'String')),
      );
    });
  }
}
