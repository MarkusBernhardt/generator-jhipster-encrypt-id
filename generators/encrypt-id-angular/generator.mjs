import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';
import * as encryptdUtil from '../encrypt-id-util.js';

export default class extends BaseApplicationGenerator {
  async beforeQueue() {
    await this.dependsOnJHipster('angular');
  }

  get [BaseApplicationGenerator.POST_WRITING]() {
    return this.asPostWritingTaskGroup({
      async postWritingTemplateTask({ application: { clientSrcDir } }) {
        encryptdUtil.convertAngularUserManagement(this, clientSrcDir);
        encryptdUtil.convertAngularUserManagementList(this, clientSrcDir);
        encryptdUtil.convertAngularUser(this, clientSrcDir);
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING_ENTITIES]() {
    return this.asPostWritingEntitiesTaskGroup({
      async postWritingEntitiesTemplateTask({ application: { clientSrcDir }, entities }) {
        // The id of the built in User entity is always encrypted, so relationships to it have to be encrypted too.
        const encryptedClasses = new Set(entities.filter(e => e.enableEncryptId).map(e => e.persistClass));
        encryptedClasses.add('User');

        for (const entity of entities.filter(e => e.enableEncryptId)) {
          encryptdUtil.convertAngularComponent(this, clientSrcDir, entity);
          encryptdUtil.convertAngularComponentSpecs(this, clientSrcDir, entity, encryptedClasses);
          encryptdUtil.convertAngularDeleteDialog(this, clientSrcDir, entity);
          encryptdUtil.convertAngularDeleteDialogSpec(this, clientSrcDir, entity);
          encryptdUtil.convertAngularModel(this, clientSrcDir, entity);
          encryptdUtil.convertAngularRouteSpec(this, clientSrcDir, entity);
          encryptdUtil.convertAngularService(this, clientSrcDir, entity);
          encryptdUtil.convertAngularServiceSpec(this, clientSrcDir, entity);
          encryptdUtil.convertAngularTestSamples(this, clientSrcDir, entity);
          encryptdUtil.convertAngularUpdateHtml(this, clientSrcDir, entity);
        }
      },
    });
  }
}
