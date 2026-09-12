import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';
import { javaMainPackageTemplatesBlock } from 'generator-jhipster/generators/java/support';

import * as encryptdUtil from '../encrypt-id-util.js';

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

        if (entityConfig.dto !== 'mapstruct') {
          throw new Error(`DTO with mapstruct required for entity ${entityName}`);
        }

        if (entityConfig.service !== 'serviceImpl') {
          throw new Error(`Service with serviceImpl required for entity ${entityName}`);
        }

        // The generated criteria expose the database ids as plain LongFilter, which would
        // defeat the encryption of the ids.
        if (entityConfig.jpaMetamodelFiltering) {
          throw new Error(`Filtering is not supported for entity ${entityName} with encrypted id`);
        }
      },
    });
  }

  get [BaseApplicationGenerator.WRITING_ENTITIES]() {
    return this.asWritingEntitiesTaskGroup({
      async writingEntitiesTemplateTask({ application, entities }) {
        await this.writeFiles({
          blocks: [
            javaMainPackageTemplatesBlock({
              templates: ['service/cipher/IdCipher.java', 'service/cipher/IdCipherException.java'],
            }),
          ],
          context: application,
        });

        await Promise.all(
          entities
            .filter(e => e.enableEncryptId || e.persistClass === 'User')
            .map(e =>
              this.writeFiles({
                blocks: [
                  javaMainPackageTemplatesBlock({
                    templates: ['service/cipher/_persistClass_IdCipher.java'],
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
      async postWritingTemplateTask({ application: { javaPackageSrcDir, srcMainResources, javaPackageTestDir, packageName } }) {
        encryptdUtil.convertJavaAccountResource(this, javaPackageSrcDir, packageName);
        encryptdUtil.convertJavaAccountResourceIT(this, javaPackageTestDir, packageName);
        encryptdUtil.convertJavaApplicationProperties(this, javaPackageSrcDir);
        encryptdUtil.convertJavaApplicationYml(this, srcMainResources);
        encryptdUtil.convertJavaPublicUserResourceIT(this, javaPackageTestDir, packageName);
        encryptdUtil.convertJavaUserDTO(this, javaPackageSrcDir, packageName);
        encryptdUtil.convertJavaUserMapper(this, javaPackageSrcDir, packageName);
        encryptdUtil.convertJavaUserMapperTest(this, javaPackageTestDir, packageName);
        encryptdUtil.convertJavaUserResource(this, javaPackageSrcDir, packageName);
        encryptdUtil.convertJavaUserResourceIT(this, javaPackageTestDir, packageName);
        encryptdUtil.convertJavaUserService(this, javaPackageSrcDir, packageName);
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING_ENTITIES]() {
    return this.asPostWritingEntitiesTaskGroup({
      async postWritingEntitiesTemplateTask({ application: { javaPackageSrcDir, javaPackageTestDir, packageName }, entities }) {
        // The id of the built in User entity is always encrypted, so relationships to it have to be encrypted too.
        const encryptedClasses = new Set(entities.filter(e => e.enableEncryptId).map(e => e.persistClass));
        encryptedClasses.add('User');

        for (const entity of entities.filter(e => e.enableEncryptId)) {
          encryptdUtil.convertJavaDto(this, javaPackageSrcDir, javaPackageTestDir, entity);
          const cipherClasses = encryptdUtil.convertJavaMapper(this, javaPackageSrcDir, packageName, entity, encryptedClasses);
          encryptdUtil.convertJavaMapperTest(this, javaPackageTestDir, packageName, entity, cipherClasses);
          encryptdUtil.convertJavaResource(this, javaPackageSrcDir, packageName, entity);
          encryptdUtil.convertJavaResourceIT(this, javaPackageTestDir, packageName, entity);
          encryptdUtil.convertJavaService(this, javaPackageSrcDir, packageName, entity);
        }
      },
    });
  }
}
