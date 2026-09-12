import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';

import * as encryptdUtil from '../encrypt-id-util.js';

/**
 * The ids of the built in `User` entity and of the `UserManagement` entity of the user
 * administration are always encrypted, because the server always encrypts the id of the user.
 */
const BUILT_IN_ENCRYPTED_CLASSES = ['User', 'UserManagement'];

export default class extends BaseApplicationGenerator {
  async beforeQueue() {
    await this.dependsOnJHipster('angular');
  }

  get [BaseApplicationGenerator.POST_WRITING_ENTITIES]() {
    return this.asPostWritingEntitiesTaskGroup({
      async postWritingEntitiesTemplateTask({ application: { clientSrcDir }, entities }) {
        const encryptedClasses = new Set(entities.filter(e => e.enableEncryptId).map(e => e.persistClass));
        for (const persistClass of BUILT_IN_ENCRYPTED_CLASSES) {
          encryptedClasses.add(persistClass);
        }

        for (const entity of entities.filter(e => encryptedClasses.has(e.persistClass))) {
          encryptdUtil.convertAngularDeleteDialog(this, clientSrcDir, entity);
          encryptdUtil.convertAngularDeleteDialogSpec(this, clientSrcDir, entity);
          encryptdUtil.convertAngularList(this, clientSrcDir, entity);
          encryptdUtil.convertAngularModel(this, clientSrcDir, entity);
          encryptdUtil.convertAngularRouteSpec(this, clientSrcDir, entity);
          encryptdUtil.convertAngularService(this, clientSrcDir, entity);
          encryptdUtil.convertAngularServiceSpec(this, clientSrcDir, entity);
          encryptdUtil.convertAngularTestFixtures(this, clientSrcDir, entity, encryptedClasses);
          encryptdUtil.convertAngularUpdateHtml(this, clientSrcDir, entity);
        }
      },
    });
  }
}
