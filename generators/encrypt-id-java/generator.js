import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';
import { javaMainPackageTemplatesBlock, javaTestPackageTemplatesBlock } from 'generator-jhipster/generators/java/support';

import * as encryptdUtil from '../encrypt-id-util.js';

export default class extends BaseApplicationGenerator {
  async beforeQueue() {
    await this.dependsOnJHipster('java');
  }

  /** Range operators on filters by an encrypted id, off unless enabled with `--encrypt-id-range-filter`. */
  get encryptIdRangeFilter() {
    return Boolean(this.options.encryptIdRangeFilter ?? this.blueprintConfig?.encryptIdRangeFilter);
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
      },
    });
  }

  get [BaseApplicationGenerator.POST_PREPARING_EACH_ENTITY]() {
    return this.asPostPreparingEachEntityTaskGroup({
      async encryptedIdFilterTypesTask({ application, entity }) {
        if (!entity.jpaMetamodelFiltering || entity.builtIn) return;

        // A criteria receives the ids from the request. Every filter on an encrypted id, the id of the entity
        // itself and every relationship to an entity with encrypted id, takes the encrypted ids as strings
        // instead of the database ids. The query service decrypts them with the cipher of the referenced entity.
        // JHipster copies the filter type of a relationship from the id of the referenced entity while preparing
        // the relationships, so the type is replaced afterwards, from the entity model and never from a name.
        const filters = encryptdUtil.collectEncryptedIdFilters(entity);
        if (filters.length === 0) return;

        // JHipster writes a criteria for a reactive application as well, but its query side is not converted.
        // Fail loudly instead of generating code that does not compile or leaks the database ids.
        if (application.reactive) {
          throw new Error(`Filtering by an encrypted id is not supported in a reactive application (entity ${entity.name})`);
        }

        for (const filter of filters) {
          filter.property.propertyJavaFilterType = `EncryptedIdFilter<${filter.cipherClass}>`;
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
              templates: [
                'service/cipher/EncryptedIdFilter.java',
                'service/cipher/IdCipher.java',
                'service/cipher/IdCipherException.java',
                'service/cipher/InvalidIdException.java',
              ],
            }),
            javaTestPackageTemplatesBlock({
              templates: ['service/cipher/IdCipherTest.java'],
            }),
          ],
          context: { ...application, encryptIdRangeFilter: this.encryptIdRangeFilter },
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
      async postWritingEntitiesTemplateTask({ application: { javaPackageSrcDir, javaPackageTestDir, packageName, reactive }, entities }) {
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

        // Filtering is converted for every entity: an entity without encrypted id can still filter by a
        // relationship to an entity with encrypted id. A reactive application was rejected while preparing.
        for (const entity of entities.filter(e => e.jpaMetamodelFiltering && !e.builtIn && !reactive)) {
          const filters = encryptdUtil.collectEncryptedIdFilters(entity);
          if (filters.length === 0) continue;

          encryptdUtil.convertJavaCriteria(this, javaPackageSrcDir, packageName, entity, filters, {
            rangeFilter: this.encryptIdRangeFilter,
          });
          encryptdUtil.convertJavaQueryService(this, javaPackageSrcDir, packageName, entity, filters);
          encryptdUtil.convertJavaResourceITFiltering(this, javaPackageTestDir, packageName, entity, filters, {
            rangeFilter: this.encryptIdRangeFilter,
          });
        }
      },
    });
  }
}
