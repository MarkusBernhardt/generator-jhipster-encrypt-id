import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';
import { javaMainPackageTemplatesBlock } from 'generator-jhipster/generators/java/support';
import * as encryptdUtil from "../encrypt-id-util.js"

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
            .filter(e => e.enableEncryptId || e.persistClass === 'User')
            .map(e =>
              this.writeFiles({
                blocks: [
                  javaMainPackageTemplatesBlock({
                    templates: [
                      'service/cipher/IdCipher.java',
                      'service/cipher/IdCipherException.java',
                      'service/cipher/_persistClass_IdCipher.java',
                      'config/EncryptIdConfiguration.java'
                    ],
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
    return this.asPostWritingTaskGroup({
      async postWritingTemplateTask({ application: { mainJavaPackageDir, mainJavaResourceDir, testJavaPackageDir, packageName } }) {
        encryptdUtil.convertJavaAccountResource(this, mainJavaPackageDir, packageName);
        encryptdUtil.convertJavaAccountResourceIT(this, testJavaPackageDir, packageName);
        encryptdUtil.convertJavaApplicationProperties(this, mainJavaPackageDir);
        encryptdUtil.convertJavaApplicationYml(this, mainJavaResourceDir);
        encryptdUtil.convertJavaUserDTO(this, mainJavaPackageDir, packageName);
        encryptdUtil.convertJavaUserMapper(this, mainJavaPackageDir, packageName);
        encryptdUtil.convertJavaUserMapperTest(this, testJavaPackageDir, packageName);
        encryptdUtil.convertJavaUserResource(this, mainJavaPackageDir, packageName);
        encryptdUtil.convertJavaUserResourceIT(this, testJavaPackageDir, packageName);
        encryptdUtil.convertJavaUserService(this, mainJavaPackageDir, packageName);
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING_ENTITIES]() {
    return this.asPostWritingEntitiesTaskGroup({
      async postWritingEntitiesTemplateTask({ application: { mainJavaPackageDir, testJavaPackageDir, packageName }, entities }) {
        for (const entity of entities.filter(e => e.enableEncryptId)) {
          encryptdUtil.convertJavaDto(this, mainJavaPackageDir, testJavaPackageDir, entity);
          encryptdUtil.convertJavaMapper(this, mainJavaPackageDir, packageName, entity);
          encryptdUtil.convertJavaMapperTest(this, testJavaPackageDir, packageName, entity);
          encryptdUtil.convertJavaResource(this, mainJavaPackageDir, packageName, entity);
          encryptdUtil.convertJavaService(this, mainJavaPackageDir, packageName, entity);
        }
      },
    });
  }
}
