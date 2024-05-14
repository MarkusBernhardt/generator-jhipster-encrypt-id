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
      },
    });
  }

  get [BaseApplicationGenerator.POST_WRITING_ENTITIES]() {
    return this.asPostWritingEntitiesTaskGroup({
      async postWritingEntitiesTemplateTask({ application: { clientSrcDir }, entities }) {
        for (const entity of entities.filter(e => e.enableEncryptId)) {
          encryptdUtil.convertAngularComponent(this, clientSrcDir, entity);
          encryptdUtil.convertAngularDeleteDialog(this, clientSrcDir, entity);
          encryptdUtil.convertAngularModel(this, clientSrcDir, entity);
          encryptdUtil.convertAngularService(this, clientSrcDir, entity);
          encryptdUtil.convertAngularUpdateHtml(this, clientSrcDir, entity);
        }
      },
    });
  }
}
