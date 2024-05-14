import BaseApplicationGenerator from 'generator-jhipster/generators/base-application';

export default class extends BaseApplicationGenerator {
  constructor(args, opts, features) {
    super(args, opts, { ...features, sbsBlueprint: true });
  }

  get [BaseApplicationGenerator.COMPOSING]() {
    return this.asComposingTaskGroup({
      async composingTemplateTask() {
        if (this.blueprintConfig.encryptIdEnable) {
          const encryptIdEntities =
            this.blueprintConfig.encryptIdType === 'all'
              ? this.getExistingEntities().map(e => e.name)
              : this.blueprintConfig.encryptIdEntities;
          await this.composeWithJHipster('jhipster-encrypt-id:encrypt-id-angular', { generatorOptions: { encryptIdEntities } });
        }
      },
    });
  }
}
